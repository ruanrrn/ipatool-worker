<template>
  <!-- 通用弹窗：支持 center / bottom 两种模式 -->
  <Teleport to="body">
    <Transition :name="transitionName">
      <div v-if="modelValue" class="mobile-dialog" @click="onOverlayClick">
        <div
          class="mobile-dialog__panel"
          :class="[`mobile-dialog__panel--${position}`]"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <header v-if="title" class="mobile-dialog__header">
            <div class="mobile-dialog__title">{{ title }}</div>
            <button
              v-if="showClose"
              class="mobile-dialog__close"
              type="button"
              aria-label="关闭"
              @click="close"
            >
              ✕
            </button>
          </header>

          <div class="mobile-dialog__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="mobile-dialog__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  position: {
    type: String,
    default: 'center',
    validator: (v) => ['center', 'bottom'].includes(v)
  },
  closeOnClickOverlay: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: true
  },
  closeOnEsc: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])

const transitionName = computed(() => {
  return props.position === 'bottom' ? 'mobile-dialog-bottom' : 'mobile-dialog-center'
})

const close = () => emit('update:modelValue', false)

const onOverlayClick = () => {
  if (props.closeOnClickOverlay) close()
}

// 轻量的滚动锁定（仅在打开时）
let prevOverflow = ''
const lockScroll = () => {
  prevOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
}
const unlockScroll = () => {
  document.documentElement.style.overflow = prevOverflow || ''
}

watch(
  () => props.modelValue,
  (v) => {
    if (typeof document === 'undefined') return
    if (v) lockScroll()
    else unlockScroll()
  },
  { immediate: true }
)

// Esc 关闭
const onKeydown = (e) => {
  if (!props.modelValue) return
  if (!props.closeOnEsc) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  unlockScroll()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.mobile-dialog {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;

  background: var(--mask-overlay);
  backdrop-filter: blur(var(--radius-sheet));
  -webkit-tap-highlight-color: transparent;
}

.mobile-dialog__panel {
  width: 100%;
  max-width: 92vw;
  border: var(--border-width-thin) solid var(--separator);
  box-shadow: var(--shadow-none);

  background: color-mix(in srgb, var(--card-bg) 82%, transparent);
  backdrop-filter: blur(var(--radius-sheet));

  overflow: hidden;
}

.mobile-dialog__panel--center {
  margin: var(--space-4);
  border-radius: var(--radius-card);
}

.mobile-dialog__panel--bottom {
  align-self: flex-end;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  max-width: 100vw;
}

.mobile-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);

  padding: var(--space-4);
  border-bottom: var(--border-width-thin) solid var(--separator);
}

.mobile-dialog__title {
  font-family: var(--font-body);
  font-size: var(--font-size-lg-mobile);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.mobile-dialog__close {
  min-width: var(--size-control-md);
  min-height: var(--size-control-md);
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: none) and (pointer: coarse) {
  .mobile-dialog__close:active {
    transform: scale(0.98);
  }
}

.mobile-dialog__body {
  padding: var(--space-4);
  color: var(--text-primary);
  font-size: var(--font-size-base-mobile);

  max-height: 70vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-dialog__panel--bottom .mobile-dialog__body {
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
}

.mobile-dialog__footer {
  padding: var(--space-4);
  border-top: var(--border-width-thin) solid var(--separator);
}

/* ==================== Animations ==================== */

.mobile-dialog-center-enter-active,
.mobile-dialog-center-leave-active {
  transition: var(--transition-default);
}

.mobile-dialog-center-enter-from,
.mobile-dialog-center-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.mobile-dialog-center-enter-to,
.mobile-dialog-center-leave-from {
  opacity: 1;
  transform: scale(1);
}

.mobile-dialog-bottom-enter-active,
.mobile-dialog-bottom-leave-active {
  transition: var(--transition-default);
}

.mobile-dialog-bottom-enter-from,
.mobile-dialog-bottom-leave-to {
  opacity: 0;
}

.mobile-dialog-bottom-enter-from .mobile-dialog__panel--bottom,
.mobile-dialog-bottom-leave-to .mobile-dialog__panel--bottom {
  transform: translateY(var(--space-4));
}

.mobile-dialog-bottom-enter-to .mobile-dialog__panel--bottom,
.mobile-dialog-bottom-leave-from .mobile-dialog__panel--bottom {
  transform: translateY(0);
}

/* 深色模式 */
.dark .mobile-dialog__panel {
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
}

/* 高对比度 */
@media (prefers-contrast: high) {
  .mobile-dialog__panel {
    border-width: 2px;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-dialog-center-enter-active,
  .mobile-dialog-center-leave-active,
  .mobile-dialog-bottom-enter-active,
  .mobile-dialog-bottom-leave-active {
    transition: none;
  }
}
</style>
