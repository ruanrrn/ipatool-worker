<template>
  <div
    class="shell"
    :class="{ 'mobile-layout': isMobile }"
  >
    <div
      v-if="!isMobile"
      class="desktop-tabs"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['desktop-tab', activeTab === tab.id ? 'is-active' : '']"
        @click="selectTab(tab.id)"
      >
        <SvgIcon
          class="shell__icon h-6 w-6"
          :icon="tab.icon"
        />
        <span>{{ tab.label }}</span>
      </button>
      <button
        class="desktop-logout"
        @click="emit('logout')"
      >
        登出
      </button>
    </div>

    <main
      class="shell-main"
      :class="{ 'with-mobile-tabs': isMobile }"
    >
      <div class="tab-host">
        <KeepAlive>
          <component
            :is="currentTab"
            :key="activeTab"
            @navigate-settings="selectTab('settings')"
          />
        </KeepAlive>
      </div>
    </main>

    <div
      v-if="isMobile"
      class="mobile-tabs-wrap"
    >
      <div class="mobile-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['mobile-tab', activeTab === tab.id ? 'is-active' : '']"
          @click="selectTab(tab.id)"
        >
          <div class="mobile-tab__icon-wrap">
            <SvgIcon
              class="shell__icon h-6 w-6"
              :icon="tab.icon"
            />
          </div>
          <span class="mobile-tab__label">{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent, ref, computed, onMounted, onUnmounted } from 'vue'
import SvgIcon from './SvgIcon.vue'
import homeIcon from '../assets/icons/home.svg?raw'
import bookmarkIcon from '../assets/icons/bookmark.svg?raw'
import settingsIcon from '../assets/icons/settings.svg?raw'

const emit = defineEmits(['logout'])

const Download = defineAsyncComponent(() => import('./DownloadShell.vue'))
const Archive = defineAsyncComponent(() => import('./ArchiveShell.vue'))
const SettingsShell = defineAsyncComponent(() => import('./SettingsShell.vue'))

const tabs = [
  { id: 'download', label: '首页', icon: homeIcon },
  { id: 'archive', label: '存档', icon: bookmarkIcon },
  { id: 'settings', label: '设置', icon: settingsIcon },
]

const activeTab = ref('download')
const isMobile = ref(false)

const currentTab = computed(() => {
  switch (activeTab.value) {
    case 'archive': return Archive
    case 'settings': return SettingsShell
    default: return Download
  }
})

function selectTab(tabId) {
  activeTab.value = tabId
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

function prefetchAsyncChunks() {
  const tasks = [
    () => import('./ArchiveShell.vue'),
    () => import('./SettingsShell.vue'),
  ]
  for (const task of tasks) {
    try {
      task().catch(() => {})
    } catch {
      // best-effort prefetch only
    }
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  setTimeout(prefetchAsyncChunks, 300)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.desktop-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
  flex-shrink: 0;
}

.desktop-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: transparent;
  color: var(--color-text-muted, #6e6e80);
  font-size: var(--font-size-body);
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

.desktop-logout {
  margin-left: auto;
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border, #e5e5e7);
  border-radius: var(--radius-lg);
  background: var(--color-surface, #fff);
  color: var(--color-text-muted, #6e6e80);
  font-size: var(--font-size-caption);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.desktop-logout:hover {
  border-color: var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
}

.shell-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg, #f5f5f7);
}

.tab-host {
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
  width: var(--size-tab-icon);
  height: var(--size-tab-icon);
}

.shell__icon {
  width: var(--size-tab-icon);
  height: var(--size-tab-icon);
  color: currentColor;
  transition: color 0.2s ease;
}

.mobile-tab .shell__icon {
  color: var(--color-text-muted, #6e6e80);
}

.mobile-tab.is-active .shell__icon {
  color: var(--color-primary, #10a37f);
}

.mobile-tab__label {
  font-size: var(--font-size-micro);
  font-weight: 500;
  color: var(--color-text-muted, #6e6e80);
  line-height: 1.3;
  transition: color 0.2s ease;
}

.mobile-tab.is-active .mobile-tab__label {
  color: var(--color-primary, #10a37f);
  font-weight: 600;
}

.shell-main.with-mobile-tabs {
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

.dark .desktop-logout {
  background: var(--color-surface, #18181b);
  border-color: var(--color-border, #3f3f46);
  color: var(--color-text-muted, #a1a1aa);
}

.dark .mobile-tabs-wrap {
  background: var(--color-surface, #18181b);
  border-top-color: var(--color-border, #3f3f46);
}

.dark .mobile-tab .shell__icon {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .mobile-tab.is-active .shell__icon {
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
