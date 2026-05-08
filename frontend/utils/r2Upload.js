// Browser-side R2 multipart upload coordinator.
// Streams an in-memory IPA blob in PART_SIZE chunks, with parallel PUTs
// against the Worker `/r2/upload-part/<uploadId>/<partNum>` endpoint.

import { apiFetch } from './api.js'

const DEFAULT_CONCURRENCY = 4

export async function uploadMultipart({
  bytes,
  bundleId,
  version,
  title,
  email,
  contentType = 'application/octet-stream',
  sha256,
  concurrency = DEFAULT_CONCURRENCY,
  onProgress,
}) {
  const size = bytes.byteLength
  // 1. init
  const initResp = await fetch('/r2/upload-init', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundleId, version, title, size, contentType, email, sha256 }),
  })
  if (!initResp.ok) throw new Error(`upload-init failed: ${initResp.status}`)
  const initData = await initResp.json()
  const { assetId, key, uploadId, partSize, partCount } = initData

  // 2. upload parts in parallel
  let uploadedBytes = 0
  const parts = new Array(partCount)
  let nextIndex = 0
  let firstError = null

  function reportProgress(deltaBytes) {
    uploadedBytes += deltaBytes
    if (onProgress) {
      onProgress({ uploadedBytes, totalBytes: size, fraction: uploadedBytes / size })
    }
  }

  async function worker() {
    while (firstError == null) {
      const idx = nextIndex++
      if (idx >= partCount) return
      const start = idx * partSize
      const end = Math.min(start + partSize, size)
      const partBytes = bytes.subarray(start, end)
      const partNumber = idx + 1
      try {
        const r = await fetch(`/r2/upload-part/${uploadId}/${partNumber}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-R2-Key': key,
            'Content-Length': String(partBytes.byteLength),
          },
          body: partBytes,
        })
        if (!r.ok) {
          const txt = await r.text().catch(() => '')
          throw new Error(`part ${partNumber} HTTP ${r.status}: ${txt}`)
        }
        const data = await r.json()
        parts[idx] = { partNumber, etag: data.etag }
        reportProgress(partBytes.byteLength)
      } catch (err) {
        if (!firstError) firstError = err
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  if (firstError) {
    // Best-effort abort
    try {
      await fetch('/r2/upload-abort', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key }),
      })
    } catch {}
    throw firstError
  }

  // 3. complete
  const completeResp = await apiFetch('/r2/upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      key,
      parts,
      bundleId,
      version,
      title,
      size,
      contentType,
      email,
      sha256,
    }),
  })
  if (!completeResp.response.ok) {
    throw new Error(`upload-complete failed: ${completeResp.response.status}`)
  }
  return { assetId: completeResp.data.assetId || assetId }
}
