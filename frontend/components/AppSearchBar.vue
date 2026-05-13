<template>
  <div class="sb">
    <!-- Search Input -->
    <div class="sb-row">
      <MobileInput
        v-model="query"
        type="text"
        class="sb-input"
        :placeholder="placeholder"
        :clearable="true"
        @keyup.enter="onSearch"
        @input="onInput"
      />
      <MobileButton
        type="primary"
        size="medium"
        :disabled="!query.trim() || searching"
        :loading="searching"
        @click="onSearch"
      >
        {{ searching ? '搜索中…' : '搜索' }}
      </MobileButton>
    </div>

    <!-- App ID hint -->
    <div
      v-if="isAppIdQuery"
      class="sb-hint"
    >
      检测到 App ID，将直接查询此应用
    </div>

    <!-- States -->
    <div
      v-if="searching"
      class="sb-status"
    >
      搜索中…
    </div>
    <div
      v-else-if="results.length > 0"
      class="sb-results"
    >
      <div
        v-for="app in results"
        :key="app.trackId"
        class="sb-item"
        :class="{ 'sb-item--sel': selectedTrackId === String(app.trackId) }"
        @click="selectApp(app)"
      >
        <img
          v-if="app.artworkUrl60"
          :src="app.artworkUrl60"
          class="sb-icon"
          alt=""
        >
        <div
          v-else
          class="sb-icon-ph"
        />
        <div class="sb-info">
          <div class="sb-name">
            {{ app.trackName }}
          </div>
          <div class="sb-meta">
            <span>{{ app.artistName }}</span>
            <span v-if="app.version">v{{ app.version }}</span>
            <span v-if="app.formattedPrice && app.formattedPrice !== '0.00'">{{ app.formattedPrice }}</span>
            <span
              v-else
              class="sb-free"
            >免费</span>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="searched"
      class="sb-status"
    >
      无搜索结果
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { searchApps } from '../utils/appleApi.js'
import MobileInput from './MobileInput.vue'
import MobileButton from './MobileButton.vue'

const props = defineProps({
  placeholder: { type: String, default: '搜索 App 名称、开发者或 Bundle ID' },
  accountRegion: { type: String, default: 'US' },
})

const emit = defineEmits(['app-selected'])

const query = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const selectedTrackId = ref(null)

const isAppIdQuery = computed(() => /^\d+$/.test(query.value.trim()))

let debounceTimer = null

function onInput() {
  clearTimeout(debounceTimer)
  if (isAppIdQuery.value) return
  debounceTimer = setTimeout(onSearch, 400)
}

async function onSearch() {
  const term = query.value.trim()
  if (!term) return
  searching.value = true; searched.value = false; results.value = []; selectedTrackId.value = null
  try {
    if (isAppIdQuery.value) {
      const resp = await fetch(`https://itunes.apple.com/lookup?id=${term}&country=${props.accountRegion}`)
      const json = await resp.json()
      results.value = json.results || []
    } else {
      results.value = await searchApps(term, props.accountRegion, 12)
    }
    searched.value = true
  } catch (e) {
    console.error('Search failed:', e)
    results.value = []; searched.value = true
  } finally {
    searching.value = false
  }
}

function selectApp(app) {
  selectedTrackId.value = String(app.trackId)
  emit('app-selected', app)
}
</script>

<style scoped>
.sb {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: var(--space-3-5) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2-5);
}

.sb-row {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
}

.sb-row .sb-input {
  flex: 1;
  min-width: 0;
}

.sb-hint {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.sb-status {
  text-align: center;
  padding: var(--space-3);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.sb-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: min(42vh, 420px);
  overflow-y: auto;
}

.sb-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.sb-item:hover {
  background: var(--color-surface-hover);
}

.sb-item:active {
  transform: scale(0.99);
}

.sb-item--sel {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.sb-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  flex-shrink: 0;
}

.sb-icon-ph {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--color-surface-muted);
  flex-shrink: 0;
}

.sb-info {
  flex: 1;
  min-width: 0;
}

.sb-name {
  font-size: var(--font-size-body);
  font-weight: 700;
  margin-bottom: var(--space-1);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-meta {
  display: flex;
  gap: var(--space-1-5);
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.sb-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
}

.sb-free {
  color: var(--color-success);
  font-weight: 600;
}
</style>
