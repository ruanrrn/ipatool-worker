<template>
  <div class="login-shell flex items-center justify-center bg-surface-page dark:bg-surface-dark-page px-5 py-10">
    <div class="w-full max-w-[420px]">
      <!-- Brand Area -->
      <div class="mb-8 flex flex-col items-center text-center">
        <div class="brand-icon">
          i
        </div>
        <h1 class="mb-1 text-[20px] font-bold text-txt dark:text-txt-dark">
          ipaTool
        </h1>
        <p class="text-[14px] text-txt-secondary dark:text-txt-dark-secondary">
          IPA 下载 · 签名 · 管理
        </p>
      </div>

      <form
        class="login-form space-y-3"
        @submit.prevent="handleLogin"
      >
        <MobileInput
          v-model="loginForm.username"
          label="用户名"
          required
          autocomplete="username"
          placeholder="请输入用户名"
          :error="loginErrors.username"
          @keyup.enter="handleLogin"
        />

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

        <button
          type="submit"
          class="hidden"
          aria-hidden="true"
        />

        <button
          type="button"
          class="login-btn"
          :disabled="loginLoading"
          @click="handleLogin"
        >
          {{ loginLoading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="mb-2 text-[12px] text-txt-tertiary dark:text-txt-dark-tertiary">
          首次登录需要修改初始密码
        </p>
        <p class="text-[12px] text-txt-tertiary dark:text-txt-dark-tertiary">
          v{{ appVersion }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global __APP_VERSION__ */
import { reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import MobileInput from './MobileInput.vue'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['login-success'])
const appStore = useAppStore()
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

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

function validateLoginForm() {
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

const handleLogin = async () => {
  try {
    validateLoginForm()
    loginLoading.value = true
    await appStore.loginAdmin(loginForm.username, loginForm.password)
    Toast.success('登录成功')
    emit('login-success')
  } catch (e) {
    if (e?.status === 429) {
      Toast.error(`登录尝试过多，请 ${e.retryAfter || 60} 秒后重试`)
    } else {
      Toast.error(e?.message || '登录失败')
    }
  } finally {
    loginLoading.value = false
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100svh;
  min-height: 100dvh;
  padding-bottom: max(40px, var(--kb-inset-bottom, 0px));
}

.brand-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xl);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 28px;
  font-weight: 700;
  margin-bottom: var(--space-3);
}

.login-btn {
  width: 100%;
  min-height: var(--size-control-lg);
  padding: 14px;
  border-radius: var(--radius-xl);
  border: none;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: var(--font-size-section);
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.15s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.login-btn:active:not(:disabled) {
  background: var(--color-primary-hover, #0e8c6b);
  transform: scale(0.98);
}
.login-btn:disabled {
  background: var(--color-text-disabled, #d1d5db);
  cursor: not-allowed;
}
</style>
