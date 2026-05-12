// Singleton composable: all components share the same IndexedDB-backed
// Apple account state. Use as useAppleAccountManager() anywhere.

import { ref, computed } from 'vue'
import {
  isMasterPinSet,
  isUnlocked,
  unlockMasterPin,
  setMasterPin,
  lockMasterPin,
  listAppleAccounts,
  saveAppleAccount,
  loadAppleAccount,
  deleteAppleAccount,
  ensureInitialized,
} from '../utils/credentials.js'
import { Store } from '../utils/appleApi.js'

// -- module-level singleton state --
const accounts = ref([])
const unlocked = ref(false)
const hasPin = ref(false)
const verifying = ref(false)
const verifyError = ref('')
const verifyResult = ref(null)
const loading = ref(false)

let _stateInitialized = false

export function useAppleAccountManager() {
  // -- computed --
  const accountsCount = computed(() => accounts.value.length)
  const isReady = computed(() => hasPin.value && unlocked.value)

  // -- actions --
  async function refreshState() {
    loading.value = true
    try {
      // ensureInitialized auto-generates key on first visit,
      // or restores it on subsequent visits. User never sees a PIN.
      await ensureInitialized()
      hasPin.value = await isMasterPinSet()
      unlocked.value = isUnlocked()
      if (unlocked.value) await refreshAccounts()
    } finally {
      loading.value = false
      _stateInitialized = true
    }
  }

  async function refreshAccounts() {
    try {
      const emails = await listAppleAccounts()
      accounts.value = emails || []
    } catch {
      accounts.value = []
    }
  }

  async function setupPin(pin) {
    await setMasterPin(pin)
    await refreshState()
  }

  async function unlock(pin) {
    await unlockMasterPin(pin)
    await refreshState()
  }

  function lock() {
    lockMasterPin()
    unlocked.value = false
    accounts.value = []
  }

  /**
   * Verify Apple ID + optional MFA, save credentials to IndexedDB.
   */
  async function verifyAndAddAccount(email, password, mfa) {
    verifying.value = true
    verifyError.value = ''
    verifyResult.value = null

    try {
      const store = new Store()
      const result = await store.authenticate(email, password, mfa || '')

      if (result._state !== 'success') {
        const msg = result.customerMessage || ''
        const ft = result.failureType || ''
        if (
          msg.includes('验证码') || msg.includes('verification') ||
          msg.includes('two-factor') || msg.includes('two step') ||
          ft === '-5000'
        ) {
          verifyError.value = '需要二次验证码，请输入 6 位验证码后重试'
        } else {
          verifyError.value = msg || `登录失败: ${ft || '未知错误'}`
        }
        verifyResult.value = result
        return null
      }

      await saveAppleAccount({
        email,
        password,
        dsPersonId: result.dsPersonId,
        passwordToken: result.passwordToken,
        region: result.region || 'US',
      })

      await refreshAccounts()
      verifyResult.value = result
      return result
    } catch (e) {
      verifyError.value = e.message || '验证失败'
      return null
    } finally {
      verifying.value = false
    }
  }

  async function getAccountCredentials(email) {
    try {
      return await loadAppleAccount(email)
    } catch {
      return null
    }
  }

  async function removeAccount(email) {
    await deleteAppleAccount(email)
    await refreshAccounts()
  }

  /**
   * Update saved credentials (dsPersonId / passwordToken / region)
   * without changing the password. Used after a fresh Apple auth to
   * persist updated session tokens so they can be reused later.
   */
  async function updateAccountCredentials(email, updates) {
    const existing = await loadAppleAccount(email)
    if (!existing) throw new Error('账号不存在')
    await saveAppleAccount({
      email,
      password: existing.password,
      dsPersonId: updates.dsPersonId ?? existing.dsPersonId,
      passwordToken: updates.passwordToken ?? existing.passwordToken,
      region: updates.region ?? existing.region,
    })
  }

  // auto-init first use
  if (!_stateInitialized) refreshState()

  return {
    accounts,
    unlocked,
    hasPin,
    verifying,
    verifyError,
    verifyResult,
    loading,
    accountsCount,
    isReady,
    refreshState,
    refreshAccounts,
    setupPin,
    unlock,
    lock,
    verifyAndAddAccount,
    getAccountCredentials,
    removeAccount,
    updateAccountCredentials,
  }
}
