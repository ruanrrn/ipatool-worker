<template>
  <div class="page">
    <!-- R2 Capacity Bar -->
    <div
      v-if="storage"
      class="capacity-bar"
    >
      <div class="capacity-header">
        <span class="capacity-label">R2 存储</span>
        <span class="capacity-detail">
          {{ formatSize(storage.usedBytes) }} / {{ formatSize(storage.totalBytes) }}
          · {{ storage.assetCount }} 个文件
        </span>
      </div>
      <div class="capacity-track">
        <div
          class="capacity-fill"
          :class="capacityClass"
          :style="{ width: capacityPercent + '%' }"
        />
      </div>
      <div class="capacity-pct">
        {{ capacityPercent.toFixed(1) }}%
      </div>
    </div>

    <!-- Batch actions toolbar -->
    <div
      v-if="assets.length"
      class="batch-toolbar"
    >
      <label class="select-all">
        <input
          type="checkbox"
          :checked="allSelected"
          @change="toggleSelectAll"
        >
        <span>全选</span>
      </label>
      <button
        v-if="selectedIds.length"
        class="btn batch-delete"
        :disabled="batchDeleting"
        @click="onBatchDelete"
      >
        {{ batchDeleting ? '批量删除中…' : `删除选中 (${selectedIds.length})` }}
      </button>
      <span
        v-if="selectedIds.length"
        class="selected-info"
      >
        已选 {{ formatSize(selectedSize) }}
      </span>
    </div>

    <div
      v-if="loading"
      class="loading"
    >
      加载中…
    </div>
    <div
      v-else-if="!assets.length"
      class="empty"
    >
      还没有任何已签 IPA。先去"下载"页生成一个。
    </div>
    <div
      v-else
      class="list"
    >
      <div
        v-for="a in assets"
        :key="a.assetId"
        class="item"
        :class="{ selected: isSelected(a.assetId) }"
      >
        <label class="checkbox-cell">
          <input
            type="checkbox"
            :checked="isSelected(a.assetId)"
            @change="toggleSelect(a.assetId)"
          >
        </label>
        <div class="info">
          <div class="title">
            {{ a.title }}
          </div>
          <div class="meta">
            版本 {{ a.version }} · {{ formatSize(a.size) }} · <code>{{ a.bundleId }}</code>
          </div>
          <div class="meta-tiny">
            {{ formatDate(a.uploadedAt) }} · ID {{ a.assetId.slice(0, 8) }}
          </div>
        </div>
        <div class="actions">
          <a
            class="btn install"
            :href="`/i/${a.assetId}`"
            target="_blank"
          >装机</a>
          <button
            class="btn delete"
            :disabled="deletingId === a.assetId"
            @click="onDelete(a.assetId)"
          >
            {{ deletingId === a.assetId ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '../utils/api.js'

const loading = ref(true)
const assets = ref([])
const deletingId = ref(null)
const batchDeleting = ref(false)
const storage = ref(null)
const selectedIds = ref([])

/* ── Helpers ── */

function formatSize(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(t) {
  return new Date(t).toLocaleString()
}

/* ── Capacity ── */

const capacityPercent = computed(() => {
  if (!storage.value || !storage.value.totalBytes) return 0
  return (storage.value.usedBytes / storage.value.totalBytes) * 100
})

const capacityClass = computed(() => {
  const pct = capacityPercent.value
  if (pct >= 90) return 'critical'
  if (pct >= 70) return 'warning'
  return 'normal'
})

/* ── Selection ── */

const allSelected = computed(() => {
  return assets.value.length > 0 && selectedIds.value.length === assets.value.length
})

const selectedSize = computed(() => {
  const idSet = new Set(selectedIds.value)
  return assets.value.filter(a => idSet.has(a.assetId)).reduce((sum, a) => sum + (a.size || 0), 0)
})

function isSelected(id) {
  return selectedIds.value.includes(id)
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = assets.value.map(a => a.assetId)
  }
}

/* ── Data loading ── */

async function load() {
  loading.value = true
  try {
    const { response, data } = await apiFetch('/r2/list', { method: 'GET' })
    if (response.ok && Array.isArray(data?.assets)) {
      assets.value = data.assets
    } else {
      assets.value = []
    }
    if (data?.storage) {
      storage.value = data.storage
    }
  } catch {
    assets.value = []
  } finally {
    loading.value = false
  }
}

/* ── Single delete ── */

async function onDelete(assetId) {
  if (!confirm('确认删除这个 IPA？将从 R2 永久移除。')) return
  deletingId.value = assetId
  try {
    await apiFetch(`/r2/object/${assetId}`, { method: 'DELETE' })
    assets.value = assets.value.filter(a => a.assetId !== assetId)
    selectedIds.value = selectedIds.value.filter(id => id !== assetId)
    // Refresh storage info
    await load()
  } finally {
    deletingId.value = null
  }
}

/* ── Batch delete ── */

async function onBatchDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!confirm(`确认删除 ${ids.length} 个 IPA？将从 R2 永久移除。`)) return
  batchDeleting.value = true
  try {
    const { data } = await apiFetch('/r2/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: ids }),
    })
    const deletedSet = new Set(ids)
    // If there were errors, keep items that failed
    if (data?.errors?.length) {
      const failedSet = new Set(data.errors.map(e => e.assetId))
      assets.value = assets.value.filter(a => !deletedSet.has(a.assetId) || failedSet.has(a.assetId))
    } else {
      assets.value = assets.value.filter(a => !deletedSet.has(a.assetId))
    }
    selectedIds.value = []
    // Refresh storage info
    await load()
  } finally {
    batchDeleting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

/* ── Capacity bar ── */
.capacity-bar {
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 14px 16px;
}
.capacity-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.capacity-label { font-size: 14px; font-weight: 600; }
.capacity-detail { font-size: 13px; color: var(--color-text-secondary, #888); }
.capacity-track {
  width: 100%;
  height: 8px;
  background: var(--color-bg-secondary, #eee);
  border-radius: 4px;
  overflow: hidden;
}
.capacity-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.capacity-fill.normal { background: #34c759; }
.capacity-fill.warning { background: #ff9500; }
.capacity-fill.critical { background: #ff3b30; }
.capacity-pct {
  font-size: 12px;
  color: var(--color-text-tertiary, #aaa);
  margin-top: 4px;
  text-align: right;
}

/* ── Batch toolbar ── */
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--color-surface, #fff);
  border-radius: 10px;
}
.select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}
.selected-info {
  font-size: 13px;
  color: var(--color-text-secondary, #888);
}
.btn.batch-delete {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid #fbb;
  background: #fff5f5;
  color: #c00;
  cursor: pointer;
}
.btn.batch-delete:hover { background: #fee; }
.btn.batch-delete:disabled { opacity: .5; cursor: wait; }

/* ── List ── */
.loading, .empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-secondary, #999);
}
.list { display: flex; flex-direction: column; gap: 8px; }
.item {
  display: flex;
  align-items: center;
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 14px 16px;
  gap: 12px;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}
.item.selected { border-color: var(--color-primary, #0a84ff); }
.checkbox-cell { display: flex; align-items: center; cursor: pointer; }
.checkbox-cell input { width: 18px; height: 18px; accent-color: var(--color-primary, #0a84ff); }
.info { flex: 1; min-width: 0; }
.title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.meta { font-size: 13px; color: var(--color-text-secondary, #888); }
.meta-tiny { font-size: 12px; color: var(--color-text-tertiary, #aaa); margin-top: 4px; }
.actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--color-border, #ddd);
  background: transparent;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
}
.btn.install {
  background: var(--color-primary, #0a84ff);
  color: #fff;
  border-color: var(--color-primary, #0a84ff);
}
.btn.delete:hover { background: #fee; color: #c00; border-color: #fbb; }
.btn.delete:disabled { opacity: .5; cursor: wait; }
</style>
