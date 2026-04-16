<template>
  <!-- 移动端优化的按钮组件 -->
  <button
    :type="nativeType"
    :disabled="disabled || loading"
    :class="[
      'mobile-button',
      `mobile-button--${type}`,
      `mobile-button--${size}`,
      {
        'is-loading': loading,
        'is-disabled': disabled,
        'is-full-width': block,
      }
    ]"
    @click="handleClick"
  >
    <span v-if="loading" class="mobile-button__loading">
      <svg class="loading-spinner" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4">
          <animate attributeName="stroke-dasharray" from="1 100" to="89 100" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-dashoffset" from="0" to="-35" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </svg>
    </span>

    <span v-if="$slots.icon && !loading" class="mobile-button__icon">
      <slot name="icon"></slot>
    </span>

    <span v-if="$slots.default" class="mobile-button__content">
      <slot></slot>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'success', 'warning', 'danger'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  nativeType: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (e) => {
  if (!props.disabled && !props.loading) {
    emit('click', e)
  }
}
</script>

<style scoped>
.mobile-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-control);
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

/* 尺寸变体 */
.mobile-button--small {
  min-height: 40px;
  min-width: 40px;
  padding: 8px 16px;
  font-size: var(--font-size-xs-mobile);
}

.mobile-button--medium {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 20px;
  font-size: var(--font-size-sm-mobile);
}

.mobile-button--large {
  min-height: 56px;
  min-width: 56px;
  padding: 16px 24px;
  font-size: var(--font-size-base-mobile);
}

/* 全宽 */
.mobile-button.is-full-width {
  width: 100%;
}

/* 类型变体 */
.mobile-button--default {
  background: var(--card-bg);
  color: var(--accent-blue);
  border-color: var(--accent-blue-border-soft);
}

.mobile-button--primary {
  background: var(--accent-blue);
  color: var(--text-inverse);
  border-color: var(--accent-blue);
}

.mobile-button--success {
  background: var(--accent-green);
  color: var(--text-inverse);
  border-color: var(--accent-green);
}

.mobile-button--warning {
  background: var(--accent-amber);
  color: var(--text-inverse);
  border-color: var(--accent-amber);
}

.mobile-button--danger {
  background: var(--accent-red);
  color: var(--text-inverse);
  border-color: var(--accent-red);
}

/* 状态 */
.mobile-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.mobile-button.is-loading {
  cursor: wait;
  pointer-events: none;
}

/* 悬停效果（仅桌面） */
@media (hover: hover) and (pointer: fine) {
  .mobile-button--default:hover {
    background: rgba(10, 132, 255, 0.05);
  }

  .mobile-button--primary:hover {
    background: var(--color-primary-hover);
  }

  .mobile-button--success:hover {
    background: var(--color-success-hover);
  }

  .mobile-button--warning:hover {
    background: var(--color-warning-hover);
  }

  .mobile-button--danger:hover {
    background: var(--color-danger-hover);
  }
}

/* 触摸反馈（移动端） */
@media (hover: none) and (pointer: coarse) {
  .mobile-button:active {
    transform: scale(0.98);
  }

  .mobile-button--default:active {
    background: rgba(10, 132, 255, 0.1);
  }

  .mobile-button--primary:active {
    background: var(--color-primary-active);
  }
}

/* Loading 动画 */
.mobile-button__loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 图标 */
.mobile-button__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 内容 */
.mobile-button__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 深色模式 */
.dark .mobile-button--default {
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent-blue);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark .mobile-button--default:hover {
  background: rgba(10, 132, 255, 0.1);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-button {
    border-width: 2px;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-button,
  .loading-spinner {
    transition: none;
    animation: none;
  }

  .mobile-button:active {
    transform: none;
  }
}
</style>
