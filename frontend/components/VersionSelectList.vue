<template>
  <div
    v-if="app"
    class="vs"
  >
    <!-- 头部：标题 + 计数 -->
    <div class="vs-header">
      <span class="vs-title">选择版本</span>
      <span
        v-if="!loading"
        class="vs-count"
      >共 {{ versions.length }} 个</span>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="vs-loading"
    >
      <span class="vs-spinner" />
      <span>正在查询版本…</span>
    </div>

    <!-- 加载失败 -->
    <div
      v-else-if="loadError"
      class="vs-error"
    >
      <span>⚠️ {{ loadError }}</span>
      <button
        class="vs-retry"
        @click="fetchVersionInfo"
      >
        重试
      </button>
    </div>

    <!-- 版本列表 -->
    <template v-else>
      <div class="vs-list">
        <label
          v-for="(ver, idx) in versions"
          :key="ver.id"
          class="vs-item"
          :class="{ active: selectedId === ver.id }"
          @click="selectVersion(ver.id)"
        >
          <span class="vs-radio-circle">
            <span
              v-if="selectedId === ver.id"
              class="vs-radio-dot"
            />
          </span>

          <div class="vs-item-body">
            <div class="vs-item-top">
              <span class="vs-version">v{{ ver.version }}</span>
              <span
                v-if="ver.isLatest"
                class="vs-badge-latest"
              >最新</span>
            </div>
            <div class="vs-item-meta">
              <span v-if="ver.date">{{ ver.date }}</span>
              <span
                v-if="ver.size"
                class="vs-meta-sep"
              >·</span>
              <span v-if="ver.size">{{ ver.size }}</span>
            </div>
          </div>
        </label>
      </div>

      <!-- 手动输入版本 ID -->
      <div class="vs-manual-toggle">
        <button
          class="vs-manual-btn"
          :class="{ active: showManual }"
          @click="toggleManual"
        >
          <span class="vs-manual-icon">✏️</span>
          {{ showManual ? '收起手动输入' : '手动输入版本 ID' }}
        </button>
      </div>

      <div
        v-if="showManual"
        class="vs-manual-input"
      >
        <MobileInput
          v-model="manualId"
          type="text"
          placeholder="输入 externalVersionId（如 84752348）"
          clearable
          hint="留空则下载最新版本"
        />
      </div>
    </template>
  </div>
  <div
    v-else
    class="vs vs--empty"
  >
    <span class="vs-empty-text">请先在搜索中选择一个应用</span>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import MobileInput from './MobileInput.vue'

const props = defineProps({
  app: { type: Object, default: null },
  accountEmail: { type: String, default: '' },
  accountRegion: { type: String, default: '' },
})

const emit = defineEmits(['version-change'])

// ── State ──────────────────────────────────────────────
const loading = ref(false)
const loadError = ref('')
const selectedId = ref('')        // '' = latest, or externalVersionId
const showManual = ref(false)
const manualId = ref('')

// Version list from /api/versions endpoint
const rawVersions = ref([])

// ── Helpers ────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return ''
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return (n / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateStr
  }
}

// ── Versions computed ──────────────────────────────────
const versions = computed(() => {
  if (!props.app) return []
  const app = props.app
  const list = rawVersions.value

  if (!list.length) {
    // No history versions — show current as "latest"
    return [{
      id: '',
      version: app.version || '—',
      isLatest: true,
      date: formatDate(app.currentVersionReleaseDate),
      size: formatBytes(app.fileSizeBytes),
    }]
  }

  // Map raw versions to display items
  const items = list.map((v, idx) => ({
    id: String(v.external_identifier),
    version: v.bundle_version || '—',
    isLatest: idx === 0,
    date: formatDate(v.created_at),
    size: formatBytes(v.size),
  }))

  // Prepend "latest" option (no version ID = latest from Apple)
  items.unshift({
    id: '',
    version: app.version || items[0]?.version || '—',
    isLatest: true,
    date: formatDate(app.currentVersionReleaseDate),
    size: formatBytes(app.fileSizeBytes),
  })

  return items
})

// ── Fetch version history from worker backend ──────────
async function fetchVersionInfo() {
  if (!props.app?.trackId) return
  loading.value = true
  loadError.value = ''
  rawVersions.value = []

  try {
    const appid = props.app.trackId || props.app.bundleId
    const country = props.accountRegion || 'US'
    const resp = await fetch(`/api/versions?appid=${encodeURIComponent(appid)}&country=${encodeURIComponent(country)}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!resp.ok) throw new Error(`查询失败 (${resp.status})`)
    const json = await resp.json()
    if (json.ok && Array.isArray(json.data)) {
      rawVersions.value = json.data
    }
  } catch (e) {
    console.warn('Version history fetch failed:', e)
    loadError.value = e.message || '版本查询失败'
  } finally {
    loading.value = false
  }
}

// ── Actions ────────────────────────────────────────────
function selectVersion(id) {
  selectedId.value = id
  showManual.value = false
  manualId.value = ''
  emit('version-change', id)
}

function toggleManual() {
  showManual.value = !showManual.value
  if (showManual.value) {
    // Deselect radio
    selectedId.value = ''
    emit('version-change', manualId.value.trim())
  } else {
    emit('version-change', selectedId.value)
  }
}

// ── Watchers ───────────────────────────────────────────

// When app changes, reset state and fetch
watch(() => props.app, (newApp) => {
  selectedId.value = ''
  showManual.value = false
  manualId.value = ''
  loadError.value = ''
  rawVersions.value = []

  if (newApp) {
    fetchVersionInfo()
    // Emit '' (latest) as default selection
    nextTick(() => emit('version-change', ''))
  }
}, { immediate: true })

// When manual ID changes while manual mode is active
watch(manualId, (v) => {
  if (showManual.value) {
    emit('version-change', v.trim())
  }
})
</script>

<style scoped>
.vs {
  border: 1px solid var(--color-border, #ebebeb);
  border-radius: var(--radius-xl, 16px);
  background: var(--color-surface-muted, #f7f7f8);
  padding: var(--space-3, 12px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.vs--empty {
  text-align: center;
  padding: var(--space-5, 20px);
}

.vs-empty-text {
  color: var(--color-text-muted, #6e6e80);
  font-size: var(--font-size-label, 13px);
}

/* ── Header ──────────────────────────────────────── */
.vs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vs-title {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #6e6e80);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.vs-count {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #6e6e80);
}

/* ── Loading ──────────────────────────────────────── */
.vs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px) 0;
  color: var(--color-text-muted, #6e6e80);
  font-size: var(--font-size-body, 14px);
}

.vs-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border, #ebebeb);
  border-top-color: var(--color-primary, #10a37f);
  border-radius: 50%;
  animation: vs-spin 0.6s linear infinite;
}

@keyframes vs-spin {
  to { transform: rotate(360deg); }
}

/* ── Error ────────────────────────────────────────── */
.vs-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) 0;
  color: var(--color-danger, #ef4444);
  font-size: var(--font-size-body, 14px);
  text-align: center;
}

.vs-retry {
  padding: 4px 12px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #ebebeb);
  background: var(--color-surface, #fff);
  color: var(--color-text, #0d0d0d);
  font-size: var(--font-size-caption, 12px);
  cursor: pointer;
}

.vs-retry:active {
  opacity: 0.7;
}

/* ── Version List ─────────────────────────────────── */
.vs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.vs-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border, #ebebeb);
  background: var(--color-surface, #fff);
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.vs-item:active {
  transform: scale(0.98);
}

.vs-item.active {
  border-color: var(--color-primary, #10a37f);
  background: var(--color-primary-soft, rgba(16, 163, 127, 0.08));
}

/* ── Radio Circle ─────────────────────────────────── */
.vs-radio-circle {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong, #d1d5db);
  background: var(--color-surface, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.vs-item.active .vs-radio-circle {
  border-color: var(--color-primary, #10a37f);
}

.vs-radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary, #10a37f);
}

/* ── Version Item Body ────────────────────────────── */
.vs-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vs-item-top {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.vs-version {
  font-size: var(--font-size-body, 15px);
  font-weight: 600;
  color: var(--color-text, #0d0d0d);
}

.vs-badge-latest {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--color-primary, #10a37f);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
}

.vs-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #6e6e80);
}

.vs-meta-sep {
  color: var(--color-border-strong, #d1d5db);
}

/* ── Manual Toggle ────────────────────────────────── */
.vs-manual-toggle {
  display: flex;
  justify-content: flex-end;
}

.vs-manual-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  background: transparent;
  border: none;
  color: var(--color-primary, #10a37f);
  font-size: var(--font-size-caption, 12px);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.vs-manual-btn:active {
  opacity: 0.7;
}

.vs-manual-icon {
  font-size: 12px;
}

.vs-manual-input {
  padding: 0;
}

/* ── Dark mode ────────────────────────────────────── */
.dark .vs {
  background: var(--color-surface-muted, #27272a);
  border-color: var(--color-border, #3f3f46);
}

.dark .vs-item {
  background: var(--color-surface, #18181b);
  border-color: var(--color-border, #3f3f46);
}

.dark .vs-item.active {
  border-color: var(--color-primary, #34d399);
  background: var(--color-primary-soft, rgba(52, 211, 153, 0.1));
}

.dark .vs-radio-circle {
  border-color: var(--color-border-strong, #52525b);
  background: var(--color-surface, #18181b);
}

.dark .vs-item.active .vs-radio-circle {
  border-color: var(--color-primary, #34d399);
}

.dark .vs-radio-dot {
  background: var(--color-primary, #34d399);
}

.dark .vs-version {
  color: var(--color-text, #f5f5f5);
}

.dark .vs-item-meta {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .vs-badge-latest {
  background: var(--color-primary, #34d399);
  color: #0d0d0d;
}

.dark .vs-manual-btn {
  color: var(--color-primary, #34d399);
}

.dark .vs-retry {
  background: var(--color-surface, #18181b);
  border-color: var(--color-border, #3f3f46);
  color: var(--color-text, #f5f5f5);
}

.dark .vs-spinner {
  border-color: var(--color-border, #3f3f46);
  border-top-color: var(--color-primary, #34d399);
}
</style>
