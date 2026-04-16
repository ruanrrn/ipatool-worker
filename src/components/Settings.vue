<template>
  <div class="space-y-4">
    <!-- Account Management (Apple accounts) -->
    <AccountManager @accounts-updated="(v) => emit('accounts-updated', v)" />

    <!-- Admin Account Security -->
    <div class="card">
      <div class="mb-6 flex items-center gap-4">
        <div class="hero-icon">
          <svg
            class="w-[var(--size-icon-md)] h-[var(--size-icon-md)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary">
            账号安全
          </h3>
          <p class="text-sm text-secondary">
            修改管理员登录凭据
          </p>
        </div>
      </div>

      <!-- Current info -->
      <div class="inline-panel">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="hero-icon text-sm font-bold">
              {{ (appStore.authState.user?.username || '?')[0].toUpperCase() }}
            </div>
            <div>
              <p class="text-sm font-medium text-primary">
                {{ appStore.authState.user?.username || '未知' }}
              </p>
              <p class="text-xs text-secondary">
                管理员账号
              </p>
            </div>
          </div>
          <MobileButton
            size="small"
            @click="showChangeDialog = true"
          >
            修改账号
          </MobileButton>
        </div>
      </div>

      <MobileDialog
        v-model="showChangeDialog"
        title="修改登录凭据"
        :close-on-click-overlay="false"
      >
        <form class="space-y-3" @submit.prevent="handleChangeCredentials">
          <MobileInput
            v-model="credForm.current_password"
            type="password"
            label="当前密码"
            required
            autocomplete="current-password"
            placeholder="请输入当前密码"
            :error="credErrors.current_password"
          />

          <MobileInput
            v-model="credForm.new_username"
            label="新用户名（留空则不修改）"
            autocomplete="off"
            placeholder="输入新用户名或留空"
            :error="credErrors.new_username"
          />

          <MobileInput
            v-model="credForm.new_password"
            type="password"
            label="新密码"
            required
            autocomplete="new-password"
            placeholder="请输入新密码"
            :error="credErrors.new_password"
          />

          <MobileInput
            v-model="credForm.confirm_password"
            type="password"
            label="确认新密码"
            required
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            :error="credErrors.confirm_password"
          />

          <!-- hidden submit to enable enter-to-submit on mobile keyboards -->
          <button type="submit" class="hidden" aria-hidden="true"></button>
        </form>

        <template #footer>
          <div class="flex items-center justify-end gap-3">
            <MobileButton @click="showChangeDialog = false">
              取消
            </MobileButton>
            <MobileButton
              type="primary"
              :loading="credLoading"
              @click="handleChangeCredentials"
            >
              确认修改
            </MobileButton>
          </div>
        </template>
      </MobileDialog>
    </div>

    <!-- GitHub Integration -->
    <div class="card">
      <div class="mb-6 flex items-center gap-4">
        <div class="hero-icon">
          <svg
            class="w-[var(--size-icon-md)] h-[var(--size-icon-md)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary">
            GitHub 集成
          </h3>
          <p class="text-sm text-secondary">
            配置 PAT 以发布收藏到社区仓库
          </p>
        </div>
      </div>

      <div v-if="githubToken.loading" class="text-sm text-secondary">加载中…</div>
      <div v-else>
        <!-- PAT Status -->
        <div class="inline-panel mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-primary">
                {{ githubToken.configured ? '✅ PAT 已配置' : '⚠️ 未配置' }}
              </p>
              <p v-if="githubToken.masked" class="text-xs text-secondary mt-1 font-mono">
                {{ githubToken.masked }}
              </p>
            </div>
            <MobileButton
              v-if="githubToken.configured"
              size="small"
              variant="danger"
              :loading="githubToken.deleting"
              @click="deleteGitHubToken"
            >
              删除
            </MobileButton>
          </div>
        </div>

        <!-- Save PAT -->
        <div v-if="!githubToken.configured" class="space-y-3">
          <MobileInput
            v-model="githubToken.input"
            type="password"
            label="GitHub Personal Access Token"
            placeholder="ghp_xxxx..."
            hint="需要 repo 权限"
          />
          <MobileButton
            type="primary"
            :loading="githubToken.saving"
            :disabled="!githubToken.input.trim()"
            @click="saveGitHubToken"
          >
            保存 PAT
          </MobileButton>
        </div>
      </div>
    </div>

    <!-- Notification Settings -->
    <div class="card">
      <div class="mb-6 flex items-center gap-4">
        <div class="hero-icon bg-[var(--gradient-notification)]">
          <svg
            class="w-[var(--size-icon-md)] h-[var(--size-icon-md)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary">
            通知管理
          </h3>
          <p class="text-sm text-secondary">
            自定义浏览器通知行为
          </p>
        </div>
      </div>

      <!-- Permission -->
      <div
        v-if="notifications.permission.value !== 'granted'"
        class="status-panel mb-5 p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-secondary">
              浏览器通知未授权
            </p>
            <p class="text-xs text-secondary mt-1">
              需要授权后才能接收通知
            </p>
          </div>
          <MobileButton
            type="primary"
            size="small"
            @click="handleRequestPermission"
          >
            开启权限
          </MobileButton>
        </div>
      </div>
      <div
        v-else
        class="status-panel mb-5 p-4"
      >
        <p class="text-sm text-secondary">
          ✅ 浏览器通知已授权
        </p>
      </div>

      <!-- Toggles -->
      <div class="space-y-3">
        <div class="toggle-row flex items-center justify-between p-4">
          <div>
            <p class="text-sm font-medium text-primary">
              新版本检测
            </p>
            <p class="text-xs text-secondary mt-0.5">
              订阅应用有更新时通知
            </p>
          </div>
          <MobileSwitch
            :model-value="notifications.settings.value.versionUpdate"
            @update:model-value="(v) => toggleNotification('versionUpdate', v)"
          />
        </div>
        <div class="toggle-row flex items-center justify-between p-4">
          <div>
            <p class="text-sm font-medium text-primary">
              下载完成
            </p>
            <p class="text-xs text-secondary mt-0.5">
              IPA 下载成功时通知
            </p>
          </div>
          <MobileSwitch
            :model-value="notifications.settings.value.downloadComplete"
            @update:model-value="(v) => toggleNotification('downloadComplete', v)"
          />
        </div>
        <div class="toggle-row flex items-center justify-between p-4">
          <div>
            <p class="text-sm font-medium text-primary">
              下载失败
            </p>
            <p class="text-xs text-secondary mt-0.5">
              IPA 下载出错时通知
            </p>
          </div>
          <MobileSwitch
            :model-value="notifications.settings.value.downloadFailed"
            @update:model-value="(v) => toggleNotification('downloadFailed', v)"
          />
        </div>
      </div>
    </div>
    <div class="card">
      <div class="flex items-center space-x-3 mb-4">
        <div class="hero-icon bg-[var(--gradient-version)]">
          <svg
            class="w-[var(--size-icon-md)] h-[var(--size-icon-md)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary">
            版本信息
          </h3>
          <p class="text-sm text-secondary">
            当前前端构建版本
          </p>
        </div>
      </div>

      <div class="inline-panel">
        <p class="text-sm text-secondary">
          版本号
        </p>
        <p class="mt-1 font-mono text-base text-primary">
          v{{ appVersion }} · build {{ buildId }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global __APP_VERSION__, __APP_BUILD_ID__ */
import { reactive, ref } from 'vue'
import { useAppStore } from '../stores/app'
import { useNotifications } from '../composables/useNotifications'
import AccountManager from './AccountManager.vue'
import MobileButton from './MobileButton.vue'
import MobileInput from './MobileInput.vue'
import MobileSwitch from './MobileSwitch.vue'
import MobileDialog from './MobileDialog.vue'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['accounts-updated', 'logout'])
const appStore = useAppStore()
const notifications = useNotifications()
const appVersion = __APP_VERSION__
const buildId = __APP_BUILD_ID__

// ---- Notification helpers ----
async function handleRequestPermission() {
 const result = await notifications.requestPermission()
 if (result === 'granted') {
 Toast.success('通知权限已开启')
 } else {
 Toast.warning('通知权限被拒绝，可在浏览器设置中手动开启')
 }
}

function toggleNotification(type, value) {
 notifications.toggle(type, value)
 if (type === 'versionUpdate') {
 value ? notifications.startVersionPolling() : notifications.stopVersionPolling()
 }
}

// ---- Credential change ----
const showChangeDialog = ref(false)
const credLoading = ref(false)

const credForm = reactive({
 current_password: '',
 new_username: '',
 new_password: '',
 confirm_password: ''
})

const credErrors = reactive({
 current_password: '',
 new_username: '',
 new_password: '',
 confirm_password: ''
})

function clearCredErrors() {
 credErrors.current_password = ''
 credErrors.new_username = ''
 credErrors.new_password = ''
 credErrors.confirm_password = ''
}

async function validateCredForm() {
 clearCredErrors()

 if (!credForm.current_password) {
 credErrors.current_password = '请输入当前密码'
 throw new Error('请输入当前密码')
 }
 if (!credForm.new_password) {
 credErrors.new_password = '请输入新密码'
 throw new Error('请输入新密码')
 }
 if (!credForm.confirm_password) {
 credErrors.confirm_password = '请确认新密码'
 throw new Error('请确认新密码')
 }
 if (credForm.confirm_password !== credForm.new_password) {
 credErrors.confirm_password = '两次输入的密码不一致'
 throw new Error('两次输入的密码不一致')
 }
}

async function handleChangeCredentials() {
 try {
 await validateCredForm()
 credLoading.value = true

 const body = {
 current_password: credForm.current_password,
 new_password: credForm.new_password
 }
 const trimmed = credForm.new_username.trim()
 if (trimmed) body.new_username = trimmed

 const res = await fetch('/api/auth/change-password', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify(body)
 })

 if (!res.ok) {
 let msg = '修改失败'
 try { const j = await res.json(); msg = j?.error || msg } catch {}
 throw new Error(msg)
 }

 const json = await res.json()
 appStore.setAuthUser(json?.data || null)

 // Reset form & close
 showChangeDialog.value = false
 credForm.current_password = ''
 credForm.new_username = ''
 credForm.new_password = ''
 credForm.confirm_password = ''
 clearCredErrors()

 Toast.success('登录凭据已修改，请重新登录')
 emit('logout')
 } catch (e) {
 Toast.error(e?.message || '修改失败')
 } finally {
 credLoading.value = false
 }
}

// ---- GitHub PAT ----
const githubToken = reactive({
 loading: true,
 configured: false,
 masked: '',
 input: '',
 saving: false,
 deleting: false,
})

async function loadGitHubToken() {
 try {
   githubToken.loading = true
   const res = await fetch('/api/github/token', { credentials: 'include' })
   if (!res.ok) throw new Error('读取失败')
   const json = await res.json()
   const d = json?.data
   if (d) {
     githubToken.configured = d.configured || false
     githubToken.masked = d.masked_token || ''
   }
 } catch {
   githubToken.configured = false
 } finally {
   githubToken.loading = false
 }
}

async function saveGitHubToken() {
 try {
   githubToken.saving = true
   const res = await fetch('/api/github/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({ token: githubToken.input.trim() }),
   })
   if (!res.ok) {
     const j = await res.json().catch(() => null)
     throw new Error(j?.error || '保存失败')
   }
   const json = await res.json()
   const d = json?.data
   githubToken.configured = true
   githubToken.masked = d?.masked_token || ''
   githubToken.input = ''
   Toast.success('GitHub PAT 已保存')
 } catch (e) {
   Toast.error(e?.message || '保存失败')
 } finally {
   githubToken.saving = false
 }
}

async function deleteGitHubToken() {
 try {
   githubToken.deleting = true
   const res = await fetch('/api/github/token', {
     method: 'DELETE',
     credentials: 'include',
   })
   if (!res.ok) throw new Error('删除失败')
   githubToken.configured = false
   githubToken.masked = ''
   Toast.success('GitHub PAT 已删除')
 } catch (e) {
   Toast.error(e?.message || '删除失败')
 } finally {
   githubToken.deleting = false
 }
}

loadGitHubToken()
</script>
