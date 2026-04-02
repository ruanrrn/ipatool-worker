<template>
  <div
    id="app"
    :class="{ 'dark': isDark }"
    class="min-h-screen text-[var(--text-primary)] transition-all duration-500"
  >
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute inset-x-[-12%] top-[-12%] h-[32rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(10,132,255,0.22),transparent_62%)] blur-3xl" />
      <div class="absolute -right-24 top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(48,209,88,0.14),transparent_64%)] blur-3xl" />
      <div class="absolute bottom-0 left-[-6rem] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,159,10,0.12),transparent_68%)] blur-3xl" />
      <div class="absolute inset-0 opacity-40 mix-blend-screen [background-image:radial-gradient(circle_at_20%_24%,rgba(255,255,255,0.1),transparent_18%),radial-gradient(circle_at_76%_18%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_50%_72%,rgba(10,132,255,0.1),transparent_26%)]" />
    </div>

    <!-- Auth loading -->
    <div
      v-if="authState === 'loading'"
      class="relative z-10 flex min-h-screen items-center justify-center px-6"
    >
      <div class="glass-modal flex min-w-[220px] items-center justify-center px-8 py-6 text-sm font-medium tracking-[0.08em] text-[var(--text-secondary)]">
        加载中...
      </div>
    </div>

    <!-- Login page -->
    <Login
      v-else-if="authState === 'unauthenticated'"
      @login-success="onLoginSuccess"
    />

    <!-- Main app (authenticated) -->
    <template v-else>
      <div class="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <header class="sticky top-4 z-50 mb-6">
          <div class="glass-modal mx-auto overflow-hidden rounded-[28px] px-4 py-4 sm:px-6">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="hero-icon h-14 w-14 rounded-[22px]">
                  <svg
                    class="relative z-10 h-7 w-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </div>
                <div>

                  <h1 class="gradient-text text-2xl font-bold tracking-[-0.04em]">
                    ipaTool
                  </h1>
                  <p class="text-sm text-[var(--text-secondary)]">
                    IPA 管理工具
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl">
                <button
                  class="glass-pill glass-button flex h-11 w-11 items-center justify-center border-white/10 bg-white/10"
                  :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
                  @click="toggleDark"
                >
                  <svg
                    v-if="isDark"
                    class="h-5 w-5 text-[#ffd166]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
                  </svg>
                  <svg
                    v-else
                    class="h-5 w-5 text-[var(--text-primary)]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                </button>
                <button
                  class="glass-pill glass-button flex h-11 w-11 items-center justify-center border-white/10 bg-white/10"
                  title="退出登录"
                  @click="handleLogout"
                >
                  <svg
                    class="h-5 w-5 text-[var(--text-primary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
                <a
                  href="https://github.com/ruanrrn/ipaTool"
                  target="_blank"
                  class="glass-pill glass-button flex h-11 w-11 items-center justify-center border-white/10 bg-white/10"
                  title="查看源代码"
                >
                  <svg
                    class="h-5 w-5 text-[var(--text-primary)]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 px-0 pb-2">
          <TabLayout
            @app-selected="handleAppSelected"
            @download-started="handleDownloadStarted"
            @accounts-updated="handleAccountsUpdated"
            @remove-item="handleRemoveItem"
            @clear-queue="handleClearQueue"
            @logout="handleLogout"
          />
        </main>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, ref } from 'vue'

import { useDark } from './composables/useDark'
import { useAppStore } from './stores/app'
import { useNotifications } from './composables/useNotifications'
import TabLayout from './components/TabLayout.vue'
import Login from './components/Login.vue'
import { ElMessage } from 'element-plus'

const { isDark, toggleDark } = useDark()
const appStore = useAppStore()
const notifications = useNotifications()

const authState = ref('loading')
const API_BASE = '/api'

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' })
    const data = await res.json()
    authState.value = (data.ok && data.data) ? 'authenticated' : 'unauthenticated'
  } catch {
    authState.value = 'unauthenticated'
  }
}

function onLoginSuccess() {
  authState.value = 'authenticated'
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
  } catch { /* ignore */ }
  authState.value = 'unauthenticated'
  ElMessage.success('已退出登录')
}

const handleAppSelected = (app) => appStore.setSelectedApp(app)
const handleDownloadStarted = (task) => {
  appStore.addToQueue(task)
  appStore.activeTab = 'queue'
}
const handleRemoveItem = (index) => appStore.removeFromQueue(index)
const handleClearQueue = () => appStore.clearQueue()
const handleAccountsUpdated = () => appStore.triggerAccountsUpdate()

const updateDarkClass = () => {
  const method = isDark.value ? 'add' : 'remove'
  document.documentElement.classList[method]('dark')
  document.body.classList[method]('dark')
}

onMounted(() => {
  isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  updateDarkClass()
  checkAuth()
  notifications.init()
})

onUnmounted(() => {
  notifications.stopVersionPolling()
})

watch(isDark, updateDarkClass)
</script>
