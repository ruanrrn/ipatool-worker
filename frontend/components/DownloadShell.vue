<template>
  <div class="page">
    <div class="card">
      <h2>从 App Store 下载 + 签名 + 装机</h2>

      <div v-if="!job.running && !job.result" class="form">
        <h3>1. Apple 账号</h3>
        <label class="field">
          <span>Apple ID</span>
          <input v-model="form.email" type="email" autocomplete="username" placeholder="apple@example.com">
        </label>
        <label class="field">
          <span>密码</span>
          <input v-model="form.password" type="password" autocomplete="current-password">
        </label>
        <label class="field">
          <span>双重认证 6 位码（可留空）</span>
          <input v-model="form.mfa" type="text" inputmode="numeric" maxlength="6" placeholder="123456">
        </label>

        <h3 style="margin-top:18px">2. 选择应用</h3>
        <div class="search-row">
          <input v-model="search.term" placeholder="App Store 搜索…" @keyup.enter="onSearch">
          <select v-model="search.country">
            <option value="US">US</option>
            <option value="CN">CN</option>
            <option value="JP">JP</option>
            <option value="GB">GB</option>
            <option value="DE">DE</option>
          </select>
          <button @click="onSearch" :disabled="search.loading">
            {{ search.loading ? '搜索中…' : '搜索' }}
          </button>
        </div>
        <div v-if="search.results.length" class="results">
          <div v-for="r in search.results" :key="r.trackId"
               class="result-row"
               :class="{ selected: selectedApp?.trackId === r.trackId }"
               @click="selectedApp = r">
            <img :src="r.artworkUrl60" alt="" width="40" height="40">
            <div class="result-meta">
              <div class="result-title">{{ r.trackName }}</div>
              <div class="result-sub">{{ r.bundleId }} · v{{ r.version }} · {{ r.artistName }}</div>
            </div>
          </div>
        </div>

        <h3 v-if="selectedApp" style="margin-top:18px">3. 历史版本（可选）</h3>
        <div v-if="selectedApp" class="ver-row">
          <input v-model="form.versionId"
                 placeholder="留空 = 最新版本（externalVersionId）">
        </div>

        <button class="btn-primary"
                style="margin-top:24px"
                :disabled="!canStart"
                @click="onStart">
          开始下载 + 签名 + 上传
        </button>
      </div>

      <div v-else-if="job.running" class="progress">
        <div class="bar"><div class="bar-fill" :style="{ width: `${(job.progress * 100).toFixed(1)}%` }"></div></div>
        <div class="stage">{{ stageLabel(job.stage) }} · {{ job.message }}</div>
      </div>

      <div v-else-if="job.result" class="result">
        <h3>{{ job.result.title }} · v{{ job.result.version }}</h3>
        <a class="btn-primary" :href="job.result.installUrl" target="_blank">下载安装</a>
        <button class="btn-secondary" @click="reset" style="margin-top:16px">再下一个</button>
      </div>

      <div v-if="job.error" class="error">
        ✗ {{ job.error.message || job.error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { searchApps } from '../utils/appleApi.js'
import { runPipeline } from '../utils/ipaPipeline.js'

const form = reactive({
  email: '',
  password: '',
  mfa: '',
  versionId: '',
})

const search = reactive({
  term: '',
  country: 'US',
  loading: false,
  results: [],
})

const selectedApp = ref(null)

const job = reactive({
  running: false,
  stage: '',
  progress: 0,
  message: '',
  result: null,
  error: null,
})

const canStart = computed(
  () => form.email && form.password && selectedApp.value && !job.running
)

async function onSearch() {
  if (!search.term.trim()) return
  search.loading = true
  try {
    search.results = await searchApps(search.term.trim(), search.country, 20)
  } catch (e) {
    search.results = []
    job.error = e
  } finally {
    search.loading = false
  }
}

const STAGE_LABELS = {
  'apple-auth': 'Apple 登录',
  'apple-license': '确认 license',
  'apple-download': '获取 CDN URL',
  'cdn-fetch': '下载 IPA',
  'wasm-patch': 'WASM 签名注入',
  'inspect': '校验',
  'upload': '上传 R2',
  'done': '完成',
}
function stageLabel(s) { return STAGE_LABELS[s] || s }

async function onStart() {
  job.running = true
  job.error = null
  job.result = null
  job.progress = 0
  job.message = ''
  job.stage = ''
  try {
    const result = await runPipeline({
      email: form.email,
      applePassword: form.password,
      mfa: form.mfa || null,
      appIdentifier: String(selectedApp.value.trackId),
      appVerId: form.versionId || null,
      onStage: ({ stage, progress, message }) => {
        job.stage = stage
        job.progress = progress
        job.message = message
      },
    })
    job.result = result
  } catch (err) {
    console.error(err)
    job.error = err
  } finally {
    job.running = false
  }
}

function reset() {
  job.result = null
  job.error = null
  job.stage = ''
  job.progress = 0
  job.message = ''
}
</script>

<style scoped>
.page { padding: 20px; }
.card {
  background: var(--color-surface, #fff);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
h2 { margin: 0 0 16px; font-size: 18px; }
h3 { margin: 4px 0 8px; font-size: 15px; color: var(--color-text); }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; font-size: 13px; }
.field span { color: var(--color-text-secondary, #888); }
.field input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e5e7);
  background: var(--color-bg, #fafafa);
  font-size: 14px;
}
.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.search-row input {
  flex: 1;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e5e7);
  background: var(--color-bg, #fafafa);
  font-size: 14px;
}
.search-row select {
  padding: 9px 8px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e5e7);
}
.search-row button {
  padding: 9px 14px;
  border-radius: 8px;
  background: var(--color-primary, #0a84ff);
  color: #fff;
  border: none;
  font-weight: 500;
  cursor: pointer;
}
.search-row button:disabled { opacity: .5; cursor: wait; }
.results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  margin-bottom: 8px;
}
.result-row {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}
.result-row:hover { background: var(--color-bg, #f5f5f7); }
.result-row.selected {
  background: var(--color-primary-soft, #e6f4ff);
  border-color: var(--color-primary, #0a84ff);
}
.result-row img { border-radius: 6px; flex-shrink: 0; }
.result-meta { flex: 1; min-width: 0; }
.result-title { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-sub { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.ver-row input {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e5e7);
  background: var(--color-bg, #fafafa);
  font-size: 14px;
}
.btn-primary {
  display: inline-block;
  padding: 12px 20px;
  background: var(--color-primary, #0a84ff);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.btn-secondary {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.progress { padding: 24px 0; }
.bar { width: 100%; height: 8px; background: var(--color-bg, #eee); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--color-primary, #0a84ff); transition: width .3s ease; }
.stage { margin-top: 12px; font-size: 14px; color: var(--color-text-secondary); }
.result h3 { font-size: 17px; margin-bottom: 12px; }
.error {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fee;
  color: #c00;
  border-radius: 6px;
  font-size: 13px;
}
</style>
