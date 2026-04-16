<template>
  <!-- 确认对话框：可组件化使用，也支持 Confirm.show 服务式调用 -->
  <Teleport to="body">
    <Transition name="mobile-confirm" @after-leave="emitAfterLeave">
      <div v-if="modelValue" class="mobile-confirm" @click="onOverlayClick">
        <div class="mobile-confirm__panel" role="dialog" aria-modal="true" @click.stop>
          <header v-if="title" class="mobile-confirm__header">
            <div class="mobile-confirm__title">{{ title }}</div>
          </header>

          <div v-if="message" class="mobile-confirm__message">{{ message }}</div>

          <div class="mobile-confirm__actions">
            <button class="mobile-confirm__btn mobile-confirm__btn--cancel" type="button" @click="onCancel">
              {{ cancelTextComputed }}
            </button>
            <div class="mobile-confirm__divider" />
            <button
              class="mobile-confirm__btn"
              :class="confirmBtnClass"
              type="button"
              @click="onConfirm"
            >
              {{ confirmTextComputed }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { computed, createApp, h, nextTick } from 'vue'

const MobileConfirm = {
  name: 'MobileConfirm',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    confirmText: { type: String, default: '' },
    cancelText: { type: String, default: '' },
    type: {
      type: String,
      default: 'default',
      validator: (v) => ['default', 'danger'].includes(v)
    },
    closeOnClickOverlay: { type: Boolean, default: true }
  },
  emits: ['update:modelValue', 'confirm', 'cancel', 'after-leave'],
  setup(props, { emit }) {
    const confirmTextComputed = computed(() => props.confirmText || '确认')
    const cancelTextComputed = computed(() => props.cancelText || '取消')

    const confirmBtnClass = computed(() => {
      return props.type === 'danger' ? 'mobile-confirm__btn--danger' : 'mobile-confirm__btn--primary'
    })

    const close = () => emit('update:modelValue', false)

    const onConfirm = () => {
      emit('confirm')
      close()
    }

    const onCancel = () => {
      emit('cancel')
      close()
    }

    const onOverlayClick = () => {
      if (props.closeOnClickOverlay) onCancel()
    }

    const emitAfterLeave = () => emit('after-leave')

    return {
      confirmTextComputed,
      cancelTextComputed,
      confirmBtnClass,
      onConfirm,
      onCancel,
      onOverlayClick,
      emitAfterLeave
    }
  }
}

export default MobileConfirm

export const Confirm = {
  /**
   * Confirm.show({ title, message, confirmText, cancelText, type }) -> Promise<boolean>
   */
  show(options = {}) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve(false)
        return
      }

      const container = document.createElement('div')
      document.body.appendChild(container)

      let settled = false

      const app = createApp({
        name: 'MobileConfirmHost',
        data() {
          return { visible: false }
        },
        mounted() {
          // 让 Transition 有 enter
          nextTick(() => {
            this.visible = true
          })
        },
        methods: {
          settle(val) {
            if (settled) return
            settled = true
            resolve(!!val)
          },
          handleConfirm() {
            this.settle(true)
            this.visible = false
          },
          handleCancel() {
            this.settle(false)
            this.visible = false
          },
          handleAfterLeave() {
            app.unmount()
            container.remove()
          }
        },
        render() {
          return h(MobileConfirm, {
            ...options,
            modelValue: this.visible,
            'onUpdate:modelValue': (v) => {
              this.visible = v
              if (!v && !settled) this.settle(false)
            },
            onConfirm: this.handleConfirm,
            onCancel: this.handleCancel,
            onAfterLeave: this.handleAfterLeave
          })
        }
      })

      app.mount(container)
    })
  }
}
</script>

<style scoped>
.mobile-confirm {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  padding: var(--space-4);
  background: var(--mask-overlay);
  backdrop-filter: blur(var(--radius-sheet));
  -webkit-tap-highlight-color: transparent;
}

.mobile-confirm__panel {
  width: 90vw;
  max-width: 420px;
  border-radius: var(--radius-card);
  border: var(--border-width-thin) solid var(--separator);

  background: color-mix(in srgb, var(--card-bg) 84%, transparent);
  backdrop-filter: blur(var(--radius-sheet));

  overflow: hidden;
}

.mobile-confirm__header {
  padding: var(--space-4) var(--space-4) var(--space-3);
}

.mobile-confirm__title {
  font-family: var(--font-body);
  font-size: var(--font-size-lg-mobile);
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
}

.mobile-confirm__message {
  padding: 0 var(--space-4) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--font-size-base-mobile);
  color: var(--text-secondary);
  text-align: center;
  white-space: pre-wrap;
}

.mobile-confirm__actions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  border-top: var(--border-width-thin) solid var(--separator);
}

.mobile-confirm__divider {
  width: 1px;
  background: var(--separator);
}

.mobile-confirm__btn {
  min-height: var(--size-control-md);
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-lg-mobile);
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
}

.mobile-confirm__btn--cancel {
  color: var(--text-secondary);
}

.mobile-confirm__btn--primary {
  color: var(--accent-blue);
}

.mobile-confirm__btn--danger {
  color: var(--accent-red);
}

@media (hover: none) and (pointer: coarse) {
  .mobile-confirm__btn:active {
    transform: scale(0.98);
  }
}

/* 深色模式 */
.dark .mobile-confirm__panel {
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
}

/* 高对比度 */
@media (prefers-contrast: high) {
  .mobile-confirm__panel {
    border-width: 2px;
  }
}

/* 动画：轻微底部滑入 */
.mobile-confirm-enter-active,
.mobile-confirm-leave-active {
  transition: var(--transition-default);
}

.mobile-confirm-enter-from,
.mobile-confirm-leave-to {
  opacity: 0;
}

.mobile-confirm-enter-from .mobile-confirm__panel,
.mobile-confirm-leave-to .mobile-confirm__panel {
  transform: translateY(var(--space-2));
}

.mobile-confirm-enter-to .mobile-confirm__panel,
.mobile-confirm-leave-from .mobile-confirm__panel {
  transform: translateY(0);
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-confirm-enter-active,
  .mobile-confirm-leave-active {
    transition: none;
  }
}
</style>
