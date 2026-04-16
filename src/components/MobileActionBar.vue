<template>
  <!-- 底部固定操作栏 -->
  <div class="mobile-action-bar">
    <div class="mobile-action-bar__inner">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
// Pure layout component — no props, just a slot container
</script>

<style scoped>
.mobile-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  /* 毛玻璃背景 */
  background: rgba(255, 255, 255, 0.78);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--separator);
  /* 安全区 */
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-action-bar__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
}

/* 深色模式 */
.dark .mobile-action-bar {
  background: rgba(30, 30, 30, 0.78);
  border-top-color: rgba(255, 255, 255, 0.08);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-action-bar {
    border-top-width: 2px;
    background: rgba(255, 255, 255, 0.95);
  }

  .dark .mobile-action-bar {
    background: rgba(0, 0, 0, 0.95);
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-action-bar {
    transition: none;
  }
}
</style>
