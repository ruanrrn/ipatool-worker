// Slim Pinia store for the private Worker rewrite.
// - auth: cookie session against /auth/login + /auth/whoami + /auth/logout
// - apple: Apple ID accounts persisted in IndexedDB (encrypted with master PIN)
// - archive: list of patched IPAs uploaded to R2
//
// Legacy state (downloadState, taskQueue) is kept as in-memory only; the new
// pipeline (`useIpaPipeline`) writes progress directly to local refs.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as auth from '../utils/auth.js'

export const useAppStore = defineStore('app', () => {
  // ─── Auth state ─────────────────────────────────────────────
  const authState = ref({
    checked: false,
    loading: false,
    user: null,
  })

  const isAuthenticated = computed(() => !!authState.value.user)

  async function checkAuth() {
    authState.value.loading = true
    try {
      const data = await auth.whoami()
      authState.value.user = data?.authenticated ? { username: data.username } : null
      return !!authState.value.user
    } catch {
      authState.value.user = null
      return false
    } finally {
      authState.value.checked = true
      authState.value.loading = false
    }
  }

  async function loginAdmin(username, password) {
    const data = await auth.login(username, password)
    authState.value.user = { username: data?.username || username }
    authState.value.checked = true
    return authState.value.user
  }

  async function logoutAdmin() {
    try {
      await auth.logout()
    } catch {}
    authState.value.user = null
    authState.value.checked = true
  }

  function setAuthUser(user) {
    authState.value.user = user
  }

  // ─── Pipeline state ─────────────────────────────────────────
  const pipelineState = ref({
    stage: 'idle', // idle | downloading | patching | uploading | done | error
    progress: 0,
    message: '',
    error: null,
    assetId: null,
    appleEmail: null,
    bundleId: null,
    version: null,
    title: null,
  })

  function resetPipeline() {
    pipelineState.value = {
      stage: 'idle',
      progress: 0,
      message: '',
      error: null,
      assetId: null,
      appleEmail: null,
      bundleId: null,
      version: null,
      title: null,
    }
  }

  function setPipelineStage(stage, message = '', progress = null) {
    pipelineState.value.stage = stage
    if (message) pipelineState.value.message = message
    if (progress !== null) pipelineState.value.progress = progress
  }

  // ─── UI state ─────────────────────────────────────────
  const activeTab = ref('download')
  const accountsUpdateCounter = ref(0)
  const triggerAccountsUpdate = () => {
    accountsUpdateCounter.value++
  }

  return {
    authState,
    isAuthenticated,
    checkAuth,
    loginAdmin,
    logoutAdmin,
    setAuthUser,
    pipelineState,
    resetPipeline,
    setPipelineStage,
    activeTab,
    accountsUpdateCounter,
    triggerAccountsUpdate,
  }
})
