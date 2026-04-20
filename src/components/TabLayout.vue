<template>
  <div
    class="tab-layout"
    :class="{ 'mobile-layout': isMobile }"
  >
    <div
      v-if="!isMobile"
      class="desktop-tabs"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['desktop-tab', appStore.activeTab === tab.id ? 'is-active' : '']"
        @click="selectTab(tab.id)"
      >
        <MobileBadge
          v-if="tab.badge"
          :value="tab.badge"
        >
          <svg
            class="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <component
              :is="node.tag"
              v-for="(node, index) in tab.iconNodes"
              :key="index"
              v-bind="node.attrs"
            />
          </svg>
        </MobileBadge>
        <svg
          v-else
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div
      class="tab-content"
      :class="{ 'with-mobile-tabs': isMobile }"
    >
      <!-- Sub page: Appearance -->
      <Appearance
        v-if="subPage === 'appearance'"
        @back="subPage = null"
      />

      <!-- Sub page: Account Manager -->
      <AccountManager
        v-else-if="subPage === 'account'"
        @close="subPage = null"
        @accounts-updated="(v) => emit('accounts-updated', v)"
      />

      <!-- Sub page: Change Password -->
      <ChangePassword
        v-else-if="subPage === 'changepassword'"
        @back="subPage = null"
        @success="emit('logout')"
      />

      <!-- Normal tab content -->
      <template v-else>
        <KeepAlive>
          <component
            :is="currentTabComponent"
            v-bind="currentTabProps"
            @app-selected="handleAppSelected"
            @download-started="handleDownloadStarted"
            @accounts-updated="handleAccountsUpdated"
            @remove-item="emit('remove-item', $event)"
            @clear-all="emit('clear-queue')"
            @logout="emit('logout')"
            @navigate-to-appearance="subPage = 'appearance'"
            @navigate-to-account="subPage = 'account'"
            @navigate-to-changepassword="subPage = 'changepassword'"
          />
        </KeepAlive>
      </template>
    </div>

    <!-- Orbit v3 Mobile Tab Bar -->
    <div
      v-if="isMobile"
      class="mobile-tabs-wrap"
    >
      <div class="mobile-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['mobile-tab', appStore.activeTab === tab.id ? 'is-active' : '']"
          @click="selectTab(tab.id)"
        >
          <div class="mobile-tab__icon-wrap">
            <svg
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Badge for queue tab -->
            <span
              v-if="tab.badge"
              class="mobile-tab__badge"
            >{{ tab.badge }}</span>
          </div>
          <span class="mobile-tab__label">{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MobileBadge from './MobileBadge.vue'
import Appearance from './Appearance.vue'
import AccountManager from './AccountManager.vue'
import ChangePassword from './ChangePassword.vue'
import { useAppStore } from '../stores/app'
import DownloadManager from './DownloadManager.vue'
import IpaManager from './IpaManager.vue'
import ArchiveApp from './ArchiveApp.vue'
import Settings from './Settings.vue'

const appStore = useAppStore()
const emit = defineEmits(['app-selected', 'download-started', 'accounts-updated', 'remove-item', 'clear-queue', 'logout'])
const isMobile = ref(false)
const subPage = ref(null) // null | 'appearance' | 'account' | 'changepassword'

const checkMobile = () => {
 isMobile.value = window.innerWidth < 768
}

const handleAccountsUpdated = (v) => emit('accounts-updated', v)
const handleAppSelected = (app) => emit('app-selected', app)
const handleDownloadStarted = (task) => emit('download-started', task)
const closeSubPage = () => {
  subPage.value = null
}
const selectTab = (tabId) => {
  closeSubPage()
  appStore.activeTab = tabId
}

const activeQueueCount = computed(() => appStore.taskQueue.filter(task => !['completed', 'ready'].includes(task?.status)).length)

const tabs = computed(() => [
 {
  id: 'download',
  label: '首页',
  iconNodes: [
    { tag: 'path', attrs: { d: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z' } },
    { tag: 'path', attrs: { d: 'M9 21V12h6v9' } }
  ],
  badge: appStore.downloadState.selectedApp ? '1' : null
 },
 {
  id: 'ipa',
  label: '队列',
  iconNodes: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
    { tag: 'polyline', attrs: { points: '12 6 12 12 16 14' } }
  ],
  badge: activeQueueCount.value > 0 ? String(activeQueueCount.value) : null
 },
 {
  id: 'archive',
  label: '收藏',
  iconNodes: [
    { tag: 'path', attrs: { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' } }
  ]
 },
 {
  id: 'settings',
  label: '设置',
  iconNodes: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
    { tag: 'path', attrs: { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' } }
  ]
 }
])

const currentTabComponent = computed(() => {
  const map = {
   download: DownloadManager,
   ipa: IpaManager,
   archive: ArchiveApp,
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
  if (appStore.activeTab === 'ipa') {
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

watch(() => appStore.activeTab, () => {
  closeSubPage()
})
</script>

<style scoped>
.tab-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.desktop-tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.desktop-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 12px 12px 0 0;
  background: transparent;
  color: var(--color-text-muted, #6e6e80);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.desktop-tab::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 9999px;
  background: transparent;
  transition: background 0.2s ease;
}

.desktop-tab.is-active {
  background: var(--color-primary-soft, #ecfdf5);
  color: var(--color-primary, #10a37f);
}

.desktop-tab.is-active::after {
  background: var(--color-primary, #10a37f);
}

.desktop-tab:hover:not(.is-active) {
  color: var(--color-text, #0d0d0d);
}

.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== Orbit v3 Mobile Tab Bar ===== */
.mobile-tabs-wrap {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  background: var(--color-surface, #fff);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--color-border-light, #f0f0f0);
}

.mobile-tabs {
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  height: 72px;
  padding: 10px 16px 0;
}

.mobile-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 64px;
  border: 0;
  background: transparent;
  border-radius: 16px;
  cursor: pointer;
  padding: 6px 10px 8px;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease, color 0.2s ease;
}

.mobile-tab.is-active {
  background: var(--color-primary-soft, #ecfdf5);
}

.mobile-tab__icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.mobile-tab .mobile-tab__icon-wrap svg {
  width: 24px;
  height: 24px;
  color: var(--color-text-muted, #6e6e80);
  transition: color 0.2s ease;
}

.mobile-tab.is-active .mobile-tab__icon-wrap svg {
  color: var(--color-primary, #10a37f);
}

.mobile-tab__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted, #6e6e80);
  line-height: 1.3;
  transition: color 0.2s ease;
}

.mobile-tab.is-active .mobile-tab__label {
  color: var(--color-primary, #10a37f);
  font-weight: 600;
}

.mobile-tab__badge {
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: var(--color-danger);
  color: var(--color-text-inverse);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

.tab-content.with-mobile-tabs {
  padding-bottom: calc(72px + env(safe-area-inset-bottom) + 8px);
}

/* ===== Dark Mode ===== */
.dark .desktop-tabs {
  border-bottom-color: var(--color-border, #3f3f46);
}

.dark .desktop-tab {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .desktop-tab.is-active {
  background: rgba(52, 211, 153, 0.12);
  color: var(--color-primary, #34d399);
}

.dark .desktop-tab:hover:not(.is-active) {
  color: var(--color-text, #f5f5f5);
}

.dark .mobile-tabs-wrap {
  background: var(--color-surface, #18181b);
  border-top-color: var(--color-border, #3f3f46);
}

.dark .mobile-tab .mobile-tab__icon-wrap svg {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .mobile-tab.is-active .mobile-tab__icon-wrap svg {
  color: var(--color-primary, #34d399);
}

.dark .mobile-tab.is-active {
  background: rgba(52, 211, 153, 0.12);
}

.dark .mobile-tab__label {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .mobile-tab.is-active .mobile-tab__label {
  color: var(--color-primary, #34d399);
  font-weight: 600;
}
</style>
