<template>
  <div class="settings-page">
    <div class="settings-page__fixed px-5">
      <h1 class="page-title">
        设置
      </h1>
    </div>

    <div class="settings-page__scroll">
      <div class="settings-page__scroll-inner px-5">
        <p class="section-label">
          账户
        </p>
        <div class="settings-card">
          <div class="settings-row">
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">
                👤
              </div>
              <div class="sr-label">
                登录用户名
              </div>
            </div>
            <div class="sr-right">
              <span>{{ appStore.authState.user?.username || '—' }}</span>
            </div>
          </div>
        </div>

        <p class="section-label">
          凭据加密
        </p>
        <div class="settings-card settings-card--copy">
          <div class="settings-row settings-row--copy">
            <div class="sr-left sr-left--copy">
              <div class="sr-icon sr-icon--success">
                🔐
              </div>
              <div>
                <div class="sr-label">
                  AES-256-GCM
                </div>
                <p class="sr-copy">
                  Apple 账号凭据以 AES-256-GCM 加密存储在本地浏览器中，密钥自动管理，无需手动操作。
                </p>
                <p
                  class="sr-status"
                  :class="encryptionReady ? 'sr-status--success' : 'sr-status--warning'"
                >
                  {{ encryptionReady ? '✓ 加密已就绪' : '⏳ 初始化中…' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p class="section-label">
          Apple ID 账号
        </p>
        <div
          v-if="encryptionReady"
          class="settings-card"
        >
          <div
            v-for="email in appleEmails"
            :key="email"
            class="settings-row settings-row--account"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--apple">
                🍎
              </div>
              <div class="sr-label">
                {{ email }}
              </div>
            </div>
            <div class="sr-right">
              <button
                class="sr-btn sr-btn--delete"
                @click.stop="onDeleteAccount(email)"
              >
                ✕
              </button>
            </div>
          </div>

          <button
            v-if="!showAddForm"
            class="settings-row settings-row--interactive"
            @click="showAddForm = true"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--add">
                +
              </div>
              <div class="sr-label sr-label--brand">
                添加账号
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>

          <div
            v-else
            class="add-account-form"
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
            <div class="add-account-form__actions">
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
              class="form-error"
            >
              {{ addForm.error }}
            </p>
            <p class="form-hint">
              如果账号已开启双重认证，提交后 Apple 会自动将验证码推送至您的受信任设备，届时请在上述输入框中填写验证码并重新点击“验证并添加”。
            </p>
          </div>
        </div>

        <p class="section-label">
          外观
        </p>
        <div class="settings-card">
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-appearance')"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--appearance">
                🌙
              </div>
              <div class="sr-label">
                外观配置
              </div>
            </div>
            <div class="sr-right">
              <span>{{ darkModeLabel }}</span>
              <span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <p class="section-label">
          安全
        </p>
        <div class="settings-card">
          <button
            class="settings-row settings-row--interactive"
            @click="onLogout"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--danger">
                🚪
              </div>
              <div class="sr-label sr-label--danger">
                退出登录
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <p class="section-label section-label--about">
          关于
        </p>
        <div class="settings-card settings-card--about">
          <div class="settings-row">
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">
                ℹ️
              </div>
              <div class="sr-label">
                版本号
              </div>
            </div>
            <div class="sr-right">
              <span>v{{ appVersion }}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">
                ☁️
              </div>
              <div class="sr-label">
                部署形态
              </div>
            </div>
            <div class="sr-right sr-right--wrap">
              <span>Cloudflare Worker + R2</span>
            </div>
          </div>
        </div>
      </div>
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
import { useDark } from '../composables/useDark'

const emit = defineEmits(['logout', 'navigate-to-appearance'])
const appStore = useAppStore()
const { darkModeLabel } = useDark()
const accountManager = useAppleAccountManager()
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

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
        addForm.error = hasMfaCode
          ? '验证码不正确，请确认后重试'
          : '此账号需要二次验证码。Apple 已将验证码推送至您的受信任设备，请输入后点击“验证并添加”'
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

async function onLogout() {
  if (!confirm('确认退出登录？')) return
  await appStore.logoutAdmin()
  Toast.success('已退出登录')
  emit('logout')
}

onMounted(async () => {
  await refreshState()
})
</script>

<style scoped>
.page-title {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font-size: var(--font-size-title);
  font-weight: 700;
  line-height: 1.3;
}

.settings-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: var(--font-size-md);
}

.settings-page__fixed {
  flex-shrink: 0;
  padding-top: max(var(--space-5), env(safe-area-inset-top));
  background: var(--color-bg);
}

.settings-page__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.settings-page__scroll-inner {
  padding-bottom: 24px;
}

.section-label {
  margin: 0 0 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.section-label:not(:first-child) {
  margin-top: var(--space-5);
}

.settings-card {
  overflow: hidden;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
}

.settings-card--about {
  margin-bottom: 40px;
}

.dark .settings-card {
  background: var(--color-surface);
  border-color: var(--color-surface-muted);
}

.settings-row {
  width: 100%;
  min-height: var(--size-control-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
}

.settings-row:last-child {
  border-bottom: 0;
}

.settings-row--interactive {
  cursor: pointer;
}

.settings-row--interactive:active {
  background: var(--color-surface-hover);
}

.settings-row--copy {
  align-items: flex-start;
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

.sr-left,
.sr-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.sr-left {
  flex: 1;
}

.sr-left--copy {
  align-items: flex-start;
}

.sr-right {
  flex-shrink: 0;
  justify-content: flex-end;
  color: var(--color-text-muted);
  font-size: var(--font-size-label);
}

.sr-right--wrap {
  max-width: 170px;
  text-align: right;
  white-space: normal;
}

.sr-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-base);
  background: var(--color-bg-tag);
  color: var(--color-text-muted);
  font-size: 15px;
  font-weight: 700;
}

.sr-icon--success {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.sr-icon--add,
.sr-icon--appearance {
  background: var(--color-surface-muted);
}

.sr-icon--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.sr-icon--apple,
.sr-icon--neutral {
  background: var(--color-bg-tag);
}

.sr-label {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-section);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr-label--brand {
  color: var(--color-primary);
  font-weight: 600;
}

.sr-label--danger {
  color: var(--color-danger);
}

.sr-copy,
.form-hint {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  line-height: 1.45;
}

.sr-status {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-caption);
  font-weight: 600;
}

.sr-status--success {
  color: var(--color-success);
}

.sr-status--warning {
  color: var(--color-warning);
}

.sr-arrow {
  color: var(--color-text-tertiary);
  font-size: 22px;
  line-height: 1;
}

.sr-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
}

.sr-btn--delete {
  color: var(--color-danger);
}

.add-account-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

.add-account-form__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.form-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-label);
}

.dark .settings-page__fixed {
  background: var(--color-bg);
}

.dark .settings-row {
  border-bottom-color: var(--color-surface-muted);
}

.dark .settings-row--interactive:active {
  background: var(--color-surface-muted);
}

.dark .sr-icon--add,
.dark .sr-icon--appearance,
.dark .sr-icon--apple,
.dark .sr-icon--neutral {
  background: var(--color-surface-muted);
}

.dark .sr-icon--danger {
  background: rgba(239, 68, 68, 0.15);
}
</style>
