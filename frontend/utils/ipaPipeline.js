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

const CDN_CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB

function getHeader(headers, name) {
  return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase())
}

function parseTotalSize(resp) {
  const contentRange = getHeader(resp.headers, 'content-range')
  if (contentRange) {
    const m = contentRange.match(/\/([0-9]+)$/)
    if (m) return Number.parseInt(m[1], 10)
  }
  const contentLength = getHeader(resp.headers, 'content-length')
  if (contentLength) return Number.parseInt(contentLength, 10)
  return 0
}

function cdnProxyUrl(cdnUrl) {
  return `/apple/cdn?url=${encodeURIComponent(cdnUrl)}`
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function probeBrowserCdn(cdnUrl) {
  try {
    const resp = await fetchWithTimeout(
      cdnUrl,
      {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Range: 'bytes=0-0' },
      },
      8000
    )
    if (resp.status !== 206 && resp.status !== 200) return null
    const buf = new Uint8Array(await resp.arrayBuffer())
    const total = parseTotalSize(resp)
    if (!total || !buf.byteLength) return null
    return { mode: 'direct', total, firstChunk: buf, firstRange: getHeader(resp.headers, 'content-range') || '' }
  } catch {
    return null
  }
}

async function probeProxyCdn(cdnUrl) {
  const url = cdnProxyUrl(cdnUrl)
  const resp = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Range: 'bytes=0-0' },
  })
  if (!resp.ok && resp.status !== 206) {
    const text = await resp.text().catch(() => '')
    throw new Error(`CDN 探测失败: ${resp.status}${text ? ` ${text}` : ''}`)
  }
  const buf = new Uint8Array(await resp.arrayBuffer())
  const total = parseTotalSize(resp)
  if (!total || !buf.byteLength) {
    throw new Error('CDN 未返回可用的 Content-Length/Content-Range，已拒绝全量下载以避免 Worker OOM')
  }
  return { mode: 'proxy', total, firstChunk: buf, firstRange: getHeader(resp.headers, 'content-range') || '' }
}

function rangeStartFromProbe(probe) {
  if (!probe.firstRange) return 0
  const m = probe.firstRange.match(/^bytes\s+(\d+)-(\d+)\//i)
  if (!m) return 0
  return Number.parseInt(m[1], 10)
}

function rangeEndFromProbe(probe) {
  if (!probe.firstRange) return probe.firstChunk.byteLength - 1
  const m = probe.firstRange.match(/^bytes\s+(\d+)-(\d+)\//i)
  if (!m) return probe.firstChunk.byteLength - 1
  return Number.parseInt(m[2], 10)
}

async function fetchRange(cdnUrl, mode, start, end) {
  const url = mode === 'direct' ? cdnUrl : cdnProxyUrl(cdnUrl)
  const resp = await fetch(url, {
    method: 'GET',
    mode: mode === 'direct' ? 'cors' : 'same-origin',
    credentials: mode === 'direct' ? 'omit' : 'include',
    cache: 'no-store',
    headers: { Range: `bytes=${start}-${end}` },
  })
  if (resp.status !== 206 && resp.status !== 200) {
    const text = await resp.text().catch(() => '')
    throw new Error(`CDN range ${start}-${end} failed: ${resp.status}${text ? ` ${text}` : ''}`)
  }
  const buf = new Uint8Array(await resp.arrayBuffer())
  const expected = end - start + 1
  if (buf.byteLength !== expected) {
    throw new Error(`CDN range ${start}-${end} length mismatch: got ${buf.byteLength}, expected ${expected}`)
  }
  return buf
}

async function fetchIpaToBytes(cdnUrl, onProgress) {
  const directProbe = await probeBrowserCdn(cdnUrl)
  const probe = directProbe || (await probeProxyCdn(cdnUrl))
  const { mode, total } = probe
  const out = new Uint8Array(total)

  const firstStart = rangeStartFromProbe(probe)
  const firstEnd = rangeEndFromProbe(probe)
  out.set(probe.firstChunk, firstStart)
  let received = probe.firstChunk.byteLength
  if (onProgress) onProgress({ received, total, fraction: received / total, mode })

  let offset = firstEnd + 1
  while (offset < total) {
    const end = Math.min(offset + CDN_CHUNK_SIZE - 1, total - 1)
    const chunk = await fetchRange(cdnUrl, mode, offset, end)
    out.set(chunk, offset)
    received += chunk.byteLength
    offset = end + 1
    if (onProgress) onProgress({ received, total, fraction: received / total, mode })
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

  stage('cdn-fetch', 0.15, '探测 Apple CDN 下载方式…')
  let downloadMode = 'proxy'
  const ipaBytes = await fetchIpaToBytes(cdnUrl, ({ fraction, received, total, mode }) => {
    downloadMode = mode
    const modeLabel = mode === 'direct' ? '直连' : '代理'
    stage('cdn-fetch', 0.15 + fraction * 0.40, `${modeLabel}下载中 ${Math.round(received / 1024 / 1024)} / ${Math.round(total / 1024 / 1024)} MB`)
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
    downloadMode,
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
