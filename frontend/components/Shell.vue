<template>
  <div class="flex flex-col h-full">
    <header class="flex items-center gap-4 px-4 py-3 border-b border-bdr dark:border-bdr-dark bg-surface dark:bg-surface-dark">
      <div class="text-lg font-semibold text-txt dark:text-txt-dark">ipaTool</div>
      <div class="flex gap-2 flex-1 ml-4">
        <button
          v-for="t in tabs"
          :key="t.id"
          :class="['px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors', activeTab === t.id ? 'bg-primary-soft dark:bg-primary-soft-dark text-primary border border-primary' : 'text-txt-secondary dark:text-txt-dark-secondary bg-transparent border border-transparent']"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <button class="px-3 py-1.5 text-sm bg-transparent border border-bdr dark:border-bdr-dark rounded-md text-txt-secondary dark:text-txt-dark-secondary cursor-pointer" @click="$emit('logout')">登出</button>
    </header>
    <main class="flex-1 overflow-y-auto bg-surface-page dark:bg-surface-dark-page">
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
