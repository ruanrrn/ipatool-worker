<template>
  <!-- iOS SegmentedControl 风格单选组件 -->
  <div
    role="radiogroup"
    :class="[
      'mobile-radio',
      `mobile-radio--${size}`
    ]"
  >
    <!-- 背景滑块 -->
    <span
      class="mobile-radio__slider"
      :style="sliderStyle"
      aria-hidden="true"
    ></span>

    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      :aria-disabled="option.disabled || false"
      :disabled="option.disabled || false"
      :class="[
        'mobile-radio__item',
        {
          'mobile-radio__item--active': modelValue === option.value,
          'mobile-radio__item--disabled': option.disabled
        }
      ]"
      :ref="el =>setItemRef(el, index)"
      @click="select(option)"
    >
      <span class="mobile-radio__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
    // Array<{ label: string, value: string|number, disabled?: boolean }>
  },
  size: {
    type: String,
    default: 'medium',
    validator: (v) => ['small', 'medium', 'large'].includes(v)
  }
})

const emit = defineEmits(['update:modelValue'])

const itemRefs = ref({})
const sliderOffset = ref(0)
const sliderWidth = ref(0)

const setItemRef = (el, index) => {
  if (el) {
    itemRefs.value[index] = el
  }
}

const updateSlider = () => {
  const activeIndex = props.options.findIndex(o => o.value === props.modelValue)
  if (activeIndex < 0) {
    sliderOffset.value = 0
    sliderWidth.value = 0
    return
  }
  const el = itemRefs.value[activeIndex]
  if (el) {
    sliderOffset.value = el.offsetLeft
    sliderWidth.value = el.offsetWidth
  }
}

const sliderStyle = computed(() => {
  if (sliderWidth.value === 0) {
    return { opacity: 0 }
  }
  return {
    transform: `translateX(${sliderOffset.value}px)`,
    width: `${sliderWidth.value}px`,
    opacity: 1
  }
})

const select = (option) => {
  if (!option.disabled) {
    emit('update:modelValue', option.value)
  }
}

onMounted(() => {
  nextTick(updateSlider)
})

watch(() => props.modelValue, () => {
  nextTick(updateSlider)
})

watch(() => props.options, () => {
  nextTick(updateSlider)
}, { deep: true })
</script>

<style scoped>
.mobile-radio {
  position: relative;
  display: inline-flex;
  align-items: center;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  padding: var(--space-0-5);
  gap: var(--space-0-5);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

/* 尺寸变体 */
.mobile-radio--small {
  border-radius: calc(var(--radius-control) - 2px);
  padding: 3px;
  gap: 3px;
}

.mobile-radio--large {
  border-radius: var(--radius-card);
  padding: var(--space-1);
  gap: var(--space-1);
}

/* 背景滑块 */
.mobile-radio__slider {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--card-bg);
  border-radius: inherit;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
  pointer-events: none;
  z-index: 0;
}

/* 单项按钮 */
.mobile-radio__item {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  /* Minimum 44px touch target */
  min-height: var(--size-control-md);
  flex: 1;
  white-space: nowrap;
}

/* 尺寸变体 - 按钮内距与字号 */
.mobile-radio--small .mobile-radio__item {
  min-height: calc(var(--size-control-sm));
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs-mobile);
}

.mobile-radio--medium .mobile-radio__item {
  min-height: var(--size-control-md);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm-mobile);
}

.mobile-radio--large .mobile-radio__item {
  min-height: var(--size-control-lg);
  padding: var(--space-3) var(--space-5);
  font-size: var(--font-size-base-mobile);
}

/* 选中态 */
.mobile-radio__item--active {
  color: var(--text-primary);
}

/* 禁用态 */
.mobile-radio__item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 文字 */
.mobile-radio__label {
  pointer-events: none;
}

/* Touch feedback */
@media (hover: none) and (pointer: coarse) {
  .mobile-radio__item:active:not(.mobile-radio__item--disabled) {
    transform: scale(0.98);
  }
}

/* Desktop hover */
@media (hover: hover) and (pointer: fine) {
  .mobile-radio__item:hover:not(.mobile-radio__item--active):not(.mobile-radio__item--disabled) {
    color: var(--text-primary);
  }
}

/* Focus visible (keyboard) */
.mobile-radio__item:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: -2px;
  border-radius: calc(var(--radius-control) - 2px);
}

/* Dark mode */
.dark .mobile-radio {
  background: rgba(255, 255, 255, 0.08);
}

.dark .mobile-radio__slider {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.12);
}

.dark .mobile-radio__item {
  color: var(--text-secondary);
}

.dark .mobile-radio__item--active {
  color: var(--text-inverse);
}

/* High contrast */
@media (prefers-contrast: high) {
  .mobile-radio {
    outline: 2px solid var(--color-border-strong);
    outline-offset: -2px;
  }

  .mobile-radio__slider {
    outline: 1px solid var(--text-primary);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-radio__slider {
    transition: none;
  }

  .mobile-radio__item {
    transition: none;
  }

  .mobile-radio__item:active {
    transform: none;
  }
}
</style>
