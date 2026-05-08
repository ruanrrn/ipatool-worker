<template>
  <div
    id="app"
    :class="{ dark: isDark }"
    class="h-[100dvh] min-h-[100svh] overflow-hidden bg-surface-page text-txt transition-colors duration-200 dark:bg-surface-dark-page dark:text-txt-dark"
  >
    <div
      v-if="authState === 'loading'"
      class="flex h-full items-center justify-center overflow-hidden"
    >
      <div class="text-label text-txt-secondary dark:text-txt-dark-secondary">
        加载中...
      </div>
    </div>

    <Login
      v-else-if="authState === 'unauthenticated'"
      @login-success="onLoginSuccess"
    />

    <template v-else>
      <div class="mx-auto h-full max-w-[960px] overflow-hidden">
        <Shell
          @logout="handleLogout"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'

import { useDark } from './composables/useDark'
import { useAppStore } from './stores/app'
import { useKeyboardAware } from './composables/useKeyboardAware'
import { STORAGE_KEYS } from './utils/storage.js'
import { applyAccentColor } from './utils/theme'

const Shell = defineAsyncComponent(() => import('./components/Shell.vue'))
const Login = defineAsyncComponent(() => import('./components/Login.vue'))

const { isDark } = useDark()
const appStore = useAppStore()

const authState = ref('loading')

useKeyboardAware()

const lockRootViewport = () => {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'none'
}

const unlockRootViewport = () => {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
  document.body.style.overscrollBehavior = ''
}

async function checkAuth() {
  const ok = await appStore.checkAuth()
  authState.value = ok ? 'authenticated' : 'unauthenticated'
}

async function onLoginSuccess() {
  const ok = await appStore.checkAuth()
  authState.value = ok ? 'authenticated' : 'unauthenticated'
}

async function handleLogout(options = {}) {
  try {
    const shouldConfirm = options?.confirm !== false
    if (shouldConfirm) {
      const { Confirm } = await import('./components/MobileConfirm.vue')
      const ok = await Confirm.show({
        title: '退出确认',
        message: '确定要退出登录吗？',
        confirmText: '退出',
        cancelText: '取消',
        type: 'danger',
      })
      if (!ok) return
    }

    if (options?.performLogout !== false) {
      await appStore.logoutAdmin()
    }

    authState.value = 'unauthenticated'
    if (options?.toast !== false) {
      const { Toast } = await import('./components/MobileToast.vue')
      Toast.success('已退出登录')
    }
  } catch {
    // user canceled
  }
}

onMounted(() => {
  const savedAccentColor = localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR)
  if (savedAccentColor) {
    applyAccentColor(savedAccentColor)
  }
  lockRootViewport()
  checkAuth()
})

onUnmounted(() => {
  unlockRootViewport()
})
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

#app {
  isolation: isolate;
}
</style>
