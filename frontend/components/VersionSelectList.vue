<template>
  <div v-if="app" class="vs">
    <!-- Selected app info -->
    <div class="vs-app">
      <img v-if="app.artworkUrl60" :src="app.artworkUrl60" class="vs-icon" alt="" />
      <div class="vs-details">
        <div class="vs-name">{{ app.trackName }}</div>
        <div class="vs-artist">{{ app.artistName }}</div>
      </div>
    </div>

    <!-- Version selection -->
    <div class="vs-row">
      <span class="vs-label">版本</span>
      <div class="vs-opts">
        <label class="vs-radio" :class="{ active: mode === 'latest' }">
          <input type="radio" v-model="mode" value="latest" />
          <span>{{ app.version ? `最新 (v${app.version})` : '最新版本' }}</span>
        </label>
        <label class="vs-radio" :class="{ active: mode === 'manual' }">
          <input type="radio" v-model="mode" value="manual" />
          <span>手动输入版本 ID</span>
        </label>
      </div>
    </div>

    <!-- Manual version ID -->
    <div v-if="mode === 'manual'" class="vs-manual">
      <MobileInput
        v-model="manualId"
        type="text"
        placeholder="输入版本 external_identifier"
        clearable
      />
    </div>
  </div>
  <div v-else class="vs empty">
    <span>请先在搜索中选择一个应用</span>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import MobileInput from './MobileInput.vue'

const props = defineProps({
  app: { type: Object, default: null },
})

const emit = defineEmits(['version-change'])

const mode = ref('latest')
const manualId = ref('')

const resolvedId = computed(() => {
  if (!props.app) return ''
  return mode.value === 'manual' ? manualId.value.trim() : ''
})

watch(resolvedId, (v) => emit('version-change', v))
watch(mode, (m) => {
  if (m === 'latest') { manualId.value = ''; emit('version-change', '') }
  else emit('version-change', manualId.value.trim())
})
watch(() => props.app, () => { mode.value = 'latest'; manualId.value = '' })
</script>

<style scoped>
.vs {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-3-5) var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.vs.empty { text-align: center; color: var(--color-text-muted); font-size: var(--font-size-label); padding: var(--space-5); }
.vs-app { display: flex; align-items: center; gap: var(--space-3); }
.vs-icon {
  width: var(--size-12); height: var(--size-12);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}
.vs-details { flex: 1; min-width: 0; }
.vs-name { font-size: var(--font-size-section); font-weight: 600; margin-bottom: var(--space-0-5); }
.vs-artist { font-size: var(--font-size-label); color: var(--color-text-muted); }
.vs-row { display: flex; align-items: flex-start; gap: var(--space-2-5); }
.vs-label {
  font-size: var(--font-size-label); color: var(--color-text-muted);
  white-space: nowrap; flex-shrink: 0; padding-top: 3px;
}
.vs-opts { display: flex; flex-direction: column; gap: var(--space-1-5); flex: 1; }
.vs-radio {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border);
  cursor: pointer; font-size: var(--font-size-body);
  transition: all 0.15s;
}
.vs-radio.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.vs-radio input[type="radio"] { accent-color: var(--color-primary); }
.vs-manual { padding: 0; }
</style>
