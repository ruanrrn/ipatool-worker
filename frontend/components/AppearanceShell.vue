<template>
  <div class="appearance-page">
    <div class="ap-nav">
      <button
        class="ap-nav__back"
        @click="emit('back')"
      >
        <SvgIcon
          class="ap-nav__back-icon"
          :icon="arrowLeftIcon"
        />
        返回
      </button>
      <div class="ap-nav__title">
        外观
      </div>
      <div class="ap-nav__spacer" />
    </div>

    <div class="ap-body">
      <div class="ap-section">
        <div class="ap-section__title">
          深色模式
        </div>
        <div class="ap-card">
          <button
            v-for="mode in darkModes"
            :key="mode.value"
            :class="['ap-option', { 'ap-option--selected': darkMode === mode.value }]"
            @click="setDarkMode(mode.value)"
          >
            <div :class="['ap-radio', { 'ap-radio--selected': darkMode === mode.value }]" />
            <div class="ap-option__info">
              <div class="ap-option__label">
                {{ mode.label }}
              </div>
              <div class="ap-option__desc">
                {{ mode.desc }}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="ap-section">
        <div class="ap-section__title">
          主题色
        </div>
        <div class="color-swatches">
          <button
            v-for="color in accentColors"
            :key="color.value"
            :aria-label="color.label"
            :class="['color-swatch', { 'color-swatch--active': accentColor === color.value }]"
            :style="{ background: color.value }"
            @click="setAccentColor(color.value)"
          >
            {{ accentColor === color.value ? '✓' : '' }}
          </button>
        </div>
      </div>

      <div class="ap-section">
        <div class="ap-section__title">
          预览效果
        </div>
        <div class="ap-preview-card">
          <div class="ap-preview-item">
            <div
              class="ap-preview-icon"
              :style="{ background: accentColor }"
            >
              📥
            </div>
            <div class="ap-preview-info">
              <div class="ap-preview-name">
                微信
              </div>
              <div class="ap-preview-detail">
                v8.0.43 · 下载中 67%
              </div>
            </div>
          </div>
        </div>
        <div class="ap-preview-card">
          <div class="ap-preview-item">
            <div class="ap-preview-icon ap-preview-icon--muted">
              🌙
            </div>
            <div class="ap-preview-info">
              <div class="ap-preview-name">
                深色模式
              </div>
              <div class="ap-preview-detail">
                {{ darkModeLabel }}
              </div>
            </div>
            <div :class="['ap-toggle', { 'ap-toggle--on': darkMode === 'dark' }]">
              <div class="ap-toggle__thumb" />
            </div>
          </div>
        </div>
      </div>

      <div class="ap-bottom-spacer" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import arrowLeftIcon from '../assets/icons/arrow-left.svg?raw'
import { useDark } from '../composables/useDark'
import { applyAccentColor } from '../utils/theme'
import { STORAGE_KEYS } from '../utils/storage.js'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['back'])

const { darkMode, darkModeLabel, setDarkMode: applyDarkModePreference } = useDark()

const darkModes = [
  { value: 'system', label: '跟随系统', desc: '自动切换浅色 / 深色' },
  { value: 'light', label: '浅色模式', desc: '始终使用浅色背景' },
  { value: 'dark', label: '深色模式', desc: '始终使用深色背景' }
]

const accentColor = ref('#10a37f')
const accentColors = [
  { value: '#10a37f', label: '绿色' },
  { value: '#3b82f6', label: '蓝色' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#f59e0b', label: '琥珀色' },
  { value: '#ef4444', label: '红色' },
  { value: '#0d0d0d', label: '黑色' }
]

onMounted(() => {
  const savedAccent = localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR)
  if (savedAccent) {
    accentColor.value = savedAccent
    applyAccentColor(savedAccent)
  }
})

function setDarkMode(mode) {
  applyDarkModePreference(mode)
}

function setAccentColor(color) {
  accentColor.value = color
  localStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color)
  applyAccentColor(color)
  Toast.success('主题色已更新')
}
</script>

<style scoped>
.appearance-page {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  min-height: 100dvh;
  background: var(--color-bg-page);
}

.ap-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: calc(56px + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) var(--space-5) 0;
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.dark .ap-nav {
  background: var(--color-surface);
  border-bottom-color: var(--color-border);
}

.ap-nav__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ap-nav__back-icon {
  width: 20px;
  height: 20px;
}

.ap-nav__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}

.ap-nav__spacer {
  flex: 1;
}

.ap-body {
  flex: 1;
  overflow-y: auto;
}

.ap-section {
  padding: var(--space-5) var(--space-5) 0;
}

.ap-section__title {
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.ap-card {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
}

.dark .ap-card,
.dark .ap-preview-card {
  background: var(--color-surface);
  border-color: var(--color-surface-muted);
}

.ap-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--size-control-lg);
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.ap-option:last-child {
  border-bottom: none;
}

.ap-option:active {
  background: var(--color-surface-hover);
}

.dark .ap-option {
  border-bottom-color: var(--color-surface-muted);
}

.dark .ap-option:active {
  background: var(--color-surface-muted);
}

.ap-radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border-divider);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease;
}

.ap-radio--selected {
  border-color: var(--color-primary);
}

.ap-radio--selected::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.ap-option__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ap-option__label,
.ap-preview-name {
  color: var(--color-text);
  font-size: var(--font-size-section);
  font-weight: 500;
}

.ap-option__desc,
.ap-preview-detail {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.color-swatch {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--radius-lg);
  color: var(--color-text-inverse);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.color-swatch:active {
  transform: scale(0.92);
}

.color-swatch--active {
  box-shadow: 0 0 0 2px var(--color-bg-white), 0 0 0 4px var(--color-primary);
}

.ap-preview-card {
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
}

.ap-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ap-preview-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-inverse);
  font-size: 18px;
}

.ap-preview-icon--muted {
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: inherit;
}

.dark .ap-preview-icon--muted {
  background: var(--color-surface-muted);
}

.ap-preview-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ap-toggle {
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--color-border-divider);
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.ap-toggle--on {
  background: var(--color-primary);
}

.ap-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}

.ap-toggle--on .ap-toggle__thumb {
  transform: translateX(18px);
}

.ap-bottom-spacer {
  height: 40px;
}
</style>
