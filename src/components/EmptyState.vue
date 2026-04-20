<template>
  <!-- Loading skeleton mode -->
  <div
    v-if="type === 'loading'"
    class="empty-state"
  >
    <div class="skeleton skeleton--line skeleton--w80" />
    <div class="skeleton skeleton--line skeleton--w60" />
    <div class="skeleton skeleton--line skeleton--w70" />
  </div>

  <!-- Empty state mode -->
  <div
    v-else
    class="empty-state"
  >
    <div class="empty-state__icon">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line
          x1="12"
          y1="22.08"
          x2="12"
          y2="12"
        />
      </svg>
    </div>
    <p class="empty-state__text">
      {{ text || '暂无数据' }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'empty',
    validator: v => ['empty', 'loading'].includes(v)
  },
  text: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 48px 24px;
  text-align: center;
  background: transparent;
}

/* Skeleton */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.skeleton {
  background: var(--color-surface-muted, #f7f7f8);
  border-radius: 8px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  margin-bottom: 10px;
}
.dark .skeleton {
  background: var(--color-surface-muted, #27272a);
}
.skeleton--line {
  height: 16px;
}
.skeleton--w80 {
  width: 80%;
}
.skeleton--w60 {
  width: 60%;
}
.skeleton--w70 {
  width: 70%;
}

/* Empty */
.empty-state__icon {
  margin-bottom: 16px;
  opacity: 0.4;
  color: var(--color-text-muted, #6e6e80);
}
.dark .empty-state__icon {
  color: var(--color-text-muted, #a1a1aa);
}
.empty-state__text {
  font-size: 13px;
  color: var(--color-text-tertiary, #c0c0c0);
  margin: 0;
}
.dark .empty-state__text {
  color: var(--color-text-tertiary, #71717a);
}
</style>
