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
      <input
        v-model="manualId"
        type="text"
        class="vs-id-input"
        placeholder="输入版本 external_identifier"
      />
    </div>
  </div>
  <div v-else class="vs empty">
    <span>请先在搜索中选择一个应用</span>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

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
  background: var(--color-surface, #fff);
  border-radius: 10px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.vs.empty { text-align: center; color: var(--color-text-secondary, #999); font-size: 13px; padding: 20px; }
.vs-app { display: flex; align-items: center; gap: 12px; }
.vs-icon { width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; }
.vs-details { flex: 1; min-width: 0; }
.vs-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
.vs-artist { font-size: 13px; color: var(--color-text-secondary, #888); }
.vs-row { display: flex; align-items: flex-start; gap: 10px; }
.vs-label { font-size: 13px; color: var(--color-text-secondary, #888); white-space: nowrap; flex-shrink: 0; padding-top: 3px; }
.vs-opts { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.vs-radio {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 8px; border: 1px solid var(--color-border, #ddd);
  cursor: pointer; font-size: 14px; transition: all 0.15s;
}
.vs-radio.active { border-color: var(--color-primary, #0a84ff); background: rgba(10,132,255,0.05); }
.vs-radio input[type="radio"] { accent-color: var(--color-primary, #0a84ff); }
.vs-manual { padding: 0; }
.vs-id-input {
  width: 100%; padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-bg, #f8f8f8); color: var(--color-text);
  font-size: 14px; box-sizing: border-box; outline: none;
}
.vs-id-input:focus { border-color: var(--color-primary, #0a84ff); }
</style>
