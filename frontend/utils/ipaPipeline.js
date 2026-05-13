// End-to-end pipeline: Apple auth → choose app → download IPA from CDN →
// WASM patch → multipart upload to R2 → return asset_id for OTA install.

import { Store } from './appleApi.js'
import { uploadMultipart } from './r2Upload.js'
import * as wakeLock from './wakeLock.js'

let wasmModule = null

async function getWasm() {
  if (wasmModule) return wasmModule
  // /wasm/ipa_wasm.js is shipped under public/wasm and must NOT be bundled by
  // Vite (it's a wasm-bindgen output that imports its own .wasm via fetch).
  // Build the URL at runtime to keep Rollup from trying to resolve it.
  const wasmJsUrl = new URL('/wasm/ipa_wasm.js', window.location.origin).href
  const wasmBgUrl = new URL('/wasm/ipa_wasm_bg.wasm', window.location.origin).href
  const mod = await import(/* @vite-ignore */ wasmJsUrl)
  await mod.default(wasmBgUrl)
  wasmModule = mod
  return mod
}

function bytesToBase64(bytes) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(s)
}

async function fetchIpaToBytes(url, onProgress) {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB per slice

  // --- Helper: call /apple/proxy using the same format as appleApi.js proxyFetch ---
  async function proxyRequest(method, extraHeaders = {}) {
    const resp = await fetch('/apple/proxy', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, headers: extraHeaders }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`proxy ${resp.status}: ${txt}`)
    }
    const json = await resp.json()
    if (json.status >= 400) {
      throw new Error(`upstream ${json.status}`)
    }
    // body is base64-encoded
    const bodyBytes = json.body
      ? Uint8Array.from(atob(json.body), c => c.charCodeAt(0))
      : new Uint8Array()
    return { status: json.status, headers: json.headers || {}, body: bodyBytes }
  }

  // --- Step 1: HEAD via proxy to get content-length ---
  const head = await proxyRequest('HEAD')
  const total = parseInt(
    head.headers['content-length'] || head.headers['Content-Length'] || '0', 10
  )
  if (!total) {
    // Fallback: download as a single request
    const full = await proxyRequest('GET')
    if (onProgress) onProgress({ received: full.body.byteLength, total: full.body.byteLength, fraction: 1 })
    return full.body
  }

  // --- Step 2: Download in 5 MB chunks via proxy GET (range requests) ---
  const chunks = []
  let received = 0

  while (received < total) {
    const end = Math.min(received + CHUNK_SIZE - 1, total - 1)
    const slice = await proxyRequest('GET', { Range: `bytes=${received}-${end}` })

    chunks.push(slice.body)
    received += slice.body.byteLength

    if (onProgress) {
      onProgress({ received, total, fraction: received / total })
    }
  }

  // --- Step 3: Merge into a single Uint8Array ---
  const out = new Uint8Array(received)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

export async function runPipeline({
  email,
  applePassword,
  mfa,
  appIdentifier,
  appVerId, // optional - download specific historical version
  onStage,
  savedAuth,      // optional { dsPersonId, passwordToken } — reuse saved tokens to skip re-auth
  onAuthUpdated,  // optional callback({ dsPersonId, passwordToken, region }) after fresh auth
}) {
  const stage = (s, p, m) => onStage && onStage({ stage: s, progress: p, message: m })

  // Hold the screen wake lock for the duration of the pipeline so iOS doesn't
  // suspend the tab mid-patch.
  await wakeLock.acquire()
  try {

  const store = new Store()
  let authInfo = null
  let licenseDone = false

  // Phase 1: Try reusing saved tokens via a quick ensureLicense probe.
  // This avoids unnecessary re-authentication and 2FA prompts.
  if (savedAuth?.dsPersonId && savedAuth?.passwordToken) {
    stage('apple-auth', 0.02, '尝试验证已保存的登录状态…')
    authInfo = { dsPersonId: savedAuth.dsPersonId, passwordToken: savedAuth.passwordToken }
    const probe = await store.ensureLicense(appIdentifier, appVerId, authInfo)
    if (probe._state === 'success' || probe.failureType === '2034') {
      licenseDone = true
      stage('apple-auth', 0.05, '登录状态有效 ✓')
    } else {
      authInfo = null  // tokens expired, fall through to fresh auth
    }
  }

  // Phase 2: Fresh authentication if saved tokens are unavailable or expired
  if (!authInfo) {
    stage('apple-auth', 0, 'Apple ID 登录中…')
    const auth = await store.authenticate(email, applePassword, mfa)
    if (auth._state !== 'success') {
      const err = new Error(auth.customerMessage || `Apple 登录失败: ${auth.failureType || ''}`)
      err.appleResult = auth
      throw err
    }
    authInfo = {
      dsPersonId: auth.dsPersonId,
      passwordToken: auth.passwordToken,
    }
    if (onAuthUpdated) {
      onAuthUpdated({
        dsPersonId: auth.dsPersonId,
        passwordToken: auth.passwordToken,
        region: auth.region,
      })
    }
  }

  // Phase 3: ensureLicense (buyProduct) — skip if probe already confirmed license
  if (!licenseDone) {
    stage('apple-license', 0.05, '确认 license（buyProduct）…')
    const license = await store.ensureLicense(appIdentifier, appVerId, authInfo)
    if (license._state !== 'success' && license.failureType !== '2034') {
      // Purchase required — structured error so UI can guide user
      const err = new Error(license.customerMessage || '该应用可能尚未购买，请先到 App Store 完成购买')
      err.purchaseRequired = true
      err.appleResult = license
      throw err
    }
  }

  stage('apple-download', 0.1, '获取下载 URL（downloadProduct）…')
  const dl = await store.downloadProduct(appIdentifier, appVerId, authInfo)
  if (dl._state !== 'success') {
    throw new Error(dl.customerMessage || `downloadProduct 失败: ${dl.failureType || ''}`)
  }
  const songList0 = dl.songList?.[0]
  if (!songList0) throw new Error('downloadProduct 返回空 songList')
  const cdnUrl = songList0.URL || songList0.url
  if (!cdnUrl) throw new Error('songList[0] missing URL')

  stage('cdn-fetch', 0.15, '从 Apple CDN 下载 IPA…')
  const ipaBytes = await fetchIpaToBytes(cdnUrl, ({ fraction, received, total }) => {
    stage('cdn-fetch', 0.15 + fraction * 0.40, `下载中 ${Math.round(received / 1024 / 1024)} / ${Math.round((total || received) / 1024 / 1024)} MB`)
  })

  stage('wasm-patch', 0.55, 'WASM 注入 sinf + iTunesMetadata…')
  const wasm = await getWasm()
  const patched = wasm.applyPatch(ipaBytes, JSON.stringify(songList0), email)
  // Free the original to reduce memory pressure
  // (V8 will GC; we don't need to manually clear.)

  stage('inspect', 0.65, '检查注入结果…')
  const inspection = wasm.inspect(patched)
  // inspection.bundle_id / version / title preferred, else fall back to apple metadata
  const bundleId = inspection.bundle_id || songList0.metadata?.bundleId || ''
  const version = inspection.bundle_short_version || songList0.metadata?.bundleShortVersionString || ''
  const title = inspection.bundle_display_name || songList0.metadata?.bundleDisplayName || songList0.metadata?.itemName || 'App'

  if (!bundleId || !version) {
    throw new Error('无法确定 bundleId/version，IPA 可能损坏')
  }

  stage('upload', 0.7, '上传到 R2…')
  const { assetId } = await uploadMultipart({
    bytes: patched,
    bundleId,
    version,
    title,
    email,
    contentType: 'application/octet-stream',
    onProgress: ({ fraction }) => {
      stage('upload', 0.7 + fraction * 0.28, `上传中 ${Math.round(fraction * 100)}%`)
    },
  })

  stage('done', 1, `完成！asset id = ${assetId}`)
  return {
    assetId,
    bundleId,
    version,
    title,
    inspection,
    installUrl: `${location.origin}/i/${assetId}`,
    manifestUrl: `${location.origin}/m/${assetId}.plist`,
    itmsServicesUrl: `itms-services://?action=download-manifest&url=${encodeURIComponent(`${location.origin}/m/${assetId}.plist`)}`,
  }
  } finally {
    await wakeLock.release()
  }
}

// Quick sanity: load a local .ipa from a File and patch it (for testing
// without going through Apple). Also useful: user may already have an IPA
// they want to install OTA — we can patch metadata + upload it.
export async function patchExistingIpa({ file, songList0Json, email, onStage }) {
  const stage = (s, p, m) => onStage && onStage({ stage: s, progress: p, message: m })
  stage('read-file', 0, '读取本地 IPA…')
  const buf = new Uint8Array(await file.arrayBuffer())
  stage('wasm-patch', 0.4, 'WASM patch…')
  const wasm = await getWasm()
  const patched = wasm.applyPatch(buf, songList0Json, email)
  const inspection = wasm.inspect(patched)
  return { patched, inspection }
}
