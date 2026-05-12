<template>
  <div class="p-4 flex flex-col gap-3">
    <!-- ─── Account Selector ─────────────────────────────────── -->
    <AccountSelector
      v-model="selectedAccount"
      :accounts="accountManager.accounts.value"
      @add-account="$emit('navigate-settings')"
      @select="onAccountSelect"
    />

    <!-- ─── Search Bar ──────────────────────────────────────── -->
    <AppSearchBar
      :account-region="currentRegion"
      @app-selected="onAppSelected"
    />

    <!-- ─── Version Select ──────────────────────────────────── -->
    <VersionSelectList
      :app="selectedApp"
      @version-change="onVersionChange"
    />

    <!-- ─── MFA Input ─────────────────────────────────────── -->
    <div v-if="selectedAccount" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-2">
      <label class="text-sm text-txt-secondary dark:text-txt-dark-secondary">二次验证码（如已开启双重认证）</label>
      <input
        v-model="mfaCode"
        type="text"
        placeholder="如未开启可不填；需要时填写 6 位数字"
        class="px-3 py-2 rounded-lg border border-bdr dark:border-bdr-dark bg-surface dark:bg-surface-dark text-txt dark:text-txt-dark text-sm"
      />
      <p class="text-xs text-txt-tertiary dark:text-txt-dark-tertiary">
        Apple 会自动将验证码推送至您的受信任设备
      </p>
    </div>

    <!-- ─── Download Button ─────────────────────────────────── -->
    <div v-if="selectedApp" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-2">
      <button
        class="bg-primary text-white rounded-xl py-3 px-6 font-semibold text-base disabled:opacity-50 w-full"
        :disabled="!canDownload || downloading"
        @click="startDownload"
      >
        {{ downloading ? '下载中…' : '开始下载' }}
      </button>
      <p v-if="!selectedAccount && accountManager.accounts.value.length === 0" class="text-xs text-txt-secondary dark:text-txt-dark-secondary mt-1">
        请先在设置中添加 Apple 账号
      </p>
    </div>

    <!-- ─── Purchase Required Prompt ────────────────────────── -->
    <div v-if="purchaseRequired" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-3">
      <div class="text-sm font-semibold text-danger">⚠️ 需要购买</div>
      <p class="text-sm text-txt dark:text-txt-dark">{{ purchaseMessage }}</p>
      <button
        class="bg-primary text-white rounded-lg py-2 px-4 text-sm font-medium w-full"
        @click="openAppStore"
      >
        前往 App Store 购买
      </button>
      <p class="text-xs text-txt-secondary dark:text-txt-dark-secondary">
        购买后请返回重新尝试下载
      </p>
    </div>

    <!-- ─── Progress ────────────────────────────────────────── -->
    <div v-if="showProgress" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-2">
      <div class="flex justify-between items-center">
        <span class="text-sm font-medium text-txt dark:text-txt-dark">{{ progressStage }}</span>
        <span class="text-sm text-txt-secondary dark:text-txt-dark-secondary">{{ Math.round(progressPercent) }}%</span>
      </div>
      <div class="h-2 bg-bdr dark:bg-bdr-dark rounded-full overflow-hidden">
        <div class="h-full bg-primary rounded-full transition-all duration-300" :style="{ width: progressPercent + '%' }" />
      </div>
      <pre v-if="logs" class="text-xs text-txt-secondary dark:text-txt-dark-secondary max-h-32 overflow-y-auto whitespace-pre-wrap break-all mt-1 m-0">{{ logs }}</pre>
    </div>

    <!-- ─── Result ──────────────────────────────────────────── -->
    <div v-if="downloadResult" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-2">
      <div class="text-sm font-semibold text-success">✅ 下载完成</div>
      <div class="text-sm"><strong>{{ downloadResult.title }}</strong> v{{ downloadResult.version }}</div>
      <div class="text-sm">Bundle ID: <code class="text-xs bg-bdr dark:bg-bdr-dark px-1 py-0.5 rounded">{{ downloadResult.bundleId }}</code></div>
      <a class="inline-block mt-1 py-2 px-5 bg-success text-white rounded-lg text-sm font-medium text-center no-underline" :href="downloadResult.installUrl" target="_blank">📲 点击安装</a>
      <div class="text-xs text-txt-tertiary dark:text-txt-dark-tertiary mt-1">Asset ID: {{ downloadResult.assetId.slice(0, 8) }}…</div>
    </div>

    <!-- ─── Error ───────────────────────────────────────────── -->
    <div v-if="downloadError && !purchaseRequired" class="bg-surface dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1">
      <div class="text-sm font-semibold text-danger">❌ 下载失败</div>
      <div class="text-sm text-txt-secondary dark:text-txt-dark-secondary">{{ downloadError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AccountSelector from './AccountSelector.vue'
import AppSearchBar from './AppSearchBar.vue'
import VersionSelectList from './VersionSelectList.vue'
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

const canDownload = computed(() => {
  return selectedAccount.value && selectedApp.value && accountManager.unlocked.value && !downloading.value
})

onMounted(async () => {
  await accountManager.refreshState()
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

function onVersionChange(versionId) {
  selectedVersionId.value = versionId
}

function openAppStore() {
  const trackId = selectedApp.value?.trackId
  if (trackId) {
    window.open(`https://apps.apple.com/app/id${trackId}`, '_blank')
  }
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
