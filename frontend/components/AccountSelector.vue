<template>
  <div class="acct-sel">
    <div v-if="accounts.length === 0" class="no-acct">
      <span class="no-acct-text">暂无已保存的 Apple 账号</span>
      <button class="add-link" @click="$emit('add-account')">前往设置添加</button>
    </div>
    <div v-else class="sel-row">
      <label class="sel-label">Apple 账号</label>
      <select v-model="selectedEmail" class="acct-select" @change="onSelect">
        <option v-for="email in accounts" :key="email" :value="email">
          {{ email }}
        </option>
      </select>
      <button class="mgmt-btn" @click="$emit('add-account')" title="管理账号">+</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'add-account', 'select'])

const selectedEmail = ref(props.modelValue)

watch(() => props.modelValue, (v) => { if (v !== selectedEmail.value) selectedEmail.value = v })
watch(() => props.accounts, (newAccounts) => {
  if (!selectedEmail.value && newAccounts.length > 0) {
    selectedEmail.value = newAccounts[0]
    emit('update:modelValue', selectedEmail.value)
    emit('select', selectedEmail.value)
  }
  if (selectedEmail.value && !newAccounts.includes(selectedEmail.value)) {
    selectedEmail.value = newAccounts[0] || ''
    emit('update:modelValue', selectedEmail.value)
    emit('select', selectedEmail.value)
  }
}, { immediate: true })

function onSelect() {
  emit('update:modelValue', selectedEmail.value)
  emit('select', selectedEmail.value)
}
</script>

<style scoped>
.acct-sel {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-3-5) var(--space-4);
}
.no-acct {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.no-acct-text { font-size: var(--font-size-body); color: var(--color-text-muted); }
.add-link {
  background: none; border: none;
  color: var(--color-primary);
  font-size: var(--font-size-label);
  cursor: pointer; font-weight: 500;
}
.sel-row {
  display: flex; align-items: center; gap: var(--space-2-5);
}
.sel-label {
  font-size: var(--font-size-label); color: var(--color-text-muted);
  white-space: nowrap; flex-shrink: 0;
}
.acct-select {
  flex: 1; min-width: 0;
  padding: var(--space-2) var(--space-2-5);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-body);
  appearance: auto;
}
.mgmt-btn {
  flex-shrink: 0;
  width: var(--size-8); height: var(--size-8);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: 18px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; font-weight: 600;
}
</style>
