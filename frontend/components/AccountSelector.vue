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
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 14px 16px;
}
.no-acct {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.no-acct-text { font-size: 14px; color: var(--color-text-secondary, #888); }
.add-link {
  background: none; border: none; color: var(--color-primary, #0a84ff);
  font-size: 13px; cursor: pointer; font-weight: 500;
}
.sel-row {
  display: flex; align-items: center; gap: 10px;
}
.sel-label {
  font-size: 13px; color: var(--color-text-secondary, #888);
  white-space: nowrap; flex-shrink: 0;
}
.acct-select {
  flex: 1; min-width: 0; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-bg, #fff); color: var(--color-text);
  font-size: 14px; appearance: auto;
}
.mgmt-btn {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-bg, #fff); color: var(--color-primary, #0a84ff);
  font-size: 18px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; font-weight: 600;
}
</style>
