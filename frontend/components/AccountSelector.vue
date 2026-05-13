<template>
  <div class="acct-sel">
    <!-- No accounts: alert -->
    <div
      v-if="accounts.length === 0"
      class="acct-alert"
    >
      <div class="acct-alert__icon">
        <SvgIcon class="acct-alert__svg" :icon="alertTriangleIcon" />
      </div>
      <div class="acct-alert__content">
        <div class="acct-alert__title">
          暂无已保存的 Apple 账号
        </div>
        <p class="acct-alert__desc">
          请先在设置中添加 Apple ID，然后才能下载应用。
        </p>
        <MobileButton
          type="primary"
          size="small"
          plain
          class="mt-2"
          @click="$emit('add-account')"
        >
          前往设置添加
        </MobileButton>
      </div>
    </div>

    <!-- Single account: static chip -->
    <div
      v-else-if="accounts.length === 1"
      class="acct-chip-bar"
    >
      <div class="acct-chip">
        <div class="acct-chip__content">
          <span class="acct-chip__email">{{ accounts[0] }}</span>
          <span v-if="accountRegions[accounts[0]]" class="acct-chip__region">{{ accountRegions[accounts[0]] }}</span>
        </div>
      </div>
    </div>

    <!-- Multiple accounts: clickable chip → bottom sheet -->
    <div
      v-else
      class="acct-chip-bar"
    >
      <button
        type="button"
        class="acct-chip acct-chip--clickable"
        @click="showPicker = true"
      >
        <div class="acct-chip__content">
          <span class="acct-chip__email">{{ selectedEmail || accounts[0] }}</span>
          <span v-if="accountRegions[selectedEmail || accounts[0]]" class="acct-chip__region">{{ accountRegions[selectedEmail || accounts[0]] }}</span>
        </div>
        <span class="acct-chip__arrow">▾</span>
      </button>
    </div>

    <!-- Bottom Sheet Picker -->
    <Transition name="sheet-fade">
      <div
        v-if="showPicker"
        class="sheet-overlay"
        @click.self="showPicker = false"
      >
        <Transition name="sheet-slide">
          <div
            v-if="showPicker"
            class="sheet"
          >
            <div
              class="sheet__handle"
              @click="showPicker = false"
            />
            <div class="sheet__header">
              <div class="sheet__header-info">
                <h3 class="sheet__title">
                  选择账号
                </h3>
                <p class="sheet__subtitle">
                  切换下载使用的 Apple ID
                </p>
              </div>
              <button
                class="sheet__close"
                @click="showPicker = false"
              >
                <SvgIcon
                  class="w-5 h-5"
                  :icon="closeIcon"
                />
              </button>
            </div>
            <div class="sheet__body">
              <div class="picker-list">
                <button
                  v-for="email in accounts"
                  :key="email"
                  type="button"
                  class="picker-item"
                  :class="{ 'picker-item--active': selectedEmail === email }"
                  @click="pickAccount(email)"
                >
                  <div class="picker-item__main">
                    <span class="picker-item__email">{{ email }}</span>
                    <span v-if="accountRegions[email]" class="picker-item__region">{{ accountRegions[email] }}</span>
                  </div>
                  <div class="picker-item__radio">
                    <div
                      v-if="selectedEmail === email"
                      class="picker-item__radio-fill"
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import MobileButton from './MobileButton.vue'
import SvgIcon from './SvgIcon.vue'
import closeIcon from '../assets/icons/close.svg?raw'
import alertTriangleIcon from '../assets/icons/alert-triangle.svg?raw'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  accountRegions: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'add-account', 'select'])

const selectedEmail = ref(props.modelValue)
const showPicker = ref(false)

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

function pickAccount(email) {
  selectedEmail.value = email
  showPicker.value = false
  emit('update:modelValue', email)
  emit('select', email)
}
</script>

<style scoped>
/* ─── Alert ─── */
.acct-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3-5);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-xl);
}
.acct-alert__icon { flex-shrink: 0; margin-top: 2px; }
.acct-alert__svg { width: 20px; height: 20px; color: var(--color-warning, #f59e0b); }
.acct-alert__title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.acct-alert__desc { font-size: var(--font-size-caption); color: var(--color-text-muted); margin-top: var(--space-1); }

/* ─── Chip Bar ─── */
.acct-chip-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.acct-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 46px;
  padding: var(--space-2-5) var(--space-3-5);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  min-width: 0;
}

:deep(.account-picker-fused) .acct-chip,
.account-picker-fused .acct-chip,
.acct-sel.account-picker-fused .acct-chip {
  border-top-color: var(--color-border-light);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: var(--color-surface-muted);
}

:deep(.account-picker-fused) .acct-alert,
.account-picker-fused .acct-alert,
.acct-sel.account-picker-fused .acct-alert {
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

.acct-chip--clickable {
  cursor: pointer;
  background: var(--color-surface-muted);
  transition: background 0.15s, border-color 0.15s;
}

.acct-chip--clickable:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-border);
}

.acct-chip__content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.acct-chip__email {
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.acct-chip__region {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  padding: 1px var(--space-1-5);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}

.acct-chip__arrow {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* ─── Sheet ─── */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--overlay-sheet);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 600px;
  background: var(--color-surface);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  max-height: min(70vh, 480px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sheet__handle {
  width: 36px;
  height: 4px;
  background: var(--color-border-divider);
  border-radius: var(--radius-xs);
  margin: var(--space-3) auto var(--space-2);
  flex-shrink: 0;
  cursor: pointer;
}
.sheet__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4) var(--space-4);
  flex-shrink: 0;
}
.sheet__header-info { flex: 1; min-width: 0; }
.sheet__title {
  font-size: var(--font-size-heading);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--space-0-5);
}
.sheet__subtitle {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin: 0;
}
.sheet__close {
  width: var(--size-8);
  height: var(--size-8);
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-muted);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 0.2s;
}
.sheet__close:hover { background: var(--color-surface-hover); }
.sheet__body {
  padding: 0 var(--space-4) var(--space-4);
  overflow-y: auto;
  flex: 1;
}

/* ─── Picker List ─── */
.picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3-5) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}
.picker-item:hover { background: var(--color-surface-hover); }
.picker-item--active {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
}
.picker-item__main { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.picker-item__email {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-item__region {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}
.picker-item__radio {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border-divider);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.picker-item__radio-fill {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

/* ─── Transitions ─── */
.sheet-fade-enter-active,
.sheet-fade-leave-active { transition: opacity 0.3s ease; }
.sheet-fade-enter-from,
.sheet-fade-leave-to { opacity: 0; }
.sheet-slide-enter-active,
.sheet-slide-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-slide-enter-from,
.sheet-slide-leave-to { transform: translateY(100%); }

/* ─── Dark mode ─── */
:root.dark .acct-alert {
  background: rgba(245, 158, 11, 0.1);
}
:root.dark .picker-item {
  background: var(--color-surface);
  border-color: var(--color-surface-muted);
}
:root.dark .picker-item--active {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
}
</style>
