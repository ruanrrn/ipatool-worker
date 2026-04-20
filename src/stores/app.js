import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api.js'

export const useAppStore = defineStore('app', () => {
  // 下载任务状态
  const downloadState = ref({
    selectedApp: null,
    appId: '',
    appVersionId: '',
    selectedAccountIndex: '',
    availableVersions: [],
    selectedVersionId: '',
    versionsLoaded: false,
    showProgressPanel: false,
    progressPercentage: 0,
    progressMessage: '',
    progressLogs: '',
    activeDownloadAppId: '',
    activeDownloadVersionId: '',
    activeDownloadAccountEmail: '',
    searchQuery: '',
    searchResults: [],
    searchResultPurchaseStatusMap: {}
  })

  // 下载任务队列
  const taskQueue = ref([])

  // 当前激活的页面标签
  const activeTab = ref('download')

  // 子页面标签状态
  const queueTab = ref('completed')
  const archiveTab = ref('favorites')

  // 账号更新计数器
  const accountsUpdateCounter = ref(0)

  // 管理员登录态
  const authState = ref({
    checked: false,
    loading: false,
    user: null
  })

  const setAuthUser = (user) => {
    authState.value.user = user
  }

  const checkAuth = async () => {
    authState.value.loading = true
    try {
      const { response: res, data: json } = await apiFetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      })

      if (!res.ok) {
        authState.value.user = null
        return false
      }

      authState.value.user = json?.data || null
      return !!authState.value.user
    } catch {
      authState.value.user = null
      return false
    } finally {
      authState.value.checked = true
      authState.value.loading = false
    }
  }

  const loginAdmin = async (username, password) => {
    const { response: res, data: json } = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    })

    if (!res.ok) {
      let msg = '登录失败'
      msg = json?.error || msg
      throw new Error(msg)
    }

    authState.value.user = json?.data || null
    authState.value.checked = true
    return authState.value.user
  }

  const logoutAdmin = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch {}
    authState.value.user = null
    authState.value.checked = true
  }

  // 设置选中的应用
  const setSelectedApp = (app) => {
    downloadState.value.selectedApp = app
    if (app && app.trackId) {
      downloadState.value.appId = String(app.trackId)
    }
  }

  // 更新下载状态
  const updateDownloadState = (key, value) => {
    if (key in downloadState.value) {
      downloadState.value[key] = value
    }
  }

  // 添加任务到队列
  const addToQueue = (item) => {
    const nextItem = {
      ...item,
      updatedAt: item?.updatedAt || new Date().toISOString()
    }
    const existingIndex = taskQueue.value.findIndex(q => q.id === nextItem.id)
    if (existingIndex >= 0) {
      // 更新现有任务
      taskQueue.value[existingIndex] = { ...taskQueue.value[existingIndex], ...nextItem }
    } else {
      // 添加新任务
      taskQueue.value.push(nextItem)
    }
  }

  // 更新队列任务
  const updateQueueItem = (id, updates) => {
    const index = taskQueue.value.findIndex(q => q.id === id)
    if (index >= 0) {
      taskQueue.value[index] = {
        ...taskQueue.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
    }
  }

  // 从队列移除任务
  const removeFromQueue = (idOrIndex) => {
    if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < taskQueue.value.length) {
      taskQueue.value.splice(idOrIndex, 1)
      return
    }

    const index = taskQueue.value.findIndex(item => item.id === idOrIndex)
    if (index >= 0) {
      taskQueue.value.splice(index, 1)
    }
  }

  // 清空任务队列
  const clearQueue = () => {
    taskQueue.value = []
  }

  // 触发账号更新
  const triggerAccountsUpdate = () => {
    accountsUpdateCounter.value++
  }

  return {
    downloadState,
    taskQueue,
    activeTab,
    queueTab,
    archiveTab,
    accountsUpdateCounter,
    authState,
    setSelectedApp,
    updateDownloadState,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    clearQueue,
    triggerAccountsUpdate,
    setAuthUser,
    checkAuth,
    loginAdmin,
    logoutAdmin
  }
})
