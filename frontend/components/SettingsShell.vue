<template>
  <div class="p-4 flex flex-col gap-3">
    <!-- ─── Account Info ─────────────────────── -->
    <div class="bg-surface dark:bg-surface-dark rounded-xl p-4">
      <h2 class="text-base font-semibold text-txt dark:text-txt-dark mb-3">
        账户
      </h2>
      <p class="flex justify-between items-center text-sm">
        <span class="text-txt-secondary dark:text-txt-dark-secondary">登录用户名</span>
        <span class="text-txt dark:text-txt-dark font-medium">{{ appStore.authState.user?.username || '—' }}</span>
      </p>
    </div>

    <!-- ─── Encryption Status ────────────────── -->
    <div class="bg-surface dark:bg-surface-dark rounded-xl p-4">
      <h2 class="text-base font-semibold text-txt dark:text-txt-dark mb-3">
        凭据加密
      </h2>
      <p class="text-sm text-txt-secondary dark:text-txt-dark-secondary">
        Apple 账号凭据以 AES-256-GCM 加密存储在本地浏览器中，密钥自动管理，无需手动操作。
      </p>
      <p class="text-xs text-txt-secondary dark:text-txt-dark-secondary mt-1">
        <span
          v-if="encryptionReady"
          class="text-success"
        >✓ 加密已就绪</span>
        <span
          v-else
          class="text-warning"
        >⏳ 初始化中…</span>
      </p>
    </div>

    <!-- ─── Apple Accounts ───────────────────── -->
    <div
      v-if="encryptionReady"
      class="bg-surface dark:bg-surface-dark rounded-xl p-4"
    >
      <h2 class="text-base font-semibold text-txt dark:text-txt-dark mb-3">
        Apple 账号（{{ appleEmails.length }}）
      </h2>

      <div class="mb-3">
        <button
          v-if="!showAddForm"
          class="text-sm text-primary border border-dashed border-primary rounded-lg py-1.5 px-4"
          @click="showAddForm = true"
        >
          + 添加 Apple 账号
        </button>
        <div
          v-else
          class="p-3 border border-bdr dark:border-bdr-dark rounded-lg bg-bg dark:bg-bg-dark flex flex-col gap-2"
        >
          <MobileInput
            v-model="addForm.email"
            type="email"
            label="Apple ID"
            placeholder="example@icloud.com"
          />
          <MobileInput
            v-model="addForm.password"
            type="password"
            label="密码（App 专用密码）"
            placeholder="xxxx-xxxx-xxxx-xxxx"
          />
          <MobileInput
            v-model="addForm.mfa"
            type="text"
            label="二次验证码（如已开启双重认证）"
            placeholder="如未开启可不填；需要时填写 6 位数字"
            inputmode="numeric"
            maxlength="6"
          />
          <div class="flex gap-2 items-center">
            <MobileButton
              type="primary"
              size="small"
              :disabled="!addForm.email || !addForm.password || addForm.verifying"
              :loading="addForm.verifying"
              @click="onAddAccount"
            >
              {{ addForm.verifying ? '验证中…' : '验证并添加' }}
            </MobileButton>
            <MobileButton
              type="default"
              size="small"
              @click="resetAddForm"
            >
              取消
            </MobileButton>
          </div>
          <p
            v-if="addForm.error"
            class="text-sm text-danger"
          >
            {{ addForm.error }}
          </p>
          <p class="text-xs text-txt-secondary dark:text-txt-dark-secondary">
            如果账号已开启双重认证，提交后 Apple 会自动将验证码推送至您的受信任设备，届时请在上述输入框中填写验证码并重新点击"验证并添加"。
          </p>
        </div>
      </div>

      <ul class="list-none m-0 p-0">
        <li
          v-for="email in appleEmails"
          :key="email"
          class="flex justify-between items-center py-2 border-b border-bdr dark:border-bdr-dark last:border-b-0 text-sm"
        >
          <span>{{ email }}</span>
          <button
            class="text-xs border border-bdr dark:border-bdr-dark rounded px-2 py-1"
            @click="onDeleteAccount(email)"
          >
            删除
          </button>
        </li>
        <li
          v-if="!appleEmails.length"
          class="text-sm text-txt-secondary dark:text-txt-dark-secondary py-2"
        >
          还没有保存任何 Apple 账号
        </li>
      </ul>
    </div>

    <!-- ─── About ────────────────────────────── -->
    <div class="bg-surface dark:bg-surface-dark rounded-xl p-4">
      <h2 class="text-base font-semibold text-txt dark:text-txt-dark mb-3">
        关于
      </h2>
      <p class="flex justify-between text-sm mb-1">
        <span class="text-txt-secondary dark:text-txt-dark-secondary">版本</span>
        <span class="text-txt dark:text-txt-dark font-medium">v{{ appVersion }}</span>
      </p>
      <p class="flex justify-between text-sm">
        <span class="text-txt-secondary dark:text-txt-dark-secondary">部署形态</span>
        <span class="text-txt dark:text-txt-dark font-medium">Cloudflare Worker + R2 + Wrangler Assets</span>
      </p>
    </div>
  </div>
</template>

<script setup>
/* global __APP_VERSION__ */
import { onMounted, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAppleAccountManager } from '../composables/useAppleAccountManager.js'
import MobileInput from './MobileInput.vue'
import MobileButton from './MobileButton.vue'
import {
  listAppleAccounts,
  deleteAppleAccount,
  saveAppleAccount,
  isUnlocked,
} from '../utils/credentials.js'
import { Store } from '../utils/appleApi.js'
import { Toast } from './MobileToast.vue'

const appStore = useAppStore()
const accountManager = useAppleAccountManager()
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

// ─── Settings state ───────────────────────────────────────────
const encryptionReady = ref(false)
const appleEmails = ref([])
const showAddForm = ref(false)
const addForm = reactive({
  email: '',
  password: '',
  mfa: '',
  needsMfa: false,
  verifying: false,
  error: ''
})

async function refreshAccounts() {
  try {
    appleEmails.value = await listAppleAccounts()
  } catch {
    appleEmails.value = []
  }
}

async function refreshState() {
  // accountManager.refreshState() calls ensureInitialized() internally
  await accountManager.refreshState()
  encryptionReady.value = isUnlocked()
  if (encryptionReady.value) await refreshAccounts()
}

async function onDeleteAccount(email) {
  if (!confirm(`删除 ${email}？`)) return
  await deleteAppleAccount(email)
  await refreshAccounts()
}

function resetAddForm() {
  showAddForm.value = false
  addForm.email = ''
  addForm.password = ''
  addForm.mfa = ''
  addForm.needsMfa = false
  addForm.verifying = false
  addForm.error = ''
}

async function onAddAccount() {
  addForm.error = ''
  addForm.verifying = true
  try {
    const store = new Store()
    const result = await store.authenticate(addForm.email, addForm.password, addForm.mfa || '')

    if (result._state !== 'success') {
      const msg = result.customerMessage || ''
      const ft = result.failureType || ''
      const isMfaRequired =
        msg.includes('验证码') || msg.includes('verification') ||
        msg.includes('two-factor') || msg.includes('two step') ||
        ft === '-5000'

      if (isMfaRequired) {
        addForm.needsMfa = true
        const hasMfaCode = addForm.mfa && addForm.mfa.trim() !== ''
        if (!hasMfaCode) {
          addForm.error = '此账号需要二次验证码。Apple 已将验证码推送至您的受信任设备，请输入后点击"验证并添加"'
        } else {
          addForm.error = '验证码不正确，请确认后重试'
        }
      } else {
        addForm.error = msg || `登录失败: ${ft || '未知错误'}`
      }
      return
    }

    await saveAppleAccount({
      email: addForm.email,
      password: addForm.password,
      dsPersonId: result.dsPersonId,
      passwordToken: result.passwordToken,
      region: result.region || 'US',
    })

    resetAddForm()
    await refreshAccounts()
    Toast.success('Apple 账号已添加')
  } catch (e) {
    addForm.error = e.message || '验证失败'
  } finally {
    addForm.verifying = false
  }
}

onMounted(async () => {
  await refreshState()
})
</script>
