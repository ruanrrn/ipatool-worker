<template>
  <!-- 列表项左滑删除组件 -->
  <div
    class="mobile-swipe-cell"
    :class="{ 'is-disabled': disabled }"
  >
    <div
      ref="wrapperRef"
      class="mobile-swipe-cell__wrapper"
      :style="wrapperStyle"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @transitionend="onTransitionEnd"
    >
      <div class="mobile-swipe-cell__content">
        <slot></slot>
      </div>
      <div class="mobile-swipe-cell__right" ref="rightRef">
        <slot name="right"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['open', 'close'])

const THRESHOLD = 80
const BUTTON_WIDTH = 80

const wrapperRef = ref(null)
const rightRef = ref(null)

const offsetX = ref(0)
const touching = ref(false)
const startOffsetX = ref(0)
const startX = ref(0)
const startY = ref(0)
const direction = ref(null) // 'horizontal' | 'vertical' | null
const opened = ref(false)

const wrapperStyle = computed(() => {
  return {
    transform: `translateX(${offsetX.value}px)`,
    transition: touching.value ? 'none' : 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1)'
  }
})

function onTouchStart(e) {
  if (props.disabled) return

  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  startOffsetX.value = offsetX.value
  direction.value = null
  touching.value = true
}

function onTouchMove(e) {
  if (props.disabled || !touching.value) return

  const touch = e.touches[0]
  const dx = touch.clientX - startX.value
  const dy = touch.clientY - startY.value

  // Determine direction on first significant move
  if (!direction.value) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
    direction.value = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
  }

  if (direction.value === 'vertical') {
    touching.value = false
    return
  }

  // Prevent scroll when swiping horizontally
  e.preventDefault()

  // Calculate new offset: swiping left reveals right action area
  let newOffset = startOffsetX.value + dx

  // Clamp: max 0 (closed), min -BUTTON_WIDTH (fully open)
  // Allow slight overscroll for natural feel
  if (newOffset > 0) {
    newOffset = newOffset * 0.2 // rubber-band effect
  } else if (newOffset < -BUTTON_WIDTH) {
    const overDrag = newOffset + BUTTON_WIDTH
    newOffset = -BUTTON_WIDTH + overDrag * 0.2
  }

  offsetX.value = newOffset
}

function onTouchEnd() {
  if (props.disabled || !touching.value) return
  touching.value = false

  // Determine snap position based on threshold
  if (offsetX.value <= -THRESHOLD) {
    // Snap open
    offsetX.value = -BUTTON_WIDTH
    if (!opened.value) {
      opened.value = true
      emit('open')
    }
  } else {
    // Snap closed
    offsetX.value = 0
    if (opened.value) {
      opened.value = false
      emit('close')
    }
  }
}

function onTransitionEnd() {
  // Ensure state is consistent after animation
  if (offsetX.value === 0 && opened.value) {
    opened.value = false
    emit('close')
  }
}

// Public methods: close the swipe cell programmatically
function close() {
  offsetX.value = 0
  if (opened.value) {
    opened.value = false
    emit('close')
  }
}

function open() {
  offsetX.value = -BUTTON_WIDTH
  if (!opened.value) {
    opened.value = true
    emit('open')
  }
}

defineExpose({ close, open })

onBeforeUnmount(() => {
  touching.value = false
})
</script>

<style scoped>
.mobile-swipe-cell {
  position: relative;
  overflow: hidden;
  width: 100%;
  -webkit-user-select: none;
  user-select: none;
}

.mobile-swipe-cell.is-disabled {
  pointer-events: none;
}

.mobile-swipe-cell__wrapper {
  position: relative;
  display: flex;
  width: 100%;
  will-change: transform;
}

.mobile-swipe-cell__content {
  flex: 1;
  min-width: 0;
}

.mobile-swipe-cell__right {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: stretch;
  width: 80px;
  overflow: hidden;
}

/* Default styling for action buttons inside right slot */
.mobile-swipe-cell__right :deep(.mobile-swipe-cell__action) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  min-height: var(--size-control-md);
  background: var(--accent-red);
  color: var(--text-inverse);
  font-size: var(--font-size-sm-mobile);
  font-family: var(--font-body);
  font-weight: 500;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mobile-swipe-cell__right :deep(.mobile-swipe-cell__action:active) {
  opacity: 0.8;
  transform: scale(0.98);
}

/* 深色模式 */
.dark .mobile-swipe-cell__right :deep(.mobile-swipe-cell__action) {
  background: var(--color-danger-hover);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-swipe-cell__right :deep(.mobile-swipe-cell__action) {
    border: 2px solid var(--text-inverse);
    font-weight: 700;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-swipe-cell__wrapper {
    transition: none !important;
  }
}
</style>
