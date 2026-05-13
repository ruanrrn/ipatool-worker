// End-to-end pipeline: Apple auth → choose app → download IPA from CDN →
// WASM patch → multipart upload to R2 → return asset_id for OTA install.

import { Store } from './appleApi.js'
import { uploadMultipart } from './r2Upload.js'
import * as wakeLock from './wakeLock.js'

let wasmModule = null

async function getWasm() {
  if (wasmModule) return wasmModule
  const wasmJsUrl = new URL('/wasm/ipa_wasm.js', window.location.origin).href
  const wasmBgUrl = new URL('/wasm/ipa_wasm_bg.wasm', window.location.origin).href
  const mod = await import(/* @vite-ignore */ wasmJsUrl)
  await mod.default(wasmBgUrl)
  wasmModule = mod
  return mod
}

// CDN download via /apple/proxy with range-GET chunking.
// Apple CDN does not allow browser CORS, so we proxy through the Worker.
// We use 5 MB chunks to avoid Worker memory limits.
async function fetchIpaToBytes(cdnUrl, onProgress) {
  const CHUNK = 5 * 1024 * 1024 // 5 MB

  // --- Helper: call /apple/proxy ---
  async function proxyFetch(method, extraHeaders = {}) {
    const resp = await fetch('/apple/proxy', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cdnUrl, method, headers: extraHeaders }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`proxy ${resp.status}: ${txt}`)
    }
    const json = await resp.json()
    if (json.status >= 400) {
      throw new Error(`CDN responded ${json.status}`)
    }
    // Decode base64 body
    const b64 = json.body || ''
    if (!b64) return { headers: json.headers || {}, body: new Uint8Array() }
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return { headers: json.headers || {}, body: arr }
  }

  // Step 1: HEAD to get content-length
  const head = await proxyFetch('HEAD')
  const total = parseInt(
    head.headers['content-length'] || head.headers['Content-Length'] || '0',
    10
  )

  // If no content-length, download as single request
  if (!total) {
    const full = await proxyFetch('GET')
    if (onProgress) onProgress({ received: full.body.byteLength, total: full.body.byteLength, fraction: 1 })
    return full.body
  }

  // Step 2: Download in 5 MB chunks via range GET
  const chunks = []
  let received = 0

  while (received < total) {
    const end = Math.min(received + CHUNK - 1, total - 1)
    const slice = await proxyFetch('GET', { Range: `bytes=${received}-${end}` })

    chunks.push(slice.body)
    received += slice.body.byteLength

    if (onProgress) {
      onProgress({ received, total, fraction: received / total })
    }
  }

  // Merge chunks
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
  appVerId,
  onStage,
  savedAuth,
  onAuthUpdated,
}) {
  const stage = (s, p, m) => onStage && onStage({ stage: s, progress: p, message: m })

  await wakeLock.acquire()
  try {

  const store = new Store()
  let authInfo = null
  let licenseDone = false

  // Phase 1: Try reusing saved tokens via a quick ensureLicense probe.
  if (savedAuth?.dsPersonId && savedAuth?.passwordToken) {
    stage('apple-auth', 0.02, '尝试验证已保存的登录状态…')
    authInfo = { dsPersonId: savedAuth.dsPersonId, passwordToken: savedAuth.passwordToken }
    const probe = await store.ensureLicense(appIdentifier, appVerId, authInfo)
    if (probe._state === 'success' || probe.failureType === '2034') {
      licenseDone = true
      stage('apple-auth', 0.05, '登录状态有效 ✓')
    } else {
      authInfo = null
    }
  }

  // Phase 2: Fresh authentication
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

  // Phase 3: ensureLicense (buyProduct)
  if (!licenseDone) {
    stage('apple-license', 0.05, '确认 license（buyProduct）…')
    const license = await store.ensureLicense(appIdentifier, appVerId, authInfo)
    if (license._state !== 'success' && license.failureType !== '2034') {
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

  stage('inspect', 0.65, '检查注入结果…')
  const inspection = wasm.inspect(patched)
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
