<template>
  <div class="settings-page">
    <div class="settings-page__fixed px-5">
      <!-- Page Title -->
      <h1 class="page-title text-txt dark:text-txt-dark">
        设置
      </h1>
    </div>

    <div class="settings-page__scroll">
      <div class="settings-page__scroll-inner px-5">
        <!-- Section 1: Apple ID 账号 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          Apple ID 账号
        </p>
        <div class="settings-card">
          <!-- Account rows -->
          <div
            v-for="(account, index) in accounts"
            :key="getAccountKey(account, index)"
            class="settings-row"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--apple">
                🍎
              </div>
              <div class="sr-label">
                {{ account.email }}
              </div>
            </div>
            <div class="sr-right">
              <span>{{ getRegionLabel(account.region || 'US') }}</span><span class="sr-arrow">›</span>
            </div>
          </div>

          <!-- Add Account row -->
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-account')"
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
        </div>

        <!-- Section 2: 外观 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
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
              <span>跟随系统</span><span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <!-- Section 3: 安全 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          安全
        </p>
        <div class="settings-card">
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-changepassword')"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--danger">
                🔑
              </div>
              <div class="sr-label sr-label--danger">
                修改账号密码
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>
          <button
            class="settings-row settings-row--interactive"
            @click="showLogoutConfirm = true"
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

        <!-- Section 4: 关于 (bottom-pinned, margin-top 24px) -->
        <p class="section-label section-label--about text-txt-secondary dark:text-txt-dark-secondary">
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
              <span>v{{ appVersion }} · {{ buildId }}</span>
            </div>
          </div>
          <a
            href="https://github.com/ruanrrn/ipaTool"
            target="_blank"
            rel="noopener"
            class="settings-row settings-row--interactive"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">🔗</div>
              <div class="sr-label">GitHub</div>
            </div>
            <div class="sr-right"><span class="sr-arrow">↗</span></div>
          </a>
        </div>
      </div>
    </div>

    <!-- Logout Confirm -->
    <MobileConfirm
      v-model="showLogoutConfirm"
      icon="🚪"
      icon-color="var(--color-danger-soft)"
      title="确认退出登录？"
      message="退出后需要重新输入用户名和密码登录。已下载的 IPA 文件不会删除。"
      confirm-text="退出登录"
      cancel-text="取消"
      type="danger"
      @confirm="handleLogout"
    />
  </div>
</template>

<script setup>
/* global __APP_VERSION__, __APP_BUILD_ID__ */
import { ref } from 'vue'
import { useAppStore } from '../stores/app'
import { useAccounts, accountIdentityKey } from '../composables/useAccounts'
import { formatRegion } from '../utils/region.js'
import MobileConfirm from './MobileConfirm.vue'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['logout', 'navigate-to-appearance', 'navigate-to-account', 'navigate-to-changepassword'])
const appStore = useAppStore()
const { accounts } = useAccounts()
const appVersion = __APP_VERSION__
const buildId = __APP_BUILD_ID__

const showLogoutConfirm = ref(false)

const getAccountKey = (account, fallbackIndex = '') => accountIdentityKey(account) || account?.email || account?.token || account?.dsid || `account-${fallbackIndex}`

const getRegionLabel = (region) => formatRegion(region)

// ---- Logout ----
async function handleLogout() {
  await appStore.logoutAdmin()
  showLogoutConfirm.value = false
  Toast.success('已退出登录')
  emit('logout', {
    confirm: false,
    performLogout: false,
    toast: false
  })
}
</script>

<style scoped>
/* Page title */
.page-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 16px;
  color: var(--color-text, #0d0d0d);
}
.dark .page-title {
  color: var(--color-text, #f5f5f5);
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
  padding-top: 20px;
}

.settings-page__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.settings-page__scroll-inner {
  padding-bottom: 24px;
}

/* Section label */
.section-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted, #6e6e80);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-label--about {
  margin-top: 24px;
}

/* Settings card */
.settings-card {
  background: var(--color-surface-muted, #f7f7f8);
  border: 1px solid var(--color-border, #ebebeb);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 20px;
}
.settings-card--about {
  margin-bottom: 40px;
}
.dark .settings-card {
  background: var(--color-surface, #18181b);
  border-color: var(--color-surface-muted, #27272a);
}

/* Settings row */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--color-border, #ebebeb);
}
.settings-row:last-child {
  border-bottom: none;
}
.settings-row--interactive {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.settings-row--interactive:active {
  background: var(--color-surface-hover, #ececec);
}
.dark .settings-row {
  border-bottom-color: var(--color-surface-muted, #27272a);
}
.dark .settings-row--interactive:active {
  background: var(--color-surface, #27272a);
}

/* Row left */
.sr-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Icon */
.sr-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.sr-icon--apple {
  background: var(--color-primary-soft, #ecfdf5);
}
.sr-icon--add {
  background: var(--color-surface-muted, #f7f7f8);
  font-size: 18px;
  font-weight: 700;
}
.dark .sr-icon--add {
  background: var(--color-surface-muted, #27272a);
}
.sr-icon--appearance {
  background: var(--color-surface-muted, #f7f7f8);
}
.dark .sr-icon--appearance {
  background: var(--color-surface-muted, #27272a);
}
.sr-icon--danger {
  background: var(--color-danger-soft, #fef2f2);
}
.dark .sr-icon--danger {
  background: rgba(239, 68, 68, 0.15);
}
.sr-icon--neutral {
  background: var(--color-surface-muted, #f7f7f8);
}
.dark .sr-icon--neutral {
  background: var(--color-surface-muted, #27272a);
}

/* Label */
.sr-label {
  font-size: 15px;
  color: var(--color-text, #0d0d0d);
}
.dark .sr-label {
  color: var(--color-text, #f5f5f5);
}
.sr-label--brand {
  color: var(--color-primary, #10a37f);
}
.sr-label--danger {
  color: var(--color-danger, #ef4444);
}

/* Row right */
.sr-right {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted, #6e6e80);
  font-size: 14px;
}
.dark .sr-right {
  color: var(--color-text-muted, #a1a1aa);
}
.sr-arrow {
  color: var(--color-text-tertiary, #c0c0c0);
}
.dark .sr-arrow {
  color: var(--color-text-tertiary, #71717a);
}

.dark .section-label {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .sr-icon--apple {
  background: rgba(16, 163, 127, 0.15);
}
</style>
