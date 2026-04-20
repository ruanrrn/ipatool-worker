<template>
  <div class="home-page page-shell">
    <div class="home-page__fixed px-5">
      <h1 class="home-page__title">
        首页
      </h1>
      <div class="home-page__search-wrap">
        <!-- Search Bar -->
        <MobileInput
          v-model="searchQuery"
          placeholder="搜索应用名称或输入 App ID..."
          :loading="searching"
          :disabled="accounts.length === 0"
          clearable
          size="large"
          class="search-input search-input--fused-top"
          @input="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <Search class="search-input__icon" />
          </template>
        </MobileInput>

        <!-- Account alert when no accounts -->
        <div
          v-if="accounts.length === 0"
          class="account-alert account-alert--fused-bottom"
        >
          <div class="flex items-start gap-3">
            <svg
              class="w-4 h-4 flex-shrink-0 mt-0.5 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div class="flex-1">
              <h4 class="text-body font-semibold text-txt">
                需要先登录账号
              </h4>
              <p class="text-caption text-txt-secondary mt-1">
                请先在"设置"页登录 Apple ID 账号，然后才能搜索应用。
              </p>
              <MobileButton 
                type="primary"
                size="small"
                class="mt-2"
                plain
                @click="goToAccountTab"
              >
                前往登录
              </MobileButton>
            </div>
          </div>
        </div>

        <!-- Account chip -->
        <div
          v-else-if="accounts.length > 1"
          class="account-select-bar account-select-bar--fused-bottom"
        >
          <button
            v-if="selectedAccount !== null && selectedAccount !== undefined && selectedAccount !== '' && accounts[selectedAccount]"
            type="button"
            class="account-picker-chip"
            @click="showAccountPicker = true"
          >
            <AccountChip
              :email="accounts[selectedAccount].email"
              :region="getRegionLabel(accounts[selectedAccount]?.region || 'US')"
              :show-arrow="true"
            />
          </button>
        </div>
        <!-- Single account display -->
        <div
          v-else-if="accounts.length === 1"
          class="account-select-bar account-select-bar--fused-bottom"
        >
          <AccountChip
            :email="accounts[0].email"
            :region="getRegionLabel(accounts[0]?.region || 'US')"
          />
        </div>

        <!-- Direct App ID Confirm Button -->
        <div
          v-if="isAppIdInput && searchQuery && !searching"
          class="status-panel mt-3 flex items-center justify-between p-4"
        >
          <div class="flex-1">
            <p class="text-caption font-medium text-txt-secondary">
              App ID: <span class="font-bold">{{ searchQuery.trim() }}</span>
            </p>
            <p class="text-nano text-txt-secondary mt-1">
              即使未找到应用信息，也可以继续查询版本号
            </p>
          </div>
          <MobileButton
            type="primary"
            size="default"
            @click="confirmDirectAppId"
          >
            确认并继续
          </MobileButton>
        </div>
      </div>
    </div>
    <div class="home-page__results">
      <div class="home-page__results-inner px-5">
        <!-- Search Results Count -->
        <p
          v-if="searchResults.length > 0"
          class="search-results-count"
        >
          找到 {{ searchResults.length }} 个结果
        </p>

        <!-- Search Results -->
        <div
          v-if="searchResults.length > 0"
          class="search-results-list"
        >
          <div
            v-for="app in searchResults"
            :key="app.trackId"
            class="result-item"
            @click="selectApp(app)"
          >
            <img 
              :src="app.artworkUrl100 || app.artworkUrl60"
              :alt="app.trackName"
              class="result-item__icon"
            >
            <div class="result-item__info">
              <h3 class="result-item__name">
                {{ app.trackName }}
              </h3>
              <p class="result-item__dev">
                {{ app.artistName }}
              </p>
              <div class="result-item__meta">
                <span class="result-item__tag">
                  {{ getSearchResultCategory(app) }}
                </span>
                <span class="result-item__tag">
                  {{ getSearchResultVersionLabel(app) }}
                </span>
                <span class="result-item__tag">
                  {{ getSearchResultSizeLabel(app) }}
                </span>
                <span class="result-item__tag result-item__tag--price">
                  {{ getSearchResultPriceLabel(app) }}
                </span>
                <span
                  class="result-item__tag"
                  :class="getSearchResultPurchaseClass(app)"
                >
                  {{ getSearchResultPurchaseLabel(app) }}
                </span>
              </div>
            </div>
            <button
              class="result-item__fav"
              :class="{ active: isAppFavorited(app.trackId) }"
              @click.stop="quickToggleFavorite(app)"
            >
              <i><component :is="isAppFavorited(app.trackId) ? StarFilled : Star" /></i>
              <span
                v-if="getArchivedVersionCount(app.trackId) > 0"
                class="result-item__fav-count"
              >
                {{ getArchivedVersionCount(app.trackId) }}
              </span>
            </button>
          </div>
        </div>

        <!-- "进行中" Section -->
        <div v-if="showHomeSections && hasActiveTasks">
          <SectionHead
            title="进行中"
            link-text="查看全部"
            @link-click="goToQueue"
          />
          <div class="recent-list">
            <div
              v-for="task in recentActiveTasks"
              :key="task.id"
              class="recent-item"
            >
              <img 
                v-if="task.artworkUrl"
                :src="task.artworkUrl"
                :alt="task.appName"
                class="recent-item__icon"
              >
              <div
                v-else
                class="recent-item__icon recent-item__icon--placeholder"
              >
                <i><component :is="Download" /></i>
              </div>
              <div class="recent-item__info">
                <h3 class="recent-item__name">
                  {{ task.appName || '下载任务' }}
                </h3>
                <p class="recent-item__detail">
                  {{ task.stage || '下载中...' }}
                </p>
                <div
                  v-if="task.progress != null"
                  class="recent-item__progress"
                >
                  <ProgressBar
                    :percent="task.progress"
                    :color="getProgressColor(task.status)"
                    size="mini"
                  />
                </div>
              </div>
              <span class="recent-item__arrow">›</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="!selectedApp && showHomeSections && !hasActiveTasks"
          class="empty-state-home"
        >
          <div class="empty-state-home__icon">
            📋
          </div>
          <p class="empty-state-home__title">
            暂无进行中的任务
          </p>
          <p class="empty-state-home__desc">
            搜索应用开始使用
          </p>
        </div>
      </div>
    </div>

    <!-- Version Selection Bottom Sheet Overlay -->
    <Transition name="sheet-fade">
      <div
        v-if="selectedApp"
        class="version-sheet-overlay"
        @click.self="emit('app-selected', null)"
      >
        <Transition name="sheet-slide">
          <div
            v-if="selectedApp"
            class="version-sheet"
          >
            <!-- Drag Handle -->
            <div
              class="version-sheet__handle"
              @click="emit('app-selected', null)"
            />

            <!-- Sheet Header: App Icon + Name + Developer -->
            <div class="version-sheet__header">
              <img
                v-if="!selectedApp.isDirectAppId && (selectedApp.artworkUrl100 || selectedApp.artworkUrl60)"
                :src="selectedApp.artworkUrl100 || selectedApp.artworkUrl60"
                :alt="selectedApp.trackName"
                class="version-sheet__icon"
              >
              <div
                v-else
                class="version-sheet__icon version-sheet__icon--placeholder"
              >
                <svg
                  class="w-6 h-6 text-txt-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div class="version-sheet__header-info">
                <h3 class="version-sheet__app-name">
                  {{ selectedApp.trackName }}
                </h3>
                <p class="version-sheet__app-meta">
                  {{ selectedApp.artistName }}
                </p>
              </div>
              <!-- Dismiss button -->
              <button
                class="version-sheet__close"
                @click="emit('app-selected', null)"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>


            <!-- Version List (radio style) -->
            <VersionPicker
              :versions="versions"
              :selected-version="selectedVersion"
              :versions-fetched="versionsFetched"
              :fetching-versions="fetchingVersions"
              :appid="appid"
              :format-file-size="formatFileSize"
              @version-selected="handleVersionSelected"
            />

            <!-- Purchase Warning -->
            <div
              v-if="purchaseRequired && versionsFetched"
              class="version-sheet__section"
            >
              <div class="download-disabled-hint">
                ⚠️ {{ downloadBlockedReason }}
              </div>
            </div>

            <!-- Note Input -->
            <div
              v-if="versionsFetched"
              class="version-sheet__section"
            >
              <label class="version-sheet__note-label">备注</label>
              <MobileInput
                v-model="versionNote"
                placeholder="可选，给这个版本加个备注..."
                clearable
                class="version-sheet__note-input"
              />
              <p class="version-sheet__note-hint">
                备注仅在收藏后展示，不填写则为空
              </p>
            </div>

            <!-- Progress Panel -->
            <ProgressPanel
              :downloading="showCurrentVersionProgressCard"
              :progress-percent="currentVersionProgressPercent"
              :progress-stage="currentVersionProgressStage"
              :logs="logs"
              :download-url="currentVersionDownloadUrl"
              :install-url="currentVersionInstallUrl"
              :file-size="currentVersionFileSize"
              :ota-installable="currentVersionOtaInstallable"
              :install-method="currentVersionInstallMethod"
              :inspection="currentVersionInspection"
              :is-https="isHttps"
              :current-protocol="currentProtocol"
              @download-ipa="downloadCompletedIpa"
              @install-ipa="installDownloadedIpa"
            />

            <!-- Action Bar (3 buttons in a row) -->
            <div
              v-if="versionsFetched && versions.length > 0"
              class="version-sheet__actions"
              :class="{ 'version-sheet__actions--purchase': purchaseRequired }"
            >
              <MobileButton
                v-if="purchaseRequired"
                :disabled="(!selectedAccount && selectedAccount !== 0) || checkingPurchaseStatus"
                :loading="claimRequired && claimingSelectedApp"
                type="primary"
                class="version-sheet__purchase-btn version-sheet__purchase-btn--dock"
                @click="buyOrClaimSelectedApp"
              >
                <template #icon>
                  <i><ArrowRight /></i>
                </template>
                {{ purchaseActionLabel }}
              </MobileButton>
              <template v-else>
                <button
                  class="version-sheet__action-btn version-sheet__action-btn--secondary"
                  :disabled="(!selectedAccount && selectedAccount !== 0) || downloadBlocked || isCurrentVersionDownloaded || showCurrentVersionProgressCard"
                  :class="{ 'is-disabled': downloadBlocked || isCurrentVersionDownloaded || showCurrentVersionProgressCard }"
                  @click="directLinkDownload"
                >
                  <template v-if="showCurrentVersionProgressCard">
                    <i><Download /></i>
                    <span>{{ downloadButtonProgressLabel }}</span>
                  </template>
                  <template v-else-if="isCurrentVersionDownloaded">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ><polyline points="20 6 9 17 4 12" /></svg>
                    <span>已下载</span>
                  </template>
                  <template v-else>
                    <i><Download /></i>
                    <span>下载</span>
                  </template>
                </button>
                <button
                  class="version-sheet__action-btn version-sheet__action-btn--primary"
                  :disabled="(!selectedAccount && selectedAccount !== 0) || downloadBlocked || showCurrentVersionProgressCard"
                  :class="{ 'is-disabled': downloadBlocked || showCurrentVersionProgressCard }"
                  @click="startInstallFlow"
                >
                  <i><Install /></i>
                  <span>{{ showCurrentVersionProgressCard ? installButtonProgressLabel : '安装' }}</span>
                </button>
                <button
                  class="version-sheet__action-btn version-sheet__action-btn--fav"
                  :class="{ 'is-active': isCurrentAppFavorited }"
                  :disabled="favoriteLoading || downloading"
                  @click="toggleFavoriteApp"
                >
                  <i><component :is="isCurrentAppFavorited ? StarFilled : Star" /></i>
                </button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onActivated, onBeforeUnmount, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { useAppStore } from '../stores/app'
import { useSearch } from '../composables/useSearch.js'
import { Toast } from './MobileToast.vue'
import { Confirm } from './MobileConfirm.vue'
import { Search, ArrowRight, Download, Install, Star, StarFilled } from './icons'
import { useAccounts } from '../composables/useAccounts.js'
import { useDownload } from '../composables/useDownload.js'

import MobileButton from './MobileButton.vue'
import MobileInput from './MobileInput.vue'
import SectionHead from './SectionHead.vue'
import AccountChip from './AccountChip.vue'
import ProgressBar from './ProgressBar.vue'
import ProgressPanel from './ProgressPanel.vue'
import VersionPicker from './VersionPicker.vue'

const appStore = useAppStore()

const props = defineProps({
 selectedApp: {
 type: Object,
 default: null
 },
 accountsUpdated: {
 type: Number,
 default: 0
 }
})

// Make selectedApp reactive for template
const selectedApp = computed(() => props.selectedApp)

const emit = defineEmits(['download-started', 'app-selected'])

const { accounts, loadAccounts } = useAccounts()
const selectedAccount = ref(null) // 改为 null 而不是空字符串

// Initialize download composable
const {
  downloading,
  showProgress,
  progressPercent,
  progressStage,
  logs,
  showActionButtons,
  activeDownloadAppId,
  activeDownloadVersionId,
  activeDownloadAccountEmail,
  checkingPurchaseStatus,
  claimingSelectedApp,
  purchaseStatusText,
  purchaseRequired,
  claimRequired,
  downloadBlocked,
  downloadBlockedReason,
  purchaseActionLabel,
  isHttps,
  currentProtocol,
  startDownloadWithProgress,
  refreshPurchaseStatus,
  claimSelectedAppInBackground,
  addLog,
  localizeProgressStage,
  formatFileSize,
  openInstallUrl,
  openExternalUrl,
  getSelectedAppPrice
} = useDownload({
  onDownloadStarted: (queueItem) => {
    emit('download-started', queueItem)
    // Also sync to store
    appStore.addQueueItem(queueItem)
  },
  onDownloadComplete: () => {
    // Load downloaded IPA files after completion
    loadDownloadedIpaFiles()
  },
  onDownloadFailed: (error) => {
    console.error('Download failed:', error)
  },
  selectedApp,
  selectedAccount,
  accounts
})

// Define helpers before useDownload since they're referenced in callbacks
const normalizeDownloadedIpaFile = (file) => ({
  ...file,
  appId: String(file?.appId ?? file?.app_id ?? file?.trackId ?? file?.id ?? ''),
  accountEmail: String(file?.accountEmail ?? file?.account_email ?? file?.apple_id ?? file?.email ?? ''),
  version: String(file?.version ?? file?.bundle_version ?? file?.appVersion ?? ''),
  versionId: String(file?.versionId ?? file?.version_id ?? file?.appVerId ?? file?.app_version_id ?? file?.external_identifier ?? '')
})

const loadDownloadedIpaFiles = async () => {
 try {
    const { data } = await apiFetch(`${API_BASE}/ipa-files`, { credentials: 'include' })
    if (data.ok && Array.isArray(data.data)) {
      downloadedIpaFiles.value = data.data.map(normalizeDownloadedIpaFile)
    }
  } catch (e) {
    console.warn('Failed to load ipa files:', e)
  }
}

const appid = ref('')
const appVerId = ref('')
const versions = ref([])
const selectedVersion = ref('')
const versionsFetched = ref(false)
const fetchingVersions = ref(false)
const pendingAppStoreCheck = ref(false)
const archivedVersionsByApp = ref({})
const archivedVersionNotes = ref({})  // { versionId: noteStr }
const favoriteLoading = ref(false)
const downloadedIpaFiles = ref([])  // 缓存已下载的 IPA 文件列表

const normalizeComparableValue = (value) => String(value ?? '').trim().toLowerCase()

const {
 searchQuery,
 searchResults,
 searchResultPurchaseStatusMap,
 searching,
 isAppIdInput,
 handleSearch,
 selectApp,
 confirmDirectAppId,
 getSearchResultCategory,
 getSearchResultVersionLabel,
 getSearchResultSizeLabel,
 getSearchResultPriceLabel,
 getSearchResultPurchaseLabel,
 getSearchResultPurchaseClass,
} = useSearch(
 accounts,
 selectedAccount,
 (app) => emit('app-selected', app),
 { debounceDelay: 300 }
)

const selectedVersionRecord = computed(() => {
  const selectedVersionId = String(selectedVersion.value || appVerId.value || '')
  if (!selectedVersionId) return null
  return versions.value.find((version) => String(version?.external_identifier ?? version?.version_id ?? version?.id ?? '') === selectedVersionId) || null
})

const currentVersionMatchValues = computed(() => {
  const candidates = new Set()
  const selectedVersionId = String(appVerId.value || selectedVersion.value || '')
  const selectedVersionLabel = String(
    selectedVersionRecord.value?.bundle_version
    ?? selectedVersionRecord.value?.version
    ?? selectedVersionRecord.value?.name
    ?? ''
  )
  const appFallbackVersion = String(props.selectedApp?.version || '')

  if (selectedVersionId) candidates.add(normalizeComparableValue(selectedVersionId))
  if (selectedVersionLabel) candidates.add(normalizeComparableValue(selectedVersionLabel))

  // 仅在当前还没拿到明确选中版本标签时，才退回到应用列表里的默认版本号。
  // 否则切换到其他版本后会把原始 app.version 一起带上，导致 1.0.1 已下载时切到 1.0.2 仍误判为已下载。
  if (!selectedVersionLabel && appFallbackVersion) {
    candidates.add(normalizeComparableValue(appFallbackVersion))
  }

  return candidates
})

// activeDownloadAppId, activeDownloadVersionId, activeDownloadAccountEmail from useDownload (line 487-489)
const taskFinalStatuses = new Set(['completed', 'ready', 'failed', 'error'])

const currentVersionTaskCandidates = computed(() => {
  const currentAppId = normalizeComparableValue(appid.value)
  const idx = selectedAccount.value
  const account = idx === null || idx === undefined ? null : accounts.value[idx]
  const currentAccountEmail = normalizeComparableValue(account?.email)
  const versionMatchValues = currentVersionMatchValues.value

  if (!currentAppId || !currentAccountEmail || versionMatchValues.size === 0) return []

  return appStore.taskQueue
    .filter((task) => {
      if (!task) return false
      const taskAppId = normalizeComparableValue(task.appId)
      const taskAccountEmail = normalizeComparableValue(task.accountEmail)
      const taskVersionId = normalizeComparableValue(task.versionId)
      const taskVersion = normalizeComparableValue(task.version)

      return taskAppId === currentAppId
        && taskAccountEmail === currentAccountEmail
        && (versionMatchValues.has(taskVersionId) || versionMatchValues.has(taskVersion))
    })
    .slice()
    .sort((a, b) => {
      const aActive = taskFinalStatuses.has(a?.status) ? 0 : 1
      const bActive = taskFinalStatuses.has(b?.status) ? 0 : 1
      if (aActive !== bActive) return bActive - aActive
      const aTime = new Date(a?.updatedAt || a?.timestamp || 0).getTime()
      const bTime = new Date(b?.updatedAt || b?.timestamp || 0).getTime()
      return bTime - aTime
    })
})

const currentVersionTask = computed(() => currentVersionTaskCandidates.value[0] || null)
const currentVersionActiveTask = computed(() => {
  const task = currentVersionTask.value
  return task && !taskFinalStatuses.has(task.status) ? task : null
})
const currentVersionReadyTask = computed(() => {
  const task = currentVersionTask.value
  if (!task || !taskFinalStatuses.has(task.status)) return null
  if (!(task.downloadUrl || task.installUrl)) return null
  return (task.status === 'completed' || task.status === 'ready') ? task : null
})

const showCurrentVersionProgressCard = computed(() => !!currentVersionActiveTask.value)
const currentVersionProgressPercent = computed(() => Number(currentVersionActiveTask.value?.progress ?? 0))
const currentVersionProgressStage = computed(() => localizeProgressStage(currentVersionActiveTask.value?.stage || '准备中…'))
const currentVersionDownloadUrl = computed(() => currentVersionReadyTask.value?.downloadUrl || '')
const currentVersionInstallUrl = computed(() => currentVersionReadyTask.value?.installUrl || '')
const currentVersionFileSize = computed(() => Number(currentVersionReadyTask.value?.fileSize || 0))
const currentVersionOtaInstallable = computed(() => !!currentVersionReadyTask.value?.otaInstallable)
const currentVersionInstallMethod = computed(() => currentVersionReadyTask.value?.installMethod || '')
const currentVersionInspection = computed(() => currentVersionReadyTask.value?.inspection || null)
const downloadButtonProgressLabel = computed(() => `${currentVersionProgressStage.value} ${currentVersionProgressPercent.value}%`)
const installButtonProgressLabel = computed(() => `处理中 ${currentVersionProgressPercent.value}%`)

const isCurrentVersionDownloaded = computed(() => {
  if (!appid.value || currentVersionMatchValues.value.size === 0) return false
  const idx = selectedAccount.value
  if (idx === null || idx === undefined) return false
  const account = accounts.value[idx]
  if (!account) return false

  const currentAppId = normalizeComparableValue(appid.value)
  const currentAccountEmail = normalizeComparableValue(account.email)

  return downloadedIpaFiles.value.some((file) => {
    const fileAppId = normalizeComparableValue(file.appId)
    const fileAccountEmail = normalizeComparableValue(file.accountEmail)
    const fileVersion = normalizeComparableValue(file.version)
    const fileVersionId = normalizeComparableValue(file.versionId)

    return fileAppId === currentAppId
      && fileAccountEmail === currentAccountEmail
      && (currentVersionMatchValues.value.has(fileVersion) || currentVersionMatchValues.value.has(fileVersionId))
  })
})

const versionNote = ref('')

const syncSelectedVersionNote = ({ force = false } = {}) => {
 const currentVersionId = String(selectedVersion.value || appVerId.value || '')
 if (!currentVersionId) {
  if (force) versionNote.value = ''
  return
 }

 const nextNote = archivedVersionNotes.value[currentVersionId] || ''
 if (force || !versionNote.value) {
  versionNote.value = nextNote
 }
}

const getArchivedVersionSet = (appId) => {
 const versions = archivedVersionsByApp.value[String(appId)]
 return versions instanceof Set ? versions : new Set()
}

const getCurrentArchiveVersion = () => {
 const version = versions.value.find(item => item.external_identifier === selectedVersion.value)
  || versions.value[0]

 const versionId = String(
  version?.external_identifier
  ?? version?.version_id
  ?? version?.id
  ?? appVerId.value
  ?? ''
 )

 const versionLabel = String(
  version?.bundle_version
  ?? version?.version
  ?? version?.name
  ?? selectedApp.value?.version
  ?? ''
 )

 return {
  versionId,
  versionLabel
 }
}

const isCurrentAppFavorited = computed(() => {
 if (!selectedApp.value?.trackId) return false
 const { versionId } = getCurrentArchiveVersion()
 if (!versionId) return false
 return getArchivedVersionSet(selectedApp.value.trackId).has(versionId)
})

// purchaseRequired, claimRequired, paidPurchaseRequired, downloadBlocked, downloadBlockedReason, purchaseActionLabel from useDownload (line 494-499)

// ===== Orbit v3: Home page computed properties =====
const activeTaskCount = computed(() => {
 return appStore.taskQueue.filter(t => t && ['downloading', 'processing'].includes(t.status)).length
})


const hasActiveTasks = computed(() => activeTaskCount.value > 0)

const recentActiveTasks = computed(() => {
 return appStore.taskQueue
  .filter(t => t && ['downloading', 'processing'].includes(t.status))
  .slice(0, 3)
})

const showHomeSections = computed(() => {
 return !searching.value && !searchQuery.value.trim() && searchResults.value.length === 0 && !selectedApp.value
})

const goToQueue = () => {
 appStore.queueTab = 'active'
 appStore.activeTab = 'ipa'
}

const getProgressColor = (status) => {
 if (status === 'completed' || status === 'ready') return 'var(--color-primary)'
 if (status === 'failed' || status === 'error') return 'var(--color-danger)'
 return 'var(--color-primary)'
}

const getArchivedVersionCount = (appId) => getArchivedVersionSet(appId).size

const isAppFavorited = (trackId) => {
 return getArchivedVersionCount(trackId) > 0
}

const quickToggleFavorite = async (app) => {
 if (!app?.trackId) {
  Toast.warning('应用信息无效')
  return
 }

 if (favoriteLoading.value) return
 favoriteLoading.value = true

 try {
  const appId = String(app.trackId)
  const archivedVersions = [...getArchivedVersionSet(appId)]

  if (archivedVersions.length > 0) {
   const { data } = await apiFetch(`${API_BASE}/archive/${encodeURIComponent(appId)}`, {
    method: 'DELETE',
    credentials: 'include'
   })
   if (!data.ok) throw new Error(data.error || '取消收藏失败')

   const nextMap = { ...archivedVersionsByApp.value }
   delete nextMap[appId]
   archivedVersionsByApp.value = nextMap
   Toast.success(`已取消收藏（共移除 ${archivedVersions.length} 个版本）`)
   return
  }

  const region = accounts.value[selectedAccount.value]?.region || 'US'
  const { data: versionData } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(appId)}&region=${encodeURIComponent(region)}`, {
   credentials: 'include'
  })
  if (!versionData.ok || !Array.isArray(versionData.data) || versionData.data.length === 0) {
   throw new Error(versionData.error || '未获取到可收藏的版本')
  }

  const latestVersion = [...versionData.data].sort(compareVersionDesc)[0]
  const versionId = String(latestVersion?.external_identifier ?? latestVersion?.version_id ?? latestVersion?.id ?? '')
  const versionLabel = String(latestVersion?.bundle_version ?? latestVersion?.version ?? latestVersion?.name ?? versionId)
  if (!versionId) {
   throw new Error('版本信息无效')
  }

  const { data } = await apiFetch(`${API_BASE}/archive`, {
   method: 'POST',
   credentials: 'include',
   headers: {
    'Content-Type': 'application/json'
   },
   body: JSON.stringify({
    app_id: appId,
    app_name: app.trackName || `App ID: ${appId}`,
    icon_url: app.artworkUrl100 || app.artworkUrl60 || null,
    bundle_id: app.bundleId || null,
    artist_name: app.artistName || null,
    versions: [{
     version_id: versionId,
     version: versionLabel
    }]
   })
  })
  if (!data.ok) throw new Error(data.error || '收藏失败')

  archivedVersionsByApp.value = {
   ...archivedVersionsByApp.value,
   [appId]: new Set([versionId])
  }
  Toast.success('已收藏')
 } catch (error) {
  Toast.error(error.message || '收藏失败')
 } finally {
  favoriteLoading.value = false
 }
}
// ===== End Orbit v3 =====

// isHttps, currentProtocol from useDownload (line 500-501)

// Sync state with store on mount and update
const syncStateToStore = () => {
 appStore.updateDownloadState('selectedAccountIndex', selectedAccount.value)
 // appid 由 setSelectedApp / watcher 管理，不再由此处同步，避免覆盖 setSelectedApp 刚写入的新值
 appStore.updateDownloadState('appVersionId', appVerId.value)
 appStore.updateDownloadState('availableVersions', versions.value)
 appStore.updateDownloadState('selectedVersionId', selectedVersion.value)
 appStore.updateDownloadState('versionsLoaded', versionsFetched.value)
 appStore.updateDownloadState('showProgressPanel', showProgress.value)
 appStore.updateDownloadState('progressPercentage', progressPercent.value)
 appStore.updateDownloadState('progressMessage', progressStage.value)
 appStore.updateDownloadState('progressLogs', logs.value)
 appStore.updateDownloadState('activeDownloadAppId', activeDownloadAppId.value)
 appStore.updateDownloadState('activeDownloadVersionId', activeDownloadVersionId.value)
 appStore.updateDownloadState('activeDownloadAccountEmail', activeDownloadAccountEmail.value)
 appStore.updateDownloadState('searchQuery', searchQuery.value)
 appStore.updateDownloadState('searchResults', searchResults.value)
 appStore.updateDownloadState('searchResultPurchaseStatusMap', searchResultPurchaseStatusMap.value)
}

const restoreStateFromStore = () => {
 const state = appStore.downloadState
 // 只恢复非 undefined 的值，避免覆盖自动选择的账号
 if (state.selectedAccountIndex !== undefined && state.selectedAccountIndex !== null && state.selectedAccountIndex !== '') {
  selectedAccount.value = normalizeAccountIndex(state.selectedAccountIndex)
 }
 if (state.appId !== undefined) appid.value = state.appId
 if (state.appVersionId !== undefined) appVerId.value = state.appVersionId
 if (state.availableVersions !== undefined) {
  versions.value = (Array.isArray(state.availableVersions) ? state.availableVersions : [])
   .map(normalizeFetchedVersion)
   .filter(Boolean)
 }
 if (state.selectedVersionId !== undefined) selectedVersion.value = state.selectedVersionId
 if (state.versionsLoaded !== undefined) versionsFetched.value = state.versionsLoaded
 if (state.showProgressPanel !== undefined) showProgress.value = state.showProgressPanel
 if (state.progressPercentage !== undefined) progressPercent.value = state.progressPercentage
 if (state.progressMessage !== undefined) progressStage.value = localizeProgressStage(state.progressMessage)
 if (state.progressLogs !== undefined) logs.value = state.progressLogs
 if (state.activeDownloadAppId !== undefined) activeDownloadAppId.value = state.activeDownloadAppId || ''
 if (state.activeDownloadVersionId !== undefined) activeDownloadVersionId.value = state.activeDownloadVersionId || ''
 if (state.activeDownloadAccountEmail !== undefined) activeDownloadAccountEmail.value = state.activeDownloadAccountEmail || ''
 downloading.value = !!(showProgress.value && !showActionButtons.value && progressPercent.value < 100)
 if (state.searchQuery !== undefined) searchQuery.value = state.searchQuery || ''
 if (state.searchResults !== undefined) searchResults.value = Array.isArray(state.searchResults) ? state.searchResults : []
 if (state.searchResultPurchaseStatusMap !== undefined) {
  searchResultPurchaseStatusMap.value = state.searchResultPurchaseStatusMap && typeof state.searchResultPurchaseStatusMap === 'object'
   ? state.searchResultPurchaseStatusMap
   : {}
 }
 // 如果没有 selectedApp prop，不恢复关联的 appid/versions 等状态
 if (!props.selectedApp) {
  appid.value = ''
  versions.value = []
  selectedVersion.value = ''
  versionsFetched.value = false
  appVerId.value = ''
 }
}

// Watch state changes and sync to store
watch([selectedAccount, appVerId, versions, selectedVersion, versionsFetched, showProgress, progressPercent, progressStage, logs, searchQuery, searchResults, searchResultPurchaseStatusMap], () => {
 syncStateToStore()
}, { deep: true })

const loadArchivedAppIds = async () => {
 try {
 const { data } = await apiFetch(`${API_BASE}/archive`, { credentials: 'include' })
 if (!data.ok || !Array.isArray(data.data)) return
 const notes = {}
 archivedVersionsByApp.value = data.data.reduce((acc, item) => {
  const appId = String(item?.id || item?.app_id || '')
  if (!appId) return acc

  acc[appId] = new Set(
   (Array.isArray(item?.versions) ? item.versions : [])
    .map(version => {
     const vId = String(version?.version_id || version?.external_identifier || version?.id || '')
     if (vId && version?.description) notes[vId] = version.description
     return vId
    })
    .filter(Boolean)
  )
  return acc
 }, {})
 archivedVersionNotes.value = notes
 syncSelectedVersionNote()
 } catch (error) {
 console.warn('Failed to load archive apps:', error)
 }
}

const toggleFavoriteApp = async () => {
 const app = selectedApp.value
 if (!app?.trackId) {
 Toast.warning('请先选择应用')
 return
 }
 if (favoriteLoading.value) return

 favoriteLoading.value = true
 try {
 const appId = String(app.trackId)
 const { versionId, versionLabel } = getCurrentArchiveVersion()

 if (!versionId) {
 Toast.warning('请先查询并选择版本后再收藏')
 return
 }

 if (getArchivedVersionSet(appId).has(versionId)) {
 const { data } = await apiFetch(`${API_BASE}/archive/${encodeURIComponent(appId)}/versions/${encodeURIComponent(versionId)}`, {
 method: 'DELETE',
 credentials: 'include'
 })
 if (!data.ok) throw new Error(data.error || '取消收藏失败')

 const nextMap = { ...archivedVersionsByApp.value }
 const nextVersions = new Set(getArchivedVersionSet(appId))
 nextVersions.delete(versionId)

 if (nextVersions.size === 0) {
  delete nextMap[appId]
 } else {
  nextMap[appId] = nextVersions
 }

 archivedVersionsByApp.value = nextMap
 Toast.success(`已取消收藏版本 ${versionLabel || versionId}`)
 return
 }

 const payload = {
 app_id: appId,
 app_name: app.trackName || `App ID: ${appId}`,
 icon_url: app.artworkUrl100 || app.artworkUrl60 || null,
 bundle_id: app.bundleId || null,
 versions: [{
  version_id: versionId,
  version: versionLabel || versionId,
  description: versionNote.value || null
 }]
 }

 const { data } = await apiFetch(`${API_BASE}/archive`, {
 method: 'POST',
 credentials: 'include',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(payload)
 })
 if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
 if (!data.ok) throw new Error(data.error || '收藏失败')
 const nextMap = { ...archivedVersionsByApp.value }
 const nextVersions = new Set(getArchivedVersionSet(appId))
 nextVersions.add(versionId)
 nextMap[appId] = nextVersions
 archivedVersionsByApp.value = nextMap
 Toast.success(`已收藏版本 ${versionLabel || versionId}`)
 } catch (error) {
 Toast.error(error.message || '收藏失败')
 } finally {
 favoriteLoading.value = false
 }
}


const resolveActiveAccount = async () => {
 if (!selectedAccount.value && selectedAccount.value !== 0) {
 throw new Error('请选择登录账号')
 }

 const currentAccount = accounts.value[selectedAccount.value]
 if (!currentAccount) {
 throw new Error('当前账号不存在，请重新选择账号')
 }

 const targetEmail = currentAccount.email
 await loadAccounts()

 const freshIndex = accounts.value.findIndex(
 acc => accountIdentityKey(acc) === accountIdentityKey(currentAccount) || acc.token === currentAccount.token || acc.email === targetEmail
 )

 if (freshIndex < 0) {
 throw new Error('当前账号会话已失效，请到账号管理页重新登录')
 }

 selectedAccount.value = freshIndex
 return accounts.value[freshIndex]
}

// 跳转到账号标签页
const goToAccountTab = () => {
 const appStore = useAppStore()
 appStore.activeTab = 'settings'
}

const debouncedFetchVersions = useDebounceFn(() => {
 fetchVersions()
}, 400)

// Watch for selectedApp changes to auto-fill appid
watch(() => props.selectedApp, (newApp, oldApp) => {
  const newTrackId = newApp?.trackId ? String(newApp.trackId) : ''
  const oldTrackId = oldApp?.trackId ? String(oldApp.trackId) : ''

  // 只在真正切换应用（trackId 变化）时重置版本状态。
  // 这样 metadata enrich 二次 setSelectedApp 不会把已加载的版本列表清空。
  if (newTrackId !== oldTrackId) {
    versions.value = []
    selectedVersion.value = ''
    appVerId.value = ''
    versionsFetched.value = false
    versionNote.value = ''
    loadArchivedAppIds()
  }

  appid.value = newTrackId
}, { immediate: true })

// Watch for account and appid changes to auto-fetch versions
watch([selectedAccount, appid], ([newAccount, newAppid]) => {
 if (newAccount !== '' && newAccount !== null && newAppid) {
 // 自动查询版本
 debouncedFetchVersions()
 }
})

watch(selectedVersion, () => {
 syncSelectedVersionNote({ force: true })
})

watch(
 [() => props.selectedApp?.trackId, selectedAccount],
 async ([trackId, accountIndex]) => {
 if (!trackId) {
 purchaseStatusText.value = '待检测'
 return
 }
 if (accountIndex === '' || accountIndex === null || accountIndex === undefined) {
 purchaseStatusText.value = '请选择账号后检测'
 return
 }
 await refreshSelectedAppMetadata()
 await refreshPurchaseStatus()
 },
 { immediate: true }
)

const fetchVersions = async () => {
 if (!appid.value) {
 Toast.warning('请填写 APPID')
 return
 }

 if (selectedAccount.value === '' || selectedAccount.value === null) {
 Toast.warning('请先选择账号')
 return
 }

 const account = accounts.value[selectedAccount.value]
 const region = account?.region || 'US'

 fetchingVersions.value = true
 addLog(`[查询] 正在查询 APPID=${appid.value} 的历史版本（区域：${getRegionLabel(region)}）...`)

 try {
 const { data } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(appid.value)}&region=${encodeURIComponent(region)}`, { credentials: 'include' })

 if (!data.ok) {
 Toast.error(`查询失败：${data.error || '未知错误'}`)
 addLog(`[查询] 失败：${data.error || '未知错误'}`)
 return
 }

  versions.value = (data.data || [])
   .map(normalizeFetchedVersion)
   .filter(Boolean)
   .sort(compareVersionDesc)

  versionsFetched.value = true

  if (!selectedVersion.value && versions.value[0]) {
   selectedVersion.value = String(versions.value[0].external_identifier ?? versions.value[0].version_id ?? versions.value[0].id ?? '')
   appVerId.value = selectedVersion.value
   syncSelectedVersionNote({ force: true })
  }

  addLog(`[查询] 获取到 ${versions.value.length} 条版本记录`)
 } catch (error) {
 Toast.error(`查询失败：${error.message}`)
 addLog(`[查询] 失败：${error.message}`)
 } finally {
 fetchingVersions.value = false
 }
}

const handleVersionSelected = (verId) => {
  selectedVersion.value = verId
  appVerId.value = verId
  syncSelectedVersionNote({ force: true })
}

const normalizeFetchedVersion = (version) => {
 const versionId = String(
  version?.external_identifier
  ?? version?.version_id
  ?? version?.appVersionId
  ?? version?.id
  ?? ''
 )

 const label = String(
  version?.bundle_version
  ?? version?.version
  ?? version?.name
  ?? versionId
 )

 if (!versionId || !label) return null

 return {
  ...version,
  external_identifier: versionId,
  version_id: String(version?.version_id ?? versionId),
  bundle_version: label,
  created_at: version?.created_at ?? version?.date ?? '',
  size: normalizeVersionSize(version)
 }
}

const compareVersionDesc = (a, b) => {
 const normalize = (value) => String(value || '')
 .split(/[^0-9A-Za-z]+/)
 .filter(Boolean)
 .map(part => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))

 const av = normalize(a?.bundle_version || a?.version)
 const bv = normalize(b?.bundle_version || b?.version)
 const len = Math.max(av.length, bv.length)

 for (let i = 0; i < len; i += 1) {
 const left = av[i]
 const right = bv[i]
 if (left === undefined) return 1
 if (right === undefined) return -1
 if (left === right) continue
 if (typeof left === 'number' && typeof right === 'number') {
 return right - left
 }
 return String(right).localeCompare(String(left), undefined, { numeric: true, sensitivity: 'base' })
 }

 return String(b?.created_at || b?.date || '').localeCompare(String(a?.created_at || a?.date || ''))
}

const refreshSelectedAppMetadata = async () => {
 if (!props.selectedApp?.trackId) return

const region = accounts.value[selectedAccount.value]?.region || 'US'
const needsFill = !props.selectedApp?.formattedPrice || !props.selectedApp?.fileSizeBytes
if (!needsFill) return

try {
const { data } = await apiFetch(`${API_BASE}/app-meta?appid=${encodeURIComponent(props.selectedApp.trackId)}&region=${encodeURIComponent(region)}`)
const app = data?.data
if (!data.ok || !app) return

appStore.setSelectedApp({
 ...props.selectedApp,
 ...app,
 })
 } catch (error) {
 console.warn('Failed to enrich selected app metadata:', error)
 }
}

const downloadCompletedIpa = () => {
 if (!currentVersionDownloadUrl.value) {
  Toast.warning('下载链接未显示')
  return
 }

 window.open(currentVersionDownloadUrl.value, '_blank', 'noopener')
}

// Wrapper functions that use composable functionality
const buyOrClaimSelectedApp = async () => {
 const price = getSelectedAppPrice()

 if (price === null) {
  Toast.show('价格未知，无法安全领取/购买。请先在搜索结果确认价格信息。')
  return
 }

 if (price <= 0) {
  const account = await resolveActiveAccount()
  if (!account) return
  await claimSelectedAppInBackground(appid.value, selectedVersion.value)
  return
 }

 const appStoreUrl = props.selectedApp?.trackViewUrl || `https://apps.apple.com/app/id${props.selectedApp.trackId}`
 pendingAppStoreCheck.value = true
 purchaseStatusText.value = '等待完成 App Store 购买后自动复检'
 Toast.info('即将打开 App Store 商品页。完成购买后返回此页，系统会自动重新检测状态。')
 openExternalUrl(appStoreUrl)
}

const installDownloadedIpa = async () => {
 if (!currentVersionInstallUrl.value) {
  Toast.warning('安装链接未生成')
  return
 }

 const isHttpsEnvironment = window.location.protocol === 'https:'
 const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

 if (!isHttpsEnvironment && !isLocalhost) {
  const action = await Confirm.show({ title: '无法开始 OTA 安装', message: '按 OpenList / Oplist 的现成方案，OTA 安装必须使用 HTTPS + 有效证书；当前环境不是 HTTPS，iOS 不会响应安装。您现在可以先直接下载 IPA，或改用 HTTPS 域名后再试。' }).then(
   () => 'download',
   () => 'cancel'
  ).catch(
   (action) => action === 'cancel' ? 'cancel' : 'close'
  )

  if (action === 'download') {
  downloadCompletedIpa()
  }
  return
 }

 if (isHttpsEnvironment) {
  Toast.success('正在打开安装链接...')
  openInstallUrl(currentVersionInstallUrl.value)
 } else if (isLocalhost) {
  const confirmed = await Confirm.show({ title: '安装前检查', message: '当前是 localhost 环境。按 OpenList / Oplist 文档，OTA 安装需要 HTTPS + 有效证书；localhost 基本不会成功。若你只是想继续试一把可以继续，否则请先切到 HTTPS 域名。' }).then(() => true).catch(() => false)

  if (confirmed) {
   openInstallUrl(currentVersionInstallUrl.value)
  }
 }
}

const startInstallFlow = async () => {
 await startDownloadWithProgress(appid.value, selectedVersion.value, false, true)
}

const directLinkDownload = async (autoPurchase = false) => {
 await startDownloadWithProgress(appid.value, selectedVersion.value, autoPurchase, false)
}

const handleAppStoreReturn = async () => {
 if (document.hidden || !pendingAppStoreCheck.value || checkingPurchaseStatus.value) return
 pendingAppStoreCheck.value = false

 // Use composable's refreshPurchaseStatus
 await refreshPurchaseStatus(appid.value, selectedVersion.value)
}

onMounted(() => {
 loadAccounts()
 loadArchivedAppIds()
 loadDownloadedIpaFiles()
 restoreStateFromStore()
 
 // 检测当前环境
 isHttps.value = window.location.protocol === 'https:'
 currentProtocol.value = window.location.protocol
 
 window.addEventListener('focus', handleAppStoreReturn)
 window.addEventListener('pageshow', handleAppStoreReturn)
 document.addEventListener('visibilitychange', handleAppStoreReturn)
 
 console.log(`[Environment] Protocol: ${currentProtocol.value}, HTTPS: ${isHttps.value}`)
})

onActivated(() => {
 loadArchivedAppIds()
 loadDownloadedIpaFiles()
})

onBeforeUnmount(() => {
 window.removeEventListener('focus', handleAppStoreReturn)
 window.removeEventListener('pageshow', handleAppStoreReturn)
 document.removeEventListener('visibilitychange', handleAppStoreReturn)
})
</script>

<style scoped>
/* ===== Orbit v3 Home Page ===== */

/* Page structure */
.home-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.home-page__fixed {
  flex-shrink: 0;
  padding-top: 20px;
}

.home-page__results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.home-page__results-inner {
  padding-bottom: 24px;
}

.home-page__title {
 font-size: 26px;
 font-weight: 700;
 color: var(--color-text);
 line-height: 1.3;
 margin-bottom: 16px;
}

.home-page__stats {
 display: flex;
 gap: 10px;
 margin-bottom: 20px;
}

.home-page__search-wrap {
 margin-bottom: 20px;
}

/* Fused variants: search input top corners square */
.search-input--fused-top :deep(.mobile-input__wrapper) {
 border-radius: 14px 14px 0 0;
}

/* Search mode toggle */
.search-mode-row {
 display: flex;
 align-items: center;
 gap: 12px;
 flex-wrap: wrap;
 margin-bottom: 8px;
}

/* Search results count */
.search-results-count {
 font-size: 12px;
 font-weight: 500;
 color: var(--color-text-muted);
 margin-bottom: 8px;
}

/* Search results hint */
.search-results-hint {
 text-align: center;
 padding: 20px 0;
 font-size: 12px;
 color: var(--color-text-tertiary);
}

/* Search results list */
.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

/* Search result item card */
.result-item {
 display: flex;
 align-items: center;
 gap: 12px;
 padding: 12px;
 border-radius: 14px;
 background: var(--color-surface-muted);
 border: 1px solid var(--color-border);
 cursor: pointer;
 transition: background 0.2s ease;
}

.result-item:active {
 background: var(--color-border-light);
}

.result-item__icon {
 width: 52px;
 height: 52px;
 border-radius: 12px;
 object-fit: cover;
 flex-shrink: 0;
}

.result-item__info {
 flex: 1;
 min-width: 0;
}

.result-item__name {
 font-size: 15px;
 font-weight: 600;
 color: var(--color-text);
 line-height: 1.3;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.result-item__dev {
 font-size: 12px;
 color: var(--color-text-muted);
 margin-top: 1px;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.result-item__meta {
 display: flex;
 flex-wrap: wrap;
 gap: 6px;
 margin-top: 4px;
}

.result-item__tag {
 font-size: 11px;
 padding: 2px 8px;
 border-radius: 4px;
 background: var(--color-bg-tag);
 color: var(--color-text-muted);
 line-height: 1.3;
}

.result-item__tag--success {
  background: var(--color-success-soft);
  color: var(--color-primary);
}

.result-item__tag--price {
  background: var(--color-blue-soft);
  color: var(--color-blue);
}

.result-item__tag--info {
  background: var(--color-blue-soft);
  color: var(--color-blue);
}

.result-item__tag--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-hover);
}

.result-item__tag--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger-hover);
}

.result-item__tag--muted {
  background: var(--color-bg-tag);
  color: var(--color-text-muted);
}

.result-item__fav {
 flex-shrink: 0;
 min-width: 32px;
 height: 32px;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 gap: 4px;
 padding: 0 8px;
 border: none;
 background: transparent;
 color: var(--color-text-tertiary);
 cursor: pointer;
 border-radius: 8px;
 transition: color 0.2s ease;
}

.result-item__fav-count {
 font-size: 11px;
 line-height: 1;
 font-weight: 700;
 min-width: 10px;
 text-align: center;
}

.result-item__fav.active {
 color: var(--color-warning);
}

.result-item__fav:hover {
 color: var(--color-warning);
}

/* Recent task list */
.recent-list {
 display: flex;
 flex-direction: column;
}

.recent-item {
 display: flex;
 align-items: center;
 gap: 12px;
 padding: 10px 0;
 cursor: pointer;
 transition: opacity 0.2s ease;
 border-bottom: 0.5px solid var(--color-border-light);
}

.recent-item:last-child {
 border-bottom: none;
}

.recent-item:active {
 opacity: 0.7;
}

.recent-item__icon {
 width: 40px;
 height: 40px;
 border-radius: 10px;
 object-fit: cover;
 flex-shrink: 0;
}

.recent-item__icon--placeholder {
 background: var(--color-surface-muted);
 display: flex;
 align-items: center;
 justify-content: center;
 color: var(--color-text-muted);
 font-size: 18px;
}

.recent-item__info {
 flex: 1;
 min-width: 0;
}

.recent-item__name {
 font-size: 14px;
 font-weight: 600;
 color: var(--color-text);
 line-height: 1.3;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.recent-item__detail {
 font-size: 12px;
 color: var(--color-text-muted);
 margin-top: 1px;
}

.recent-item__progress {
 margin-top: 4px;
}

.recent-item__arrow {
 font-size: 16px;
 color: var(--color-text-tertiary);
 flex-shrink: 0;
}

.recent-item__dl {
 flex-shrink: 0;
 width: 32px;
 height: 32px;
 display: flex;
 align-items: center;
 justify-content: center;
 border-radius: 8px;
 color: var(--color-primary);
}

/* Selected app card */
.selected-app-card {
 border-radius: 14px;
 background: var(--color-surface);
 border: 1px solid var(--color-border);
}

.selected-app-badges {
 display: flex;
 flex-wrap: wrap;
 gap: 8px;
}

.selected-app-badge,
.region-badge,
.region-badge-mini {
 display: inline-flex;
 align-items: center;
 padding: 4px 8px;
 border-radius: 6px;
 border: 1px solid var(--color-border);
 font-size: 11px;
 line-height: 1;
 color: var(--color-text-muted);
 background: transparent;
}

/* Action buttons */
.account-quick-select {
 width: 320px;
 max-width: 100%;
}

.account-option-row {
 display: flex;
 align-items: center;
 gap: 8px;
 width: 100%;
 min-width: 0;
}

.account-option-email {
 flex: 1;
 min-width: 0;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

/* Action buttons */
.action-button {
 border-radius: 8px;
 font-weight: 500;
 height: 44px;
}

.download-action-row {
 display: flex;
 gap: 8px;
 width: 100%;
}

.favorite-button {
 min-width: 100px;
}

.download-action-primary {
 flex: 1;
}

/* Empty state */
.empty-state-home {
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: center;
 padding: 48px 24px;
 text-align: center;
 margin-top: 40px;
}

.empty-state-home__icon {
 font-size: 48px;
 margin-bottom: 16px;
 opacity: 0.4;
}

.empty-state-home__title {
 font-size: 16px;
 font-weight: 600;
 color: var(--color-text);
 margin-bottom: 6px;
}

.empty-state-home__desc {
 font-size: 13px;
 color: var(--color-text-muted);
 line-height: 1.5;
}

/* Search input overrides */
/* Search input focused state - matching design mockup */
.search-input :deep(.mobile-input__wrapper.is-focused) {
  border-color: var(--color-primary) !important;
  box-shadow: var(--shadow-search-focus);
}

/* Search icon sizing per design spec (18x18) */
.search-input :deep(.mobile-input__prefix svg),
.search-input :deep(.mobile-input__prefix i) {
 width: 18px;
 height: 18px;
}

/* Form select */
.form-select {
 border-radius: 10px;
}

/* Responsive */
@media (max-width: 767px) {
 .search-mode-row {
  gap: 12px;
 }

 .download-action-row {
  flex-direction: column;
 }

 .favorite-button,
 .download-action-primary {
  width: 100%;
 }

 .action-button {
  height: 44px;
 }
}

/* ===== Dark Mode ===== */
.dark .home-page__title {
 color: var(--color-text);
}

.dark .result-item {
 background: var(--color-surface);
 border-color: var(--color-surface-muted);
}

.dark .result-item:active {
 background: var(--color-surface-muted);
}

.dark .result-item__name {
 color: var(--color-text);
}

.dark .result-item__tag {
 background: var(--color-surface-muted);
 color: var(--color-text-muted);
}

.dark .recent-item__name {
 color: var(--color-text);
}

.dark .selected-app-card {
 background: var(--color-surface);
 border-color: var(--color-surface-muted);
}

.dark .selected-app-badge,
.dark .region-badge,
.dark .region-badge-mini {
 border-color: var(--color-surface-muted);
 color: var(--color-text-muted);
}


.dark .result-item__fav {
 color: var(--color-text-tertiary);
}

.dark .result-item__fav.active,
.dark .result-item__fav:hover {
 color: var(--color-warning);
}

.dark .empty-state-home__title {
 color: var(--color-text);
}

.dark .empty-state-home__desc {
 color: var(--color-text-muted);
}

.dark .recent-item__icon--placeholder {
 background: var(--color-surface);
 color: var(--color-text-muted);
}

.dark .recent-item__arrow {
  color: var(--color-text-tertiary);
}

.dark .recent-item {
  border-bottom-color: var(--color-border);
}

.dark .search-results-hint {
  color: var(--color-text-tertiary);
}

.dark .account-select-bar {
  background: var(--color-surface-muted);
  border-color: var(--color-surface-muted);
}

.dark .account-alert {
  background: var(--color-surface-muted);
  border-color: var(--color-surface-muted);
}

.dark .result-item__dev {
  color: var(--color-text-muted);
}

.dark .search-results-count {
  color: var(--color-text-muted);
}

.dark .account-alert .text-txt {
  color: var(--color-text);
}

.dark .account-alert .text-txt-secondary {
  color: var(--color-text-muted);
}

.dark .recent-item__detail {
 color: var(--color-text-muted);
}

/* ===== Version Selection Bottom Sheet ===== */

/* Overlay */
.version-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-sheet);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Sheet Container */
.version-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: min(100%, 720px);
  max-height: min(82svh, calc(100dvh - 12px));
  background: var(--color-surface);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-dialog);
}

/* Drag Handle */
.version-sheet__handle {
 width: 36px;
 height: 4px;
 background: var(--color-border-divider);
 border-radius: 2px;
 margin: 10px auto 6px;
 cursor: pointer;
 flex-shrink: 0;
}

/* Sheet Header */
.version-sheet__header {
 display: flex;
 align-items: center;
 gap: 12px;
 padding: 8px 20px 12px;
 flex-shrink: 0;
}

.version-sheet__icon {
 width: 48px;
 height: 48px;
 border-radius: 12px;
 object-fit: cover;
 flex-shrink: 0;
}

.version-sheet__icon--placeholder {
 background: var(--color-surface-muted);
 border: 1px solid var(--color-border);
 display: flex;
 align-items: center;
 justify-content: center;
}

.version-sheet__header-info {
 flex: 1;
 min-width: 0;
}

.version-sheet__app-name {
 font-size: 17px;
 font-weight: 700;
 color: var(--color-text);
 line-height: 1.3;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.version-sheet__app-meta {
 font-size: 13px;
 color: var(--color-text-muted);
 line-height: 1.3;
 margin-top: 2px;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.version-sheet__close {
 width: 32px;
 height: 32px;
 display: flex;
 align-items: center;
 justify-content: center;
 border: none;
 background: var(--color-surface-muted);
 border-radius: 50%;
 cursor: pointer;
 color: var(--color-text-muted);
 flex-shrink: 0;
 transition: background 0.2s;
}

.version-sheet__close:active {
 background: var(--color-border);
}

/* Sheet Sections */
.version-sheet__section {
 padding: 0 20px;
 margin-bottom: 12px;
}

/* Account Row */
.version-sheet__account-row {
 display: flex;
 align-items: center;
 gap: 8px;
}

.version-sheet__account-label {
 font-size: 13px;
 font-weight: 600;
 color: var(--color-text);
 white-space: nowrap;
}

.version-sheet__account-trigger {
 display: inline-flex;
 align-items: center;
 justify-content: space-between;
 gap: 8px;
 flex: 1;
 min-width: 0;
 padding: 10px 12px;
 border-radius: 12px;
 border: 1px solid var(--color-border);
 background: var(--color-surface-muted);
 color: var(--color-text);
}

.version-sheet__account-trigger-text {
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.version-sheet__account-trigger-icon {
 width: 16px;
 height: 16px;
 flex-shrink: 0;
 color: var(--color-text-muted);
}

.version-sheet__account-hint {
 font-size: 12px;
 color: var(--color-text-muted);
 margin-top: 4px;
}

/* Fetch Button */
.version-sheet__fetch-btn {
 width: 100%;
 border-radius: 10px;
 height: 44px;
}

/* Version List Section Header */
.version-sheet__section-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 margin-bottom: 8px;
}

.version-sheet__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.version-sheet__section-count {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Version List */
.version-sheet__version-list {
 display: flex;
 flex-direction: column;
 gap: 6px;
 max-height: 220px;
 overflow-y: auto;
 padding-right: 4px;
}

/* Purchase Button */
.version-sheet__purchase-btn {
 width: 100%;
 margin-top: 8px;
 border-radius: 10px;
 height: 44px;
}

.version-sheet__purchase-btn--dock {
 margin-top: 0;
 height: 48px;
}

/* Note Input */
.version-sheet__note-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  display: block;
  margin-bottom: 6px;
}

.version-sheet__note-input {
  width: 100%;
}

.version-sheet__note-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

/* ===== Bottom Sheet ===== */
/* Action Bar */
.version-sheet__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
}

.version-sheet__actions--purchase {
 display: block;
}

.version-sheet__action-btn {
 display: flex;
 align-items: center;
 justify-content: center;
 gap: 6px;
 border: none;
 border-radius: 10px;
 height: 44px;
 font-size: 14px;
 font-weight: 600;
 cursor: pointer;
 transition: all 0.15s ease;
 flex: 1;
 min-width: 0;
}

.version-sheet__action-btn i,
.version-sheet__action-btn svg {
 width: 18px;
 height: 18px;
 flex-shrink: 0;
}

.version-sheet__action-btn--secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.version-sheet__action-btn--secondary:active {
  background: var(--color-surface-hover);
}

.version-sheet__action-btn--secondary.is-disabled {
 opacity: 0.5;
 cursor: not-allowed;
}

.version-sheet__action-btn--primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  flex: 1.3;
}

.version-sheet__action-btn--primary:active {
  background: var(--color-primary-hover);
}

.version-sheet__action-btn--primary.is-disabled {
 opacity: 0.5;
 cursor: not-allowed;
}

.version-sheet__action-btn--fav {
  background: var(--color-warning-soft);
  color: var(--color-warning-dark);
  width: 48px;
  flex: none;
}

.version-sheet__action-btn--fav:active {
  background: var(--color-warning-border);
}

.version-sheet__action-btn--fav.is-active {
  background: var(--color-warning);
  color: var(--color-text-inverse);
}

/* Action Spinner */
.version-sheet__action-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-spinner-border);
  border-top-color: var(--color-text-inverse);
  border-radius: 50%;
  animation: sheet-spin 0.6s linear infinite;
  display: inline-block;
}

/* ===== Slide-up Transition ===== */
.sheet-fade-enter-active {
 transition: opacity 0.25s ease;
}

.sheet-fade-leave-active {
 transition: opacity 0.2s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
 opacity: 0;
}

.sheet-slide-enter-active {
 transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-slide-leave-active {
 transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
 transform: translateY(100%);
}

/* ===== Dark Mode for Bottom Sheet ===== */
.dark .version-sheet {
  background: var(--color-surface);
  box-shadow: var(--shadow-dialog);
}

.dark .version-sheet__handle {
  background: var(--color-border-handle);
}

.dark .version-sheet__app-name {
 color: var(--color-text, #f5f5f5);
}

.dark .version-sheet__app-meta {
 color: var(--color-text-muted, #a1a1aa);
}

.dark .version-sheet__close {
 background: var(--color-surface-muted, #27272a);
 color: var(--color-text-muted, #a1a1aa);
}

.dark .version-sheet__close:active {
  background: var(--color-border);
}

.dark .version-sheet__account-label {
  color: var(--color-text, #f5f5f5);
}

.dark .version-sheet__account-trigger {
  background: var(--color-surface, #18181b);
  border-color: var(--color-surface-muted, #27272a);
  color: var(--color-text, #f5f5f5);
}

.dark .version-sheet__account-hint {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .version-sheet__section-title {
 color: var(--color-text, #f5f5f5);
}

.dark .version-sheet__section-count {
 color: var(--color-text-muted, #a1a1aa);
}

.dark .version-sheet__note-label {
 color: var(--color-text, #f5f5f5);
}

.dark .version-sheet__actions {
  border-top-color: var(--color-surface-muted);
  background: var(--color-surface);
}

.dark .version-sheet__action-btn--secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
  border-color: var(--color-border);
}

.dark .version-sheet__action-btn--fav {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.dark .version-sheet__action-btn--fav.is-active {
  background: var(--color-warning);
  color: var(--color-text-inverse);
}

.dark .download-disabled-hint {
  background: var(--color-danger-bg-dark);
  border-color: var(--color-surface-muted);
  color: var(--color-text-muted);
}
</style>

