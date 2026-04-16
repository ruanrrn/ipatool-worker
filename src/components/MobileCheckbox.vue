<template>
  <!-- 移动端复选框组件 -->
  <label
    :class="[
      'mobile-checkbox',
      {
        'mobile-checkbox--checked': modelValue,
        'mobile-checkbox--disabled': disabled,
      }
    ]"
    :aria-disabled="disabled"
  >
    <input
      type="checkbox"
      class="mobile-checkbox__input"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="mobile-checkbox__box">
      <svg
        class="mobile-checkbox__check"
        viewBox="0 0 12 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="1.5 5 4.5 8 10.5 2" />
      </svg>
    </span>
    <span v-if="label" class="mobile-checkbox__label">{{ label }}</span>
  </label>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const onChange = (e) => {
  if (!props.disabled) {
    emit('update:modelValue', e.target.checked)
  }
}
</script>

<style scoped>
.mobile-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2-5);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* Minimum 44px touch target */
  min-height: var(--size-control-md);
  padding: var(--space-1) 0;
  box-sizing: border-box;
}

/* Hidden native input */
.mobile-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Custom checkbox box */
.mobile-checkbox__box {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border-strong);
  border-radius: calc(var(--radius-control) * 0.5);
  background: var(--card-bg);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

/* Check mark */
.mobile-checkbox__check {
  width: 12px;
  height: 10px;
  color: var(--text-inverse);
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Checked state */
.mobile-checkbox--checked .mobile-checkbox__box {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.mobile-checkbox--checked .mobile-checkbox__check {
  opacity: 1;
  transform: scale(1);
}

/* Label */
.mobile-checkbox__label {
  font-size: var(--font-size-base-mobile);
  font-family: var(--font-body);
  color: var(--text-primary);
  line-height: 1.4;
}

/* Disabled state */
.mobile-checkbox--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Focus visible (keyboard accessibility) */
.mobile-checkbox__input:focus-visible + .mobile-checkbox__box {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

/* Touch feedback */
@media (hover: none) and (pointer: coarse) {
  .mobile-checkbox:active {
    transform: scale(0.98);
  }
}

/* Desktop hover */
@media (hover: hover) and (pointer: fine) {
  .mobile-checkbox:hover:not(.mobile-checkbox--disabled) .mobile-checkbox__box {
    border-color: var(--accent-blue);
  }
}

/* Dark mode */
.dark .mobile-checkbox__box {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.dark .mobile-checkbox--checked .mobile-checkbox__box {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.dark .mobile-checkbox__label {
  color: var(--text-primary);
}

/* High contrast */
@media (prefers-contrast: high) {
  .mobile-checkbox__box {
    border-width: 3px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-checkbox,
  .mobile-checkbox__box,
  .mobile-checkbox__check {
    transition: none;
  }

  .mobile-checkbox:active {
    transform: none;
  }
}
</style>
