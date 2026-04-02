<template>
 <div
 class="tab-layout"
 :class="{ 'mobile-layout': isMobile }"
 >
 <!-- Desktop: Tab Bar -->
 <div
 v-if="!isMobile"
 class="desktop-tab-bar"
 >
 <div class="tab-bar-inner glass-modal">
 <button
 v-for="tab in tabs"
 :key="tab.id"
 :class="['tab-btn', { 'tab-btn-active': appStore.activeTab === tab.id }]"
 :title="tab.label"
 @click="appStore.activeTab = tab.id"
 >
 <span class="tab-indicator" />
 <div class="tab-btn-content">
 <el-badge
 v-if="tab.badge"
 :value="tab.badge"
 :max="99"
 class="tab-badge"
 >
 <svg
 class="tab-svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 v-html="tab.svgPath"
 />
 </el-badge>
 <svg
 v-else
 class="tab-svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 v-html="tab.svgPath"
 />
 <span class="tab-label">{{ tab.label }}</span>
 </div>
 </button>
 </div>
 </div>

 <!-- Content -->
 <div
 class="tab-content"
 :class="{ 'with-mobile-tabs': isMobile }"
 >
 <div class="tab-content-shell">
 <component
 :is="currentTabComponent"
 v-bind="currentTabProps"
 @app-selected="handleAppSelected"
 @download-started="handleDownloadStarted"
 @accounts-updated="handleAccountsUpdated"
 @remove-item="emit('remove-item', $event)"
 @clear-all="emit('clear-queue')"
 @logout="emit('logout')"
 />
 </div>
 </div>

 <!-- Mobile: Bottom Tab Bar -->
 <div
 v-if="isMobile"
 class="mobile-tab-wrap"
 >
 <div class="mobile-tab-bar glass-modal pb-safe">
 <button
 v-for="tab in tabs"
 :key="tab.id"
 :class="['mobile-tab-btn', { 'mobile-tab-btn-active': appStore.activeTab === tab.id }]"
 @click="appStore.activeTab = tab.id"
 >
 <span class="tab-indicator mobile-indicator" />
 <div class="mobile-tab-icon">
 <el-badge
 v-if="tab.badge"
 :value="tab.badge"
 :max="99"
 class="tab-badge"
 >
 <svg
 class="tab-svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 v-html="tab.svgPath"
 />
 </el-badge>
 <svg
 v-else
 class="tab-svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 v-html="tab.svgPath"
 />
 </div>
 <span class="mobile-tab-label">{{ tab.label }}</span>
 </button>
 </div>
 </div>
 </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import DownloadManager from './DownloadManager.vue'
import DownloadQueue from './DownloadQueue.vue'
import IpaManager from './IpaManager.vue'
import AppSubscription from './AppSubscription.vue'
import Settings from './Settings.vue'

const appStore = useAppStore()
const emit = defineEmits(['app-selected', 'download-started', 'accounts-updated', 'remove-item', 'clear-queue', 'logout'])
const isMobile = ref(false)

const checkMobile = () => {
 isMobile.value = window.innerWidth < 768
}

const handleAccountsUpdated = (v) => emit('accounts-updated', v)
const handleAppSelected = (app) => emit('app-selected', app)
const handleDownloadStarted = (task) => emit('download-started', task)

// SVG paths for tab icons — semantic, clear, consistent
const activeQueueCount = computed(() => appStore.taskQueue.filter(task => !['completed', 'ready'].includes(task?.status)).length)

const tabs = computed(() => [
 {
 id: 'download',
 label: '下载',
 svgPath: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
 badge: appStore.downloadState.selectedApp ? '1' : null
 },
 {
 id: 'queue',
 label: '队列',
 svgPath: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
 badge: activeQueueCount.value > 0 ? String(activeQueueCount.value) : null
 },
 {
 id: 'ipa',
 label: 'IPA',
 svgPath: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
 },
 {
 id: 'subscription',
 label: '订阅',
 svgPath: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
 },
 {
 id: 'settings',
 label: '设置',
 svgPath: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
 }
])

const currentTabComponent = computed(() => {
 const map = {
 download: DownloadManager,
 queue: DownloadQueue,
 ipa: IpaManager,
 subscription: AppSubscription,
 settings: Settings
 }
 return map[appStore.activeTab] || DownloadManager
})

const currentTabProps = computed(() => {
 if (appStore.activeTab === 'download') {
 return {
 selectedApp: appStore.downloadState.selectedApp,
 accountsUpdated: appStore.accountsUpdateCounter
 }
 }
 if (appStore.activeTab === 'queue') {
 return { queue: appStore.taskQueue }
 }
 return {}
})

onMounted(() => {
 checkMobile()
 window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
 window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.tab-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 120px);
}

.tab-content {
  flex: 1;
  min-height: 0;
}

.tab-content-shell {
  min-height: 100%;
}

.tab-content.with-mobile-tabs {
  padding-bottom: 80px;
}

@media (max-width: 767px) {
  .tab-content.with-mobile-tabs {
    padding-bottom: 96px;
  }
}
</style>
