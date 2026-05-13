<template>
  <div class="app-search-bar">
    <MobileInput
      v-model="query"
      type="text"
      class="search-input search-input--fused-top"
      placeholder="搜索应用名称或输入 App ID..."
      :loading="searching"
      :clearable="true"
      @input="onInput"
      @keyup.enter="onSearch"
    >
      <template #prefix>
        <Search class="search-input__icon" />
      </template>
    </MobileInput>

    <!-- App ID hint -->
    <div
      v-if="isAppIdQuery"
      class="app-search-bar__hint"
    >
      检测到 App ID，将直接查询此应用
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { searchApps } from '../utils/appleApi.js'
import MobileInput from './MobileInput.vue'
import { Search } from './icons.js'

const props = defineProps({
  accountRegion: { type: String, default: 'US' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['results-change', 'searching-change', 'app-selected', 'query-change'])

const query = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const selectedTrackId = ref(null)

const isAppIdQuery = computed(() => /^\d+$/.test(query.value.trim()))

// Watch searching and emit state changes
watch(searching, (val) => {
  emit('searching-change', val)
})

let debounceTimer = null

function onInput() {
  clearTimeout(debounceTimer)
  emit('query-change', query.value)
  if (!query.value.trim()) {
    results.value = []
    searched.value = false
    emit('results-change', [])
    return
  }
  if (isAppIdQuery.value) {
    // Auto-trigger for app IDs immediately
    onSearch()
    return
  }
  debounceTimer = setTimeout(onSearch, 400)
}

async function onSearch() {
  const term = query.value.trim()
  if (!term) return
  searching.value = true
  searched.value = false
  results.value = []
  selectedTrackId.value = null
  try {
    if (isAppIdQuery.value) {
      const resp = await fetch(`https://itunes.apple.com/lookup?id=${term}&country=${props.accountRegion}`)
      const json = await resp.json()
      results.value = json.results || []
    } else {
      results.value = await searchApps(term, props.accountRegion, 12)
    }
    searched.value = true
    emit('results-change', results.value)
  } catch (e) {
    console.error('Search failed:', e)
    results.value = []
    searched.value = true
    emit('results-change', [])
  } finally {
    searching.value = false
  }
}

function selectApp(app) {
  selectedTrackId.value = String(app.trackId)
  emit('app-selected', app)
}

// Expose for parent components
defineExpose({
  query,
  results,
  searching,
  searched,
  selectedTrackId,
  selectApp,
  onSearch,
})
</script>

<style scoped>
.app-search-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5, 6px);
}

.search-input__icon {
  color: var(--color-text-muted);
  font-size: 16px;
}

.app-search-bar__hint {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted);
  padding-left: var(--space-1, 4px);
}
</style>
