<template>
  <div class="flex min-h-[100svh] items-center justify-center px-4 py-10 sm:px-6">
    <div class="w-full max-w-[420px]">
      <div class="card overflow-hidden">
        <div class="mb-6 flex items-start gap-4">
          <div class="hero-icon">
            <svg
              class="h-[var(--size-icon-lg)] w-[var(--size-icon-lg)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v3H6v-3c0-1.657 1.343-3 3-3s3 1.343 3 3zm0 0V8m0-4h.01"
              />
            </svg>
          </div>
          <div>
            <p class="mb-1 text-[var(--font-size-sm)] text-secondary">
              安全登录
            </p>
            <h2 class="text-[var(--font-size-xl)] font-semibold text-primary">
              管理员登录
            </h2>
          </div>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="form-item" :class="{ 'is-error': !!loginErrors.username }">
            <MobileInput
              v-model="loginForm.username"
              label="用户名"
              required
              autocomplete="username"
              placeholder="请输入用户名"
              :error="loginErrors.username"
              @keyup.enter="handleLogin"
            />
          </div>

          <div class="form-item" :class="{ 'is-error': !!loginErrors.password }">
            <MobileInput
              v-model="loginForm.password"
              type="password"
              label="密码"
              required
              autocomplete="current-password"
              placeholder="请输入密码"
              :error="loginErrors.password"
              @keyup.enter="handleLogin"
            />
          </div>

          <MobileButton
            type="primary"
            size="large"
            native-type="submit"
            block
            class="mt-4 !h-11 w-full !rounded-[var(--radius-control)]"
            :loading="loginLoading"
          >
            登录
          </MobileButton>

          <!-- hidden submit to improve mobile enter-to-submit -->
          <button type="submit" class="hidden" aria-hidden="true"></button>
        </form>

        <div
          v-if="appStore.authState.user?.is_default"
          class="status-panel warning mt-6 p-4"
        >
          <p class="text-sm text-secondary">
            检测到仍在使用默认密码，必须先修改密码后才能进入系统
          </p>
        </div>
      </div>

      <MobileDialog
        v-model="showChangePassword"
        title="首次登录：请修改用户名和密码"
        :close-on-click-overlay="false"
        :close-on-esc="false"
        :show-close="false"
      >
        <form class="login-form" @submit.prevent="handleChangePassword">
          <div class="form-item" :class="{ 'is-error': !!pwdErrors.new_username }">
            <MobileInput
              v-model="pwdForm.new_username"
              label="新用户名"
              required
              autocomplete="off"
              placeholder="请输入新用户名"
              :error="pwdErrors.new_username"
              @keyup.enter="handleChangePassword"
            />
          </div>

          <div class="form-item" :class="{ 'is-error': !!pwdErrors.current_password }">
            <MobileInput
              v-model="pwdForm.current_password"
              type="password"
              label="当前密码"
              required
              autocomplete="current-password"
              placeholder="请输入当前密码"
              :error="pwdErrors.current_password"
              @keyup.enter="handleChangePassword"
            />
          </div>

          <div class="form-item" :class="{ 'is-error': !!pwdErrors.new_password }">
            <MobileInput
              v-model="pwdForm.new_password"
              type="password"
              label="新密码"
              required
              autocomplete="new-password"
              placeholder="请输入新密码"
              :error="pwdErrors.new_password"
              @keyup.enter="handleChangePassword"
            />
          </div>

          <div class="form-item" :class="{ 'is-error': !!pwdErrors.confirm_password }">
            <MobileInput
              v-model="pwdForm.confirm_password"
              type="password"
              label="确认新密码"
              required
              autocomplete="new-password"
              placeholder="请再次输入新密码"
              :error="pwdErrors.confirm_password"
              @keyup.enter="handleChangePassword"
            />
          </div>

          <button type="submit" class="hidden" aria-hidden="true"></button>
        </form>

        <template #footer>
          <MobileButton
            type="primary"
            native-type="submit"
            class="!rounded-[var(--radius-control)]"
            :loading="pwdLoading"
            @click="handleChangePassword"
          >
            修改密码
          </MobileButton>
        </template>
      </MobileDialog>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import MobileButton from './MobileButton.vue'
import MobileInput from './MobileInput.vue'
import MobileDialog from './MobileDialog.vue'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['login-success'])
const appStore = useAppStore()

const loginLoading = ref(false)

const loginForm = reactive({
 username: '',
 password: ''
})

const loginErrors = reactive({
 username: '',
 password: ''
})

function clearLoginErrors() {
 loginErrors.username = ''
 loginErrors.password = ''
}

async function validateLoginForm() {
 clearLoginErrors()
 if (!loginForm.username) {
 loginErrors.username = '请输入用户名'
 throw new Error('请输入用户名')
 }
 if (!loginForm.password) {
 loginErrors.password = '请输入密码'
 throw new Error('请输入密码')
 }
}

const showChangePassword = ref(false)
const pwdLoading = ref(false)

const pwdForm = reactive({
 new_username: '',
 current_password: '',
 new_password: '',
 confirm_password: ''
})

const pwdErrors = reactive({
 new_username: '',
 current_password: '',
 new_password: '',
 confirm_password: ''
})

function clearPwdErrors() {
 pwdErrors.new_username = ''
 pwdErrors.current_password = ''
 pwdErrors.new_password = ''
 pwdErrors.confirm_password = ''
}

async function validatePwdForm() {
 clearPwdErrors()

 if (!pwdForm.new_username) {
 pwdErrors.new_username = '请输入新用户名'
 throw new Error('请输入新用户名')
 }
 if (!pwdForm.current_password) {
 pwdErrors.current_password = '请输入当前密码'
 throw new Error('请输入当前密码')
 }
 if (!pwdForm.new_password) {
 pwdErrors.new_password = '请输入新密码'
 throw new Error('请输入新密码')
 }
 if (!pwdForm.confirm_password) {
 pwdErrors.confirm_password = '请确认新密码'
 throw new Error('请确认新密码')
 }
 if (pwdForm.confirm_password !== pwdForm.new_password) {
 pwdErrors.confirm_password = '两次输入的新密码不一致'
 throw new Error('两次输入的新密码不一致')
 }
}

watch(
 () => appStore.authState.user?.is_default,
 (isDefault) => {
 if (isDefault) {
 showChangePassword.value = true
 }
 },
 { immediate: true }
)

const handleLogin = async () => {
 try {
 await validateLoginForm()

 loginLoading.value = true
 const user = await appStore.loginAdmin(loginForm.username, loginForm.password)

 if (user?.is_default) {
 showChangePassword.value = true
 pwdForm.current_password = loginForm.password
 pwdForm.new_username = ''
 clearPwdErrors()
 } else {
 Toast.success('登录成功')
 emit('login-success')
 }
 } catch (e) {
 Toast.error(e?.message || '登录失败')
 } finally {
 loginLoading.value = false
 }
}

const handleChangePassword = async () => {
 try {
 await validatePwdForm()

 pwdLoading.value = true

 const res = await fetch('/api/auth/change-password', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 credentials: 'include',
 body: JSON.stringify({
 current_password: pwdForm.current_password,
 new_password: pwdForm.new_password,
 new_username: pwdForm.new_username.trim() || undefined
 })
 })

 if (!res.ok) {
 let msg = '修改密码失败'
 try {
 const json = await res.json()
 msg = json?.error || msg
 } catch {}
 throw new Error(msg)
 }

 const json = await res.json()

 Toast.success('密码修改成功，请使用新密码重新登录')
 showChangePassword.value = false

 // Clear form
 pwdForm.new_username = ''
 pwdForm.current_password = ''
 pwdForm.new_password = ''
 pwdForm.confirm_password = ''
 clearPwdErrors()

 // Properly logout: clear server session + cookie + local state
 await appStore.logoutAdmin()

 // Reload the page to force App.vue to re-check auth state.
 // Without this, the local authState in App.vue stays stale and
 // the user sees a blank/broken state instead of the login form.
 window.location.reload()
 } catch (e) {
 Toast.error(e?.message || '修改密码失败')
 } finally {
 pwdLoading.value = false
 }
}
</script>

<style scoped>
/* Element Plus 的校验错误提示是 absolute 定位，el-form-item 需要保留足够的底部空间。
   之前用 tailwind 的 space-y-* 会把 margin-bottom 覆盖成 0，导致错误提示压到下方按钮上。
*/
.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-form-item.is-error) {
  margin-bottom: 22px;
}
</style>
