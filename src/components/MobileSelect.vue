<template>
  <!-- 底部弹出 ActionSheet 选择器 -->
  <div class="mobile-select">
    <!-- 触发器区域 -->
    <div
      :class="[
        'mobile-select__trigger',
        {
          'is-disabled': disabled,
          'is-active': isOpen,
          'has-value': hasValue
        }
      ]"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-disabled="disabled"
      tabindex="0"
      @click="openSheet"
      @keydown.enter="openSheet"
      @keydown.space.prevent="openSheet"
    >
      <span :class="['mobile-select__value', { 'mobile-select__placeholder': !hasValue }]">
        {{ displayLabel }}
      </span>
      <span class="mobile-select__arrow" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>

    <!-- 遮罩层 -->
    <Transition name="mobile-select__overlay">
      <div
        v-if="isOpen"
        class="mobile-select__overlay"
        @click="closeSheet"
      ></div>
    </Transition>

    <!-- ActionSheet 面板 -->
    <Transition name="mobile-select__sheet">
      <div v-if="isOpen" class="mobile-select__sheet" role="dialog" :aria-label="title || '选择选项'">
        <!-- 标题 -->
        <div v-if="title" class="mobile-select__header">
          <span class="mobile-select__title">{{ title }}</span>
        </div>

        <!-- 选项列表 -->
        <div class="mobile-select__body">
          <div
            v-for="option in options"
            :key="option.value"
            :class="[
              'mobile-select__option',
              {
                'is-selected': option.value === modelValue,
                'is-disabled': option.disabled
              }
            ]"
            role="option"
            :aria-selected="option.value === modelValue"
            :aria-disabled="option.disabled"
            @click="handleSelect(option)"
          >
            <span class="mobile-select__option-label">{{ option.label }}</span>
            <span v-if="option.value === modelValue" class="mobile-select__check" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5.5 10.5L8.5 13.5L14.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
        </div>

        <!-- 取消按钮（分隔） -->
        <div class="mobile-select__cancel-group">
          <button
            class="mobile-select__cancel"
            @click="closeSheet"
          >
            取消
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean, Object],
    default: undefined
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  title: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)

const hasValue = computed(() => props.modelValue !== undefined && props.modelValue !== null && props.modelValue !== '')

const selectedLabel = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue)
  return selected ? selected.label : ''
})

const displayLabel = computed(() => hasValue.value ? selectedLabel.value : props.placeholder)

function openSheet() {
  if (props.disabled) return
  isOpen.value = true
}

function closeSheet() {
  isOpen.value = false
}

function handleSelect(option) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closeSheet()
}
</script>

<style scoped>
/* ==================== 触发器 ==================== */
.mobile-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--size-control-lg);
  padding: var(--space-3) var(--space-4);
  background: var(--card-bg);
  border: 1px solid var(--separator);
  border-radius: var(--radius-control);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: var(--transition-default);
}

.mobile-select__trigger.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.mobile-select__trigger.is-active {
  border-color: var(--accent-blue-border-strong);
  box-shadow: 0 0 0 1px var(--accent-blue-border-soft);
}

.mobile-select__trigger:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

/* 触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .mobile-select__trigger:active {
    transform: scale(0.98);
  }
}

/* 桌面端 hover */
@media (hover: hover) and (pointer: fine) {
  .mobile-select__trigger:hover {
    border-color: var(--accent-blue-border-soft);
  }
}

/* ==================== 值与占位 ==================== */
.mobile-select__value {
  flex: 1;
  font-size: var(--font-size-base-mobile);
  font-family: var(--font-body);
  color: var(--text-primary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-select__placeholder {
  color: var(--text-tertiary);
}

/* ==================== 箭头图标 ==================== */
.mobile-select__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: transform 0.3s ease;
  flex-shrink: 0;
  margin-left: var(--space-2);
}

.is-active .mobile-select__arrow {
  transform: rotate(180deg);
}

/* ==================== 遮罩层 ==================== */
.mobile-select__overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: var(--mask-overlay);
}

/* 遮罩层过渡 */
.mobile-select__overlay-enter-active,
.mobile-select__overlay-leave-active {
  transition: opacity 0.3s ease;
}

.mobile-select__overlay-enter-from,
.mobile-select__overlay-leave-to {
  opacity: 0;
}

/* ==================== ActionSheet 面板 ==================== */
.mobile-select__sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

/* 面板滑入/滑出动画 */
.mobile-select__sheet-enter-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}

.mobile-select__sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease;
}

.mobile-select__sheet-enter-from,
.mobile-select__sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* ==================== 标题 ==================== */
.mobile-select__header {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--size-touch-mobile);
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width-thin) solid var(--separator);
}

.mobile-select__title {
  font-size: var(--font-size-sm-mobile);
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}

/* ==================== 选项列表 ==================== */
.mobile-select__body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  flex: 1;
}

/* ==================== 选项行 ==================== */
.mobile-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--size-touch-mobile);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
  border-bottom: var(--border-width-thin) solid var(--separator);
}

.mobile-select__option:last-child {
  border-bottom: none;
}

/* 选中项高亮 */
.mobile-select__option.is-selected {
  color: var(--accent-blue);
}

.mobile-select__option.is-selected .mobile-select__option-label {
  font-weight: 600;
  color: var(--accent-blue);
}

/* 禁用项 */
.mobile-select__option.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* 触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .mobile-select__option:active {
    background: var(--surface-muted);
    transform: scale(0.98);
  }
}

/* 桌面端 hover */
@media (hover: hover) and (pointer: fine) {
  .mobile-select__option:hover {
    background: var(--surface-muted);
  }
}

/* ==================== 选项文字 ==================== */
.mobile-select__option-label {
  flex: 1;
  font-size: var(--font-size-lg-mobile);
  font-family: var(--font-body);
  color: var(--text-primary);
  line-height: 1.5;
}

/* ==================== 勾选图标 ==================== */
.mobile-select__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue);
  flex-shrink: 0;
  margin-left: var(--space-2);
}

/* ==================== 取消按钮组 ==================== */
.mobile-select__cancel-group {
  padding: var(--space-2-5) var(--space-4);
  padding-bottom: calc(var(--space-2-5) + env(safe-area-inset-bottom, 0px));
}

.mobile-select__cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--size-touch-mobile);
  background: var(--card-bg);
  border: none;
  border-radius: var(--radius-control);
  font-size: var(--font-size-lg-mobile);
  font-weight: 600;
  font-family: var(--font-body);
  color: var(--accent-blue);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: var(--transition-default);
}

/* 取消按钮触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .mobile-select__cancel:active {
    transform: scale(0.98);
    background: var(--surface-muted);
  }
}

@media (hover: hover) and (pointer: fine) {
  .mobile-select__cancel:hover {
    background: var(--surface-muted);
  }
}

/* ==================== 深色模式 ==================== */
.dark .mobile-select__sheet {
  background: rgba(30, 30, 30, 0.85);
}

.dark .mobile-select__option {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.dark .mobile-select__header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

/* ==================== 高对比度模式 ==================== */
@media (prefers-contrast: high) {
  .mobile-select__trigger {
    border-width: 2px;
  }

  .mobile-select__option {
    border-bottom-width: 1px;
  }
}

/* ==================== 减少动画 ==================== */
@media (prefers-reduced-motion: reduce) {
  .mobile-select__overlay-enter-active,
  .mobile-select__overlay-leave-active,
  .mobile-select__sheet-enter-active,
  .mobile-select__sheet-leave-active {
    transition: none;
  }

  .mobile-select__arrow {
    transition: none;
  }

  .mobile-select__trigger,
  .mobile-select__option,
  .mobile-select__cancel {
    transition: none;
  }

  .mobile-select__trigger:active {
    transform: none;
  }

  .mobile-select__option:active {
    transform: none;
  }

  .mobile-select__cancel:active {
    transform: none;
  }
}
</style>
