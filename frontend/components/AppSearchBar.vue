<template>
  <div class="sb">
    <!-- Search Input -->
    <div class="sb-row">
      <input
        v-model="query"
        type="text"
        class="sb-input"
        :placeholder="placeholder"
        @keyup.enter="onSearch"
        @input="onInput"
      />
      <button class="sb-btn" :disabled="!query.trim() || searching" @click="onSearch">
        {{ searching ? '搜索中…' : '搜索' }}
      </button>
    </div>

    <!-- App ID hint -->
    <div v-if="isAppIdQuery" class="sb-hint">检测到 App ID，将直接查询此应用</div>

    <!-- States -->
    <div v-if="searching" class="sb-status">搜索中…</div>
    <div v-else-if="results.length > 0" class="sb-results">
      <div
        v-for="app in results"
        :key="app.trackId"
        class="sb-item"
        :class="{ 'sb-item--sel': selectedTrackId === String(app.trackId) }"
        @click="selectApp(app)"
      >
        <img v-if="app.artworkUrl60" :src="app.artworkUrl60" class="sb-icon" alt="" />
        <div v-else class="sb-icon-ph" />
        <div class="sb-info">
          <div class="sb-name">{{ app.trackName }}</div>
          <div class="sb-meta">
            <span>{{ app.artistName }}</span>
            <span v-if="app.version">v{{ app.version }}</span>
            <span v-if="app.formattedPrice && app.formattedPrice !== '0.00'">{{ app.formattedPrice }}</span>
            <span v-else class="sb-free">免费</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="searched" class="sb-status">无搜索结果</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { searchApps } from '../utils/appleApi.js'

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
  background: var(--color-surface, #fff);
  border-radius: 10px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.sb-row { display: flex; gap: 8px; }
.sb-input {
  flex: 1; min-width: 0; padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-bg, #f8f8f8); color: var(--color-text);
  font-size: 15px; outline: none;
}
.sb-input:focus { border-color: var(--color-primary, #0a84ff); }
.sb-btn {
  padding: 10px 18px; border-radius: 8px; border: none;
  background: var(--color-primary, #0a84ff); color: #fff;
  font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap;
}
.sb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sb-hint { font-size: 12px; color: var(--color-text-secondary, #888); }
.sb-status { text-align: center; padding: 12px; font-size: 13px; color: var(--color-text-secondary, #999); }
.sb-results { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.sb-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; transition: background 0.15s;
  border: 1px solid transparent;
}
.sb-item:hover { background: var(--color-bg-secondary, #f0f0f0); }
.sb-item--sel { border-color: var(--color-primary, #0a84ff); background: rgba(10,132,255,0.05); }
.sb-icon { width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; }
.sb-icon-ph { width: 48px; height: 48px; border-radius: 10px; background: var(--color-bg-secondary, #eee); flex-shrink: 0; }
.sb-info { flex: 1; min-width: 0; }
.sb-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-meta { display: flex; gap: 8px; font-size: 12px; color: var(--color-text-secondary, #888); flex-wrap: wrap; }
.sb-free { color: #34c759; font-weight: 500; }
</style>
