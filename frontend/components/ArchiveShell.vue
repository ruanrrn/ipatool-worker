<template>
  <div class="page">
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!assets.length" class="empty">还没有任何已签 IPA。先去"下载"页生成一个。</div>
    <div v-else class="list">
      <div v-for="a in assets" :key="a.assetId" class="item">
        <div class="info">
          <div class="title">{{ a.title }}</div>
          <div class="meta">
            版本 {{ a.version }} · {{ formatSize(a.size) }} · <code>{{ a.bundleId }}</code>
          </div>
          <div class="meta-tiny">{{ formatDate(a.uploadedAt) }} · ID {{ a.assetId.slice(0, 8) }}</div>
        </div>
        <div class="actions">
          <a class="btn install" :href="`/i/${a.assetId}`" target="_blank">装机</a>
          <button class="btn delete" :disabled="deletingId === a.assetId" @click="onDelete(a.assetId)">
            {{ deletingId === a.assetId ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { apiFetch } from '../utils/api.js'

const loading = ref(true)
const assets = ref([])
const deletingId = ref(null)

function formatSize(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}
function formatDate(t) {
  return new Date(t).toLocaleString()
}

async function load() {
  loading.value = true
  try {
    const { response, data } = await apiFetch('/r2/list', { method: 'GET' })
    if (response.ok && Array.isArray(data?.assets)) {
      assets.value = data.assets
    } else {
      assets.value = []
    }
  } catch {
    assets.value = []
  } finally {
    loading.value = false
  }
}

async function onDelete(assetId) {
  if (!confirm('确认删除这个 IPA？将从 R2 永久移除。')) return
  deletingId.value = assetId
  try {
    await apiFetch(`/r2/object/${assetId}`, { method: 'DELETE' })
    assets.value = assets.value.filter(a => a.assetId !== assetId)
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 16px; }
.loading, .empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-secondary, #999);
}
.list { display: flex; flex-direction: column; gap: 8px; }
.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 14px 16px;
  gap: 12px;
}
.info { flex: 1; min-width: 0; }
.title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.meta { font-size: 13px; color: var(--color-text-secondary, #888); }
.meta-tiny { font-size: 12px; color: var(--color-text-tertiary, #aaa); margin-top: 4px; }
.actions { display: flex; gap: 8px; }
.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--color-border, #ddd);
  background: transparent;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
}
.btn.install {
  background: var(--color-primary, #0a84ff);
  color: #fff;
  border-color: var(--color-primary, #0a84ff);
}
.btn.delete:hover { background: #fee; color: #c00; border-color: #fbb; }
.btn.delete:disabled { opacity: .5; cursor: wait; }
</style>
