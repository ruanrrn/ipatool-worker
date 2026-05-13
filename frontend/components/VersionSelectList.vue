<template>
  <div
    v-if="app"
    class="vs"
  >
    <div class="vs-row">
      <span class="vs-label">版本</span>
      <div class="vs-opts">
        <label
          class="vs-radio"
          :class="{ active: mode === 'latest' }"
        >
          <input
            v-model="mode"
            type="radio"
            value="latest"
          >
          <span>{{ app.version ? `最新 (v${app.version})` : '最新版本' }}</span>
        </label>
        <label
          class="vs-radio"
          :class="{ active: mode === 'manual' }"
        >
          <input
            v-model="mode"
            type="radio"
            value="manual"
          >
          <span>手动输入版本 ID</span>
        </label>
      </div>
    </div>

    <div
      v-if="mode === 'manual'"
      class="vs-manual"
    >
      <MobileInput
        v-model="manualId"
        type="text"
        placeholder="输入版本 external_identifier"
        clearable
      />
    </div>
  </div>
  <div
    v-else
    class="vs empty"
  >
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.vs.empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-label);
  padding: var(--space-5);
}

.vs-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.vs-label {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  font-weight: 600;
}

.vs-opts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.vs-radio {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 46px;
  padding: var(--space-2-5) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  font-size: var(--font-size-body);
  color: var(--color-text);
  transition: all 0.15s;
}

.vs-radio.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.vs-radio input[type="radio"] {
  accent-color: var(--color-primary);
}

.vs-manual {
  padding: 0;
}
</style>
