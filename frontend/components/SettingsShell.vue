<template>
  <div class="page">
    <!-- ─── Re-authentication gate ─────────────────────────────── -->
    <div v-if="!reauthed" class="card reauth-card">
      <h2>验证身份</h2>
      <p class="hint">查看设置前请重新输入密码以确认身份</p>

      <form class="reauth-form" @submit.prevent="handleReauth">
        <MobileInput
          v-model="reauthForm.password"
          type="password"
          label="密码"
          required
          autocomplete="current-password"
          placeholder="请输入密码"
          :error="reauthError"
          @keyup.enter="handleReauth"
        />

        <MobileButton
          type="primary"
          size="large"
          block
          :loading="reauthLoading"
          @click="handleReauth"
        >
          验证
        </MobileButton>
      </form>
    </div>

    <!-- ─── Settings content (shown after re-auth) ────────────── -->
    <template v-else>
      <div class="card">
        <h2>账户</h2>
        <p class="row">
          <span class="label">登录用户名</span>
          <span class="value">{{ appStore.authState.user?.username || '—' }}</span>
        </p>
      </div>

      <div class="card">
        <h2>主 PIN（用于加密 Apple 凭据）</h2>
        <div v-if="!hasMasterPin">
          <p class="hint">首次启用：设置一个本地主 PIN，所有 Apple 账号将以 AES-GCM 加密存到本地 IndexedDB。<strong>PIN 不会上传，忘了就只能重置。</strong></p>
          <div class="field">
            <input v-model="newPin" type="password" placeholder="至少 4 位">
            <button class="btn-primary" :disabled="newPin.length < 4" @click="onSetPin">
              设置 PIN
            </button>
          </div>
        </div>
        <div v-else-if="!unlocked">
          <p class="hint">输入主 PIN 解锁 Apple 凭据：</p>
          <div class="field">
            <input v-model="unlockPin" type="password" placeholder="输入 PIN" @keyup.enter="onUnlock">
            <button class="btn-primary" @click="onUnlock">解锁</button>
          </div>
        </div>
        <div v-else>
          <p class="hint">主 PIN 已解锁。<button class="btn-secondary" @click="onLock">锁定</button></p>
        </div>
        <p v-if="pinError" class="error">{{ pinError }}</p>
      </div>

      <div v-if="unlocked" class="card">
        <h2>Apple 账号（{{ appleEmails.length }}）</h2>
        <ul class="account-list">
          <li v-for="email in appleEmails" :key="email">
            <span>{{ email }}</span>
            <button class="btn-secondary" @click="onDeleteAccount(email)">删除</button>
          </li>
          <li v-if="!appleEmails.length" class="empty">还没有保存任何 Apple 账号</li>
        </ul>
      </div>

      <div class="card">
        <h2>关于</h2>
        <p class="row">
          <span class="label">版本</span>
          <span class="value">v{{ appVersion }}</span>
        </p>
        <p class="row">
          <span class="label">部署形态</span>
          <span class="value">Cloudflare Worker + R2 + Wrangler Assets</span>
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
/* global __APP_VERSION__ */
import { onMounted, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  isMasterPinSet,
  isUnlocked,
  setMasterPin,
  unlockMasterPin,
  lockMasterPin,
  listAppleAccounts,
  deleteAppleAccount,
} from '../utils/credentials.js'
import MobileInput from './MobileInput.vue'
import MobileButton from './MobileButton.vue'
import { Toast } from './MobileToast.vue'

const appStore = useAppStore()
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

// ─── Re-auth state ────────────────────────────────────────────
const reauthed = ref(false)
const reauthLoading = ref(false)
const reauthError = ref('')
const reauthForm = reactive({
  password: ''
})

async function handleReauth() {
  reauthError.value = ''
  if (!reauthForm.password) {
    reauthError.value = '请输入密码'
    return
  }
  try {
    reauthLoading.value = true
    const username = appStore.authState.user?.username || ''
    await appStore.loginAdmin(username, reauthForm.password)
    reauthed.value = true
    reauthForm.password = ''
    Toast.success('身份验证成功')
    // Load settings data after re-auth
    await refreshState()
  } catch (e) {
    if (e?.status === 429) {
      reauthError.value = `尝试过多，请 ${e.retryAfter || 60} 秒后重试`
    } else {
      reauthError.value = e?.message || '密码错误'
    }
  } finally {
    reauthLoading.value = false
  }
}

// ─── Settings state ───────────────────────────────────────────
const hasMasterPin = ref(false)
const unlocked = ref(false)
const newPin = ref('')
const unlockPin = ref('')
const pinError = ref('')
const appleEmails = ref([])

async function refreshAccounts() {
  try {
    appleEmails.value = await listAppleAccounts()
  } catch {
    appleEmails.value = []
  }
}

async function refreshState() {
  hasMasterPin.value = await isMasterPinSet()
  unlocked.value = isUnlocked()
  if (unlocked.value) await refreshAccounts()
}

async function onSetPin() {
  pinError.value = ''
  try {
    await setMasterPin(newPin.value)
    newPin.value = ''
    await refreshState()
  } catch (e) {
    pinError.value = e.message
  }
}

async function onUnlock() {
  pinError.value = ''
  try {
    await unlockMasterPin(unlockPin.value)
    unlockPin.value = ''
    await refreshState()
  } catch (e) {
    pinError.value = e.message
  }
}

function onLock() {
  lockMasterPin()
  unlocked.value = false
  appleEmails.value = []
}

async function onDeleteAccount(email) {
  if (!confirm(`删除 ${email}？`)) return
  await deleteAppleAccount(email)
  await refreshAccounts()
}
</script>

<style scoped>
.page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.card {
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 16px 20px;
}
h2 { margin: 0 0 12px; font-size: 15px; }
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 6px 0;
  font-size: 14px;
}
.label { color: var(--color-text-secondary, #888); }
.value { color: var(--color-text); font-weight: 500; }
.hint { font-size: 13px; color: var(--color-text-secondary); margin: 6px 0; line-height: 1.5; }
.field {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.field input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border, #ddd);
  font-size: 14px;
}
.btn-primary {
  padding: 8px 16px;
  background: var(--color-primary, #0a84ff);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary:disabled { opacity: .4; }
.btn-secondary {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.account-list { list-style: none; margin: 0; padding: 0; }
.account-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, #eee);
  font-size: 14px;
}
.account-list li:last-child { border-bottom: none; }
.empty { color: var(--color-text-secondary); font-size: 13px; }
.error { font-size: 13px; color: #c00; margin-top: 6px; }

/* Re-auth form */
.reauth-card {
  display: flex;
  flex-direction: column;
}
.reauth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}
</style>
