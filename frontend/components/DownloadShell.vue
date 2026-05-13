<template>
  <div class="download-page page-shell">
    <div class="download-page__fixed px-5">
      <h1 class="download-page__title">
        首页
      </h1>
      <div class="download-page__search-wrap">
        <AppSearchBar
          :account-region="currentRegion"
          @app-selected="onAppSelected"
          @results-change="onSearchResults"
          @searching-change="onSearchingChange"
          @query-change="onQueryChange"
        />
        <AccountSelector
          v-model="selectedAccount"
          class="account-picker-fused"
          :accounts="accountManager.accounts.value"
          :account-regions="accountRegionsMap"
          @add-account="$emit('navigate-settings')"
          @select="onAccountSelect"
        />
      </div>
    </div>

    <div class="download-page__scroll">
      <div class="download-page__scroll-inner px-5">
        <!-- 搜索结果计数 -->
        <p
          v-if="searchResults.length > 0 && !searching"
          class="search-results-count"
        >
          找到 {{ searchResults.length }} 个结果
        </p>

        <!-- 搜索结果卡片列表 -->
        <div
          v-for="app in searchResults"
          :key="app.trackId"
          class="result-item"
          @click="selectApp(app)"
        >
          <img
            :src="app.artworkUrl100 || app.artworkUrl60"
            class="result-item__icon"
          >
          <div class="result-item__info">
            <h3 class="result-item__name">{{ app.trackName }}</h3>
            <p class="result-item__dev">{{ app.artistName }}</p>
            <div class="result-item__meta">
              <span class="result-item__tag">{{ getCategory(app) }}</span>
              <span class="result-item__tag">v{{ app.version }}</span>
              <span class="result-item__tag">{{ getSizeLabel(app) }}</span>
              <span class="result-item__tag result-item__tag--price">{{ getPriceLabel(app) }}</span>
            </div>
          </div>
        </div>

        <!-- 搜索中状态 -->
        <div
          v-if="searching && searchResults.length === 0"
          class="empty-state-home"
        >
          <div class="empty-state-home__icon">
            🔍
          </div>
          <p class="empty-state-home__title">
            搜索中…
          </p>
        </div>

        <!-- 直接 App ID 确认面板 -->
        <div
          v-if="isAppIdInput && searchQuery && searchResults.length === 0 && !searching && !selectedApp"
          class="status-panel"
        >
          <div class="status-panel__title">
            📱 直接通过 App ID 下载
          </div>
          <p class="status-panel__text">
            将使用 App ID: <code>{{ searchQuery.trim() }}</code> 直接获取应用信息
          </p>
          <MobileButton
            type="primary"
            size="medium"
            block
            @click="confirmDirectAppId"
          >
            确认并搜索
          </MobileButton>
        </div>

        <!-- 空状态 -->
        <div
          v-if="searchResults.length === 0 && !selectedApp && !searching && !isAppIdInput"
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

    <Transition name="sheet-fade">
      <div
        v-if="selectedApp"
        class="download-sheet-overlay"
        @click.self="clearSelectedApp"
      >
        <Transition name="sheet-slide">
          <div
            v-if="selectedApp"
            class="download-sheet"
          >
            <div
              class="download-sheet__handle"
              @click="clearSelectedApp"
            />
            <div class="download-sheet__header">
              <img
                v-if="selectedApp.artworkUrl100 || selectedApp.artworkUrl60"
                :src="selectedApp.artworkUrl100 || selectedApp.artworkUrl60"
                :alt="selectedApp.trackName"
                class="download-sheet__icon"
              >
              <div class="download-sheet__app">
                <h2>{{ selectedApp.trackName }}</h2>
                <p>{{ selectedApp.artistName }}</p>
              </div>
              <button
                class="download-sheet__close"
                @click="clearSelectedApp"
              >
                ×
              </button>
            </div>

            <div class="download-sheet__body">
              <VersionSelectList
                :app="selectedApp"
                @version-change="onVersionChange"
              />

              <div
                v-if="selectedAccount"
                class="mfa-card"
              >
                <MobileInput
                  v-model="mfaCode"
                  type="text"
                  label="二次验证码（如已开启双重认证）"
                  placeholder="如未开启可不填；需要时填写 6 位数字"
                  inputmode="numeric"
                  maxlength="6"
                  hint="Apple 会自动将验证码推送至您的受信任设备"
                />
              </div>

              <p
                v-if="!selectedAccount && accountManager.accounts.value.length === 0"
                class="sheet-hint"
              >
                请先在设置中添加 Apple 账号
              </p>

              <!-- 购买提示面板（从首页移入） -->
              <div
                v-if="purchaseRequired"
                class="status-panel status-panel--warning"
              >
                <div class="status-panel__title">
                  ⚠️ 需要购买
                </div>
                <p class="status-panel__text">
                  {{ purchaseMessage }}
                </p>
                <MobileButton
                  type="primary"
                  size="medium"
                  block
                  @click="openAppStore"
                >
                  前往 App Store 购买
                </MobileButton>
                <p class="status-panel__hint">
                  购买后请返回重新尝试下载
                </p>
              </div>

              <!-- 进度面板（从首页移入） -->
              <div
                v-if="showProgress"
                class="status-panel"
              >
                <div class="progress-head">
                  <span class="progress-head__stage">{{ progressStage }}</span>
                  <span class="progress-head__percent">{{ Math.round(progressPercent) }}%</span>
                </div>
                <ProgressBar :value="progressPercent" />
                <pre
                  v-if="logs"
                  class="progress-log"
                >{{ logs }}</pre>
              </div>

              <!-- 下载结果面板（从首页移入） -->
              <div
                v-if="downloadResult"
                class="status-panel status-panel--success"
              >
                <div class="status-panel__title">
                  ✅ 下载完成
                </div>
                <div class="result-title">
                  {{ downloadResult.title }} v{{ downloadResult.version }}
                </div>
                <div class="result-meta">
                  Bundle ID: <code>{{ downloadResult.bundleId }}</code>
                </div>
                <a
                  class="install-link"
                  :href="downloadResult.installUrl"
                  target="_blank"
                >📲 点击安装</a>
                <div class="status-panel__hint">
                  Asset ID: {{ downloadResult.assetId.slice(0, 8) }}…
                </div>
              </div>

              <!-- 错误面板（从首页移入） -->
              <div
                v-if="downloadError && !purchaseRequired"
                class="status-panel status-panel--danger"
              >
                <div class="status-panel__title">
                  ❌ 下载失败
                </div>
                <div class="status-panel__text">
                  {{ downloadError }}
                </div>
              </div>
            </div>

            <div class="download-sheet__actions">
              <!-- 安装按钮（如有下载结果） -->
              <a
                v-if="downloadResult && downloadResult.installUrl"
                class="install-link install-link--action"
                :href="downloadResult.installUrl"
                target="_blank"
              >
                📲 安装应用
              </a>
              <!-- 下载按钮 -->
              <MobileButton
                v-else
                type="primary"
                size="large"
                block
                :disabled="!canDownload || downloading"
                :loading="downloading"
                @click="startDownload"
              >
                {{ downloading ? '下载中…' : '开始下载' }}
              </MobileButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import AccountSelector from './AccountSelector.vue'
import AppSearchBar from './AppSearchBar.vue'
import VersionSelectList from './VersionSelectList.vue'
import MobileInput from './MobileInput.vue'
import MobileButton from './MobileButton.vue'
import ProgressBar from './ProgressBar.vue'
import { useAppleAccountManager } from '../composables/useAppleAccountManager.js'
import { runPipeline } from '../utils/ipaPipeline.js'

defineEmits(['navigate-settings'])

const accountManager = useAppleAccountManager()
const selectedAccount = ref('')
const currentRegion = ref('US')
const selectedApp = ref(null)
const selectedVersionId = ref('')
const downloading = ref(false)
const mfaCode = ref('')
const showProgress = ref(false)
const progressPercent = ref(0)
const progressStage = ref('')
const logs = ref('')
const downloadResult = ref(null)
const downloadError = ref('')
const purchaseRequired = ref(false)
const purchaseMessage = ref('')

// 新增 refs
const searchResults = ref([])
const searching = ref(false)
const searchQuery = ref('')

// 构建 accountRegions 供 AccountSelector 显示
const accountRegionsMap = reactive({})
async function loadAllAccountRegions() {
  for (const email of accountManager.accounts.value) {
    try {
      const creds = await accountManager.getAccountCredentials(email)
      if (creds?.region) accountRegionsMap[email] = creds.region
    } catch { /* ignore */ }
  }
}

const canDownload = computed(() => {
  return selectedAccount.value && selectedApp.value && accountManager.unlocked.value && !downloading.value
})

const isAppIdInput = computed(() => /^\d+$/.test(searchQuery.value.trim()))

onMounted(async () => {
  await accountManager.refreshState()
  await loadAllAccountRegions()
})

async function onAccountSelect(email) {
  selectedAccount.value = email
  try {
    const creds = await accountManager.getAccountCredentials(email)
    if (creds) currentRegion.value = creds.region || 'US'
  } catch {
    currentRegion.value = 'US'
  }
}

function onAppSelected(app) {
  selectedApp.value = app
  downloadResult.value = null
  downloadError.value = null
  purchaseRequired.value = false
  purchaseMessage.value = ''
}

function clearSelectedApp() {
  if (downloading.value) return
  selectedApp.value = null
}

function onVersionChange(versionId) {
  selectedVersionId.value = versionId
}

function openAppStore() {
  const trackId = selectedApp.value?.trackId
  if (trackId) {
    window.open(`https://apps.apple.com/app/id${trackId}`, '_blank')
  }
}

// 新增方法：从 AppSearchBar 接收事件
function onSearchResults(results) {
  searchResults.value = results
}

function onSearchingChange(val) {
  searching.value = val
}

function onQueryChange(val) {
  searchQuery.value = val
}

function selectApp(app) {
  onAppSelected(app)
}

function confirmDirectAppId() {
  const appid = searchQuery.value.trim()
  if (appid) {
    // 触发 AppSearchBar 的 app-selected 事件，
    // 直接构造一个最小的 app 对象以触发 sheet 打开
    onAppSelected({ trackId: Number(appid), trackName: `App #${appid}`, artistName: '' })
  }
}

// Helper 函数
function getCategory(app) {
  return app.primaryGenreName || app.kind || ''
}

function getSizeLabel(app) {
  const bytes = app.fileSizeBytes
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

function getPriceLabel(app) {
  if (!app.formattedPrice || app.formattedPrice === '0.00' || app.formattedPrice === 'Free') return '免费'
  return app.formattedPrice
}

async function startDownload() {
  if (!canDownload.value) return
  downloadError.value = null
  downloadResult.value = null
  purchaseRequired.value = false
  purchaseMessage.value = ''
  downloading.value = true
  showProgress.value = true
  progressPercent.value = 0
  progressStage.value = '准备中…'
  logs.value = ''

  try {
    const email = selectedAccount.value
    const creds = await accountManager.getAccountCredentials(email)
    if (!creds) throw new Error('无法读取账号凭据，请刷新页面重试')
    const appId = String(selectedApp.value.trackId)
    const appVerId = selectedVersionId.value || undefined

    const currentMfa = mfaCode.value.trim()

    const result = await runPipeline({
      email: creds.email,
      applePassword: creds.password,
      mfa: currentMfa,
      appIdentifier: appId,
      appVerId,
      savedAuth: creds.dsPersonId && creds.passwordToken ? {
        dsPersonId: creds.dsPersonId,
        passwordToken: creds.passwordToken,
      } : null,
      onAuthUpdated: async (newAuth) => {
        try {
          await accountManager.updateAccountCredentials(email, {
            dsPersonId: newAuth.dsPersonId,
            passwordToken: newAuth.passwordToken,
            region: newAuth.region || creds.region,
          })
        } catch (e) {
          console.warn('更新凭据失败:', e)
        }
      },
      onStage: ({ stage, progress, message }) => {
        progressPercent.value = progress * 100
        progressStage.value = message
        logs.value += `[${stage}] ${message}\n`
      },
    })
    downloadResult.value = result
    progressStage.value = '完成！'
    progressPercent.value = 100
  } catch (e) {
    if (e.purchaseRequired) {
      purchaseRequired.value = true
      purchaseMessage.value = e.message
      downloadError.value = ''
    } else {
      downloadError.value = e.message || '下载失败'
      if (e.appleResult) {
        const msg = e.appleResult.customerMessage || ''
        if (msg.includes('验证码') || msg.includes('verification') || msg.includes('two-factor')) {
          downloadError.value = 'Apple 账号需要二次验证。请到设置页重新登录该账号并提供验证码。'
        }
      }
    }
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.download-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.download-page__fixed {
  flex-shrink: 0;
  padding-top: max(var(--space-5), env(safe-area-inset-top));
  background: var(--color-bg);
}

.download-page__title {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font-size: var(--font-size-title);
  font-weight: 700;
  line-height: 1.2;
}

.download-page__search-wrap {
  margin-bottom: var(--space-3);
}

.account-picker-fused {
  margin-top: -1px;
}

.download-page__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.download-page__scroll-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
  padding-bottom: 24px;
}

/* 搜索结果计数 */
.search-results-count {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

/* 搜索结果卡片 */
.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.result-item:active {
  background: var(--color-border-light);
}

.result-item__icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
  object-fit: cover;
}

.result-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-item__name {
  margin: 0;
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__dev {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: 2px;
}

.result-item__tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 99px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  background: var(--color-border-light);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.result-item__tag--price {
  background: var(--color-success-bg, rgba(52, 199, 89, 0.1));
  color: var(--color-success, #34c759);
}

/* 空状态 */
.empty-state-home {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-state-home__icon {
  font-size: 32px;
  margin-bottom: var(--space-2);
}

.empty-state-home__title {
  margin: 0;
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
}

.empty-state-home__desc {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

/* 状态面板（Sheet 内使用） */
.status-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2-5);
}

.status-panel--success {
  border-color: var(--color-success-border);
}

.status-panel--warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
}

.status-panel--danger {
  border-color: var(--color-danger-border);
  background: var(--color-danger-bg);
}

.status-panel__title,
.result-title {
  font-size: var(--font-size-body);
  font-weight: 700;
  color: var(--color-text);
}

.status-panel__text,
.result-meta {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.status-panel__hint {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.progress-head__stage {
  font-size: var(--font-size-label);
  font-weight: 600;
  color: var(--color-text);
}

.progress-head__percent {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.progress-log {
  max-height: 128px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.install-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border-radius: var(--radius-lg);
  background: var(--color-success);
  color: var(--color-text-inverse);
  font-size: var(--font-size-label);
  font-weight: 600;
  text-decoration: none;
}

.install-link--action {
  display: flex;
  width: 100%;
  text-align: center;
}

/* Sheet */
.download-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--overlay-sheet);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.download-sheet {
  width: 100%;
  max-width: 600px;
  max-height: min(86vh, 720px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--color-surface);
  box-shadow: var(--shadow-sheet);
}

.download-sheet__handle {
  width: 36px;
  height: 4px;
  margin: var(--space-3) auto var(--space-2);
  border-radius: var(--radius-xs);
  background: var(--color-border-divider);
  cursor: pointer;
  flex-shrink: 0;
}

.download-sheet__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4) var(--space-4);
  flex-shrink: 0;
}

.download-sheet__icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  flex-shrink: 0;
}

.download-sheet__app {
  flex: 1;
  min-width: 0;
}

.download-sheet__app h2 {
  margin: 0;
  font-size: var(--font-size-section);
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-sheet__app p {
  margin: var(--space-0-5) 0 0;
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-sheet__close {
  width: var(--size-8);
  height: var(--size-8);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.download-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.mfa-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
  padding: var(--space-3);
}

.sheet-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
}

.download-sheet__actions {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

.dark .download-page__fixed {
  background: var(--color-bg);
}

.dark .download-sheet,
.dark .download-sheet__actions {
  background: var(--color-surface);
}
</style>
