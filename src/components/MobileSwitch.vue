<template>
  <!-- iOS 风格开关组件 -->
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-disabled="disabled"
    :disabled="disabled"
    :class="[
      'mobile-switch',
      {
        'mobile-switch--active': modelValue,
        'mobile-switch--disabled': disabled,
      }
    ]"
    :style="switchStyle"
    @click="toggle"
  >
    <span class="mobile-switch__thumb"></span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  activeColor: {
    type: String,
    default: ''
  },
  inactiveColor: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const switchStyle = computed(() => {
  const style = {}
  if (props.activeColor) {
    style['--switch-active-bg'] = props.activeColor
  }
  if (props.inactiveColor) {
    style['--switch-inactive-bg'] = props.inactiveColor
  }
  return style
})

const toggle = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<style scoped>
.mobile-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 51px;
  height: 31px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--switch-inactive-bg, var(--color-surface-muted));
  cursor: pointer;
  transition: background 0.3s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  padding: 0;
  flex-shrink: 0;
  /* Ensure minimum 44px tap target */
  min-width: var(--size-control-md);
  min-height: var(--size-control-md);
  box-sizing: content-box;
}

.mobile-switch--active {
  background: var(--switch-active-bg, var(--accent-blue));
}

/* Thumb (sliding circle) */
.mobile-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: var(--text-inverse);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.mobile-switch--active .mobile-switch__thumb {
  transform: translateX(20px);
}

/* Disabled state */
.mobile-switch--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Touch feedback */
@media (hover: none) and (pointer: coarse) {
  .mobile-switch:active {
    transform: scale(0.98);
  }
}

/* Desktop hover */
@media (hover: hover) and (pointer: fine) {
  .mobile-switch:hover:not(.mobile-switch--disabled) {
    filter: brightness(1.05);
  }
}

/* Dark mode */
.dark .mobile-switch {
  background: var(--switch-inactive-bg, rgba(255, 255, 255, 0.15));
}

.dark .mobile-switch--active {
  background: var(--switch-active-bg, var(--accent-blue));
}

.dark .mobile-switch__thumb {
  background: var(--text-inverse);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.2);
}

/* High contrast */
@media (prefers-contrast: high) {
  .mobile-switch {
    outline: 2px solid var(--color-border-strong);
    outline-offset: 1px;
  }

  .mobile-switch--active {
    outline-color: var(--accent-blue);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-switch,
  .mobile-switch__thumb {
    transition: none;
  }

  .mobile-switch:active {
    transform: none;
  }
}
</style>
