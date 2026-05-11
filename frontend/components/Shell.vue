<template>
  <div class="shell">
    <header class="shell-header">
      <div class="title">ipaTool</div>
      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <button class="logout" @click="$emit('logout')">登出</button>
    </header>

    <main class="shell-main">
      <component :is="currentTab" @navigate-settings="activeTab = 'settings'" />
    </main>
  </div>
</template>

<script setup>
import { defineAsyncComponent, ref, computed } from 'vue'

defineEmits(['logout'])

const Download = defineAsyncComponent(() => import('./DownloadShell.vue'))
const Archive = defineAsyncComponent(() => import('./ArchiveShell.vue'))
const SettingsShell = defineAsyncComponent(() => import('./SettingsShell.vue'))

const tabs = [
  { id: 'download', label: '下载' },
  { id: 'archive', label: '存档' },
  { id: 'settings', label: '设置' },
]

const activeTab = ref('download')
const currentTab = computed(() => {
  switch (activeTab.value) {
    case 'archive': return Archive
    case 'settings': return SettingsShell
    default: return Download
  }
})
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.shell-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #e5e5e7);
  background: var(--color-surface, #fff);
}
.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}
.tabs {
  display: flex;
  gap: 6px;
  flex: 1;
  margin-left: 16px;
}
.tabs button {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: var(--color-text-secondary, #666);
}
.tabs button.active {
  background: var(--color-primary-soft, #e6f4ee);
  color: var(--color-primary, #0a84ff);
  border-color: var(--color-primary, #0a84ff);
}
.logout {
  padding: 6px 12px;
  font-size: 13px;
  background: transparent;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-secondary);
}
.shell-main {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg, #f5f5f7);
}
</style>
