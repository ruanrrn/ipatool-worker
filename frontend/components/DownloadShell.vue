<template>
  <div class="page">
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
    <div v-if="selectedAccount" class="card mfa-card">
      <label class="mfa-label">二次验证码（如已开启双重认证）</label>
      <input
        v-model="mfaCode"
        type="text"
        placeholder="如未开启可不填；需要时填写 6 位数字"
        class="mfa-input"
      />
      <p class="hint mfa-hint">
        Apple 会自动将验证码推送至您的受信任设备
      </p>
    </div>

    <!-- ─── Download Button ─────────────────────────────────── -->
    <div v-if="selectedApp" class="card download-card">
      <button class="btn-download" :disabled="!canDownload || downloading" @click="startDownload">
        {{ downloading ? '下载中…' : '开始下载' }}
      </button>
      <p v-if="!selectedAccount && accountManager.accounts.value.length === 0" class="hint">
        请先在设置中添加 Apple 账号
      </p>
      <p v-else-if="!accountManager.unlocked.value" class="hint">
        主 PIN 未解锁，请先到设置页解锁
      </p>
    </div>

    <!-- ─── Progress ────────────────────────────────────────── -->
    <div v-if="showProgress" class="card progress-card">
      <div class="progress-head">
        <span class="progress-stage">{{ progressStage }}</span>
        <span class="progress-pct">{{ Math.round(progressPercent) }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
      <pre v-if="logs" class="progress-logs">{{ logs }}</pre>
    </div>

    <!-- ─── Result ──────────────────────────────────────────── -->
    <div v-if="downloadResult" class="card result-card">
      <div class="result-title">✅ 下载完成</div>
      <div class="result-line"><strong>{{ downloadResult.title }}</strong> v{{ downloadResult.version }}</div>
      <div class="result-line">Bundle ID: <code>{{ downloadResult.bundleId }}</code></div>
      <a class="btn-install" :href="downloadResult.installUrl" target="_blank">📲 点击安装</a>
      <div class="result-meta">Asset ID: {{ downloadResult.assetId.slice(0, 8) }}…</div>
    </div>

    <!-- ─── Error ───────────────────────────────────────────── -->
    <div v-if="downloadError" class="card error-card">
      <div class="error-title">❌ 下载失败</div>
      <div class="error-msg">{{ downloadError }}</div>
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
}

function onVersionChange(versionId) {
  selectedVersionId.value = versionId
}

async function startDownload() {
  if (!canDownload.value) return
  if (!accountManager.unlocked.value) {
    downloadError.value = '主 PIN 未解锁，请先到设置页解锁'
    return
  }
  downloadError.value = null
  downloadResult.value = null
  downloading.value = true
  showProgress.value = true
  progressPercent.value = 0
  progressStage.value = '准备中…'
  logs.value = ''

  try {
    const email = selectedAccount.value
    const creds = await accountManager.getAccountCredentials(email)
    if (!creds) throw new Error('无法读取账号凭据，请检查主 PIN 是否已解锁')
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
    downloadError.value = e.message || '下载失败'
    if (e.appleResult) {
      const msg = e.appleResult.customerMessage || ''
      if (msg.includes('验证码') || msg.includes('verification') || msg.includes('two-factor')) {
        downloadError.value = 'Apple 账号需要二次验证。请到设置页重新登录该账号并提供验证码。'
      }
    }
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

/* ── card base ── */
.card {
  background: var(--color-surface, #fff);
  border-radius: 10px; padding: 16px 20px;
}

/* ── Download button ── */
.download-card { display: flex; flex-direction: column; gap: 8px; }
.btn-download {
  padding: 14px 24px; border-radius: 10px; border: none;
  background: var(--color-primary, #0a84ff); color: #fff;
  font-size: 16px; font-weight: 600; cursor: pointer;
}
.btn-download:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { font-size: 12px; color: var(--color-text-secondary, #888); margin: 0; }

/* ── Progress ── */
.progress-card { display: flex; flex-direction: column; gap: 8px; }
.progress-head { display: flex; justify-content: space-between; align-items: center; }
.progress-stage { font-size: 13px; font-weight: 500; }
.progress-pct { font-size: 13px; color: var(--color-text-secondary, #888); }
.progress-track { height: 6px; background: var(--color-bg-secondary, #eee); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary, #0a84ff); border-radius: 3px; transition: width 0.3s ease; }
.progress-logs { margin: 0; font-size: 11px; color: var(--color-text-secondary, #888); max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }

/* ── Result ── */
.result-card { display: flex; flex-direction: column; gap: 6px; }
.result-title { font-size: 15px; font-weight: 600; color: #34c759; }
.result-line { font-size: 14px; }
.result-line code { font-size: 12px; background: var(--color-bg-secondary, #eee); padding: 1px 4px; border-radius: 3px; }
.btn-install {
  display: inline-block; margin-top: 4px; padding: 10px 20px;
  background: #34c759; color: #fff; border-radius: 8px;
  text-decoration: none; font-size: 14px; font-weight: 500; text-align: center;
}
.result-meta { font-size: 11px; color: var(--color-text-tertiary, #aaa); margin-top: 2px; }

/* ── Error ── */
.error-card { display: flex; flex-direction: column; gap: 4px; }
.error-title { font-size: 15px; font-weight: 600; color: #ff3b30; }
.error-msg { font-size: 13px; color: var(--color-text-secondary, #888); }

/* ── MFA ── */
.mfa-card { display: flex; flex-direction: column; gap: 6px; }
.mfa-label { font-size: 13px; color: var(--color-text-secondary, #888); }
.mfa-input {
  padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  font-size: 14px; background: var(--color-bg, #fff);
  color: var(--color-text);
}
.mfa-hint { font-size: 12px; color: var(--color-text-tertiary, #aaa); margin-top: 2px; }
</style>
