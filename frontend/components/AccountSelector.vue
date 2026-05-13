<template>
  <div class="acct-sel" :class="{ 'account-select-bar--fused-bottom': accounts.length > 0 }">
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

    <!-- Single account: static chip (no arrow) -->
    <div
      v-else-if="accounts.length === 1"
      class="acct-chip"
    >
      <span class="acct-chip__dot" />
      <div class="acct-chip__content">
        <span class="acct-chip__email">{{ accounts[0] }}</span>
        <span v-if="accountRegions[accounts[0]]" class="acct-chip__region">{{ accountRegions[accounts[0]] }}</span>
      </div>
    </div>

    <!-- Multiple accounts: clickable chip with chevron arrow → bottom sheet -->
    <button
      v-else
      type="button"
      class="acct-chip acct-chip--clickable"
      @click="showPicker = true"
    >
      <span class="acct-chip__dot" />
      <div class="acct-chip__content">
        <span class="acct-chip__email">{{ displayEmail }}</span>
        <span v-if="accountRegions[displayEmail]" class="acct-chip__region">{{ accountRegions[displayEmail] }}</span>
      </div>
      <span class="acct-chip__arrow" v-html="chevronDownIcon" />
    </button>

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
                  <div class="picker-item__left">
                    <div class="picker-item__radio">
                      <div
                        v-if="selectedEmail === email"
                        class="picker-item__radio-fill"
                      />
                    </div>
                    <div class="picker-item__main">
                      <span class="picker-item__email">{{ email }}</span>
                      <span v-if="accountRegions[email]" class="picker-item__region">{{ accountRegions[email] }}</span>
                    </div>
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
import { ref, computed, watch } from 'vue'
import MobileButton from './MobileButton.vue'
import SvgIcon from './SvgIcon.vue'
import closeIcon from '../assets/icons/close.svg?raw'
import alertTriangleIcon from '../assets/icons/alert-triangle.svg?raw'
import chevronDownIcon from '../assets/icons/chevron-down.svg?raw'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  accountRegions: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'add-account', 'select'])

const selectedEmail = ref(props.modelValue)
const showPicker = ref(false)

const displayEmail = computed(() => selectedEmail.value || props.accounts[0] || '')

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
/* ═══════════════════════════════════════
   Root container
   ═══════════════════════════════════════ */
.acct-sel {
  width: 100%;
}

/* ─── Fused-bottom bar (sits right below search input) ─── */
.account-select-bar--fused-bottom {
  border-top: none;
  margin-top: -1px;
  border-radius: 0 0 14px 14px;
  padding: 10px 12px;
  background: var(--color-bg-surface, var(--color-surface));
  border: 1px solid var(--color-border);
}

/* ═══════════════════════════════════════
   No-account Alert
   ═══════════════════════════════════════ */
.acct-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-3-5, 14px);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: 14px;
}
.acct-alert__icon { flex-shrink: 0; margin-top: 2px; }
.acct-alert__svg { width: 20px; height: 20px; color: var(--color-warning, #f59e0b); }
.acct-alert__title { font-size: var(--font-size-body, 14px); font-weight: 600; color: var(--color-text); }
.acct-alert__desc { font-size: var(--font-size-caption, 12px); color: var(--color-text-muted); margin-top: var(--space-1, 4px); }

/* ═══════════════════════════════════════
   AccountChip (inline chip)
   ═══════════════════════════════════════ */
.acct-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--color-surface-muted);
  border: none;
  min-width: 0;
  text-align: left;
  cursor: default;
}

.acct-chip--clickable {
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.acct-chip--clickable:hover {
  background: var(--color-surface-hover);
  box-shadow: 0 0 0 1px var(--color-border);
}

/* Green dot */
.acct-chip__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34c759;
}

/* Email + region text group */
.acct-chip__content {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.acct-chip__email {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.acct-chip__region {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Chevron arrow for multi-account */
.acct-chip__arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  margin-left: auto;
}
.acct-chip__arrow :deep(svg) {
  width: 16px;
  height: 16px;
}

/* ═══════════════════════════════════════
   Bottom Sheet
   ═══════════════════════════════════════ */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 600px;
  background: var(--color-surface);
  border-radius: 16px 16px 0 0;
  max-height: min(70vh, 480px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sheet__handle {
  width: 36px;
  height: 4px;
  background: var(--color-border-divider, rgba(0,0,0,0.12));
  border-radius: 2px;
  margin: 12px auto 8px;
  flex-shrink: 0;
  cursor: pointer;
}
.sheet__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 16px;
  flex-shrink: 0;
}
.sheet__header-info { flex: 1; min-width: 0; }
.sheet__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 2px;
}
.sheet__subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
}
.sheet__close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
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
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

/* ═══════════════════════════════════════
   Picker List (radio-style)
   ═══════════════════════════════════════ */
.picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.picker-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}
.picker-item:hover { background: var(--color-surface-hover); }

/* Active / selected item — green background */
.picker-item--active {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.35);
}
.picker-item--active:hover {
  background: rgba(52, 199, 89, 0.16);
}

.picker-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

/* Radio circle */
.picker-item__radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-border-divider, rgba(0,0,0,0.15));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.picker-item--active .picker-item__radio {
  border-color: #34c759;
}
.picker-item__radio-fill {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #34c759;
}

.picker-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.picker-item__email {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-item__region {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ═══════════════════════════════════════
   Transitions
   ═══════════════════════════════════════ */
.sheet-fade-enter-active,
.sheet-fade-leave-active { transition: opacity 0.3s ease; }
.sheet-fade-enter-from,
.sheet-fade-leave-to { opacity: 0; }
.sheet-slide-enter-active,
.sheet-slide-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-slide-enter-from,
.sheet-slide-leave-to { transform: translateY(100%); }

/* ═══════════════════════════════════════
   Dark mode tweaks
   ═══════════════════════════════════════ */
:root.dark .acct-alert {
  background: rgba(245, 158, 11, 0.1);
}
:root.dark .picker-item {
  background: var(--color-surface);
  border-color: var(--color-surface-muted);
}
:root.dark .picker-item--active {
  background: rgba(52, 199, 89, 0.12);
  border-color: rgba(52, 199, 89, 0.3);
}
</style>
