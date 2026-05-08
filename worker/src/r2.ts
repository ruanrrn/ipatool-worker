// R2 multipart upload via Worker proxy.
//
// We use the R2 binding API (createMultipartUpload / uploadPart / complete)
// rather than signed URLs. Bytes do flow through the Worker, but: (a) Worker
// CPU usage on streaming pass-through is essentially zero (CF doesn't bill
// streaming body CPU), (b) free tier is 100k req/day and we use 1 req per
// part (8 MB chunks → 128 reqs per 1 GB IPA, ~780 IPAs/day budget).
//
// If we later want true zero-byte-through-Worker, we can re-introduce
// `aws4fetch`-signed S3-API URLs. For now, the simpler binding path is
// chosen for reliability.

import type { Env, AssetMetadata } from './types'
import { ensureCapacity } from './cleanup'

interface UploadInitBody {
  bundleId: string
  version: string
  title: string
  size: number
  contentType?: string
  email?: string
  sha256?: string
}

interface UploadCompleteBody {
  uploadId: string
  key: string
  parts: Array<{ partNumber: number; etag: string }>
  bundleId: string
  version: string
  title: string
  size: number
  contentType?: string
  email?: string
  sha256?: string
}

interface UploadAbortBody {
  uploadId: string
  key: string
}

const PART_SIZE = 8 * 1024 * 1024 // 8 MB
// R2 hard limit; advertised so the browser doesn't try to PUT bigger parts.
const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024
const MAX_OBJECT_SIZE = 5 * 1024 * 1024 * 1024 // matches plan (>5 GB rare)
const MAX_PARTS = 10000

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function sanitizeBundleId(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}
function sanitizeVersion(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function buildR2Key(bundleId: string, version: string, assetId: string): string {
  return `app/${sanitizeBundleId(bundleId)}/${sanitizeVersion(version)}/${assetId}.ipa`
}

export async function handleUploadInit(req: Request, env: Env): Promise<Response> {
  let body: UploadInitBody
  try {
    body = (await req.json()) as UploadInitBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 })
  }
  const { bundleId, version, title, size } = body
  if (!bundleId || !version || !title) {
    return jsonResponse({ error: 'missing bundleId/version/title' }, { status: 400 })
  }
  if (!size || size <= 0 || size > MAX_OBJECT_SIZE) {
    return jsonResponse({ error: 'invalid size' }, { status: 400 })
  }

  const assetId = crypto.randomUUID()
  const key = buildR2Key(bundleId, version, assetId)

  const multipart = await env.R2.createMultipartUpload(key, {
    httpMetadata: {
      contentType: body.contentType || 'application/octet-stream',
    },
  })

  const partCount = Math.max(1, Math.ceil(size / PART_SIZE))
  if (partCount > MAX_PARTS) {
    return jsonResponse({ error: 'too many parts; reduce size' }, { status: 400 })
  }

  return jsonResponse({
    assetId,
    key,
    uploadId: multipart.uploadId,
    partSize: PART_SIZE,
    partCount,
    maxPartSize: MAX_PART_SIZE,
  })
}

export async function handleUploadPart(
  req: Request,
  env: Env,
  uploadId: string,
  partNumber: number
): Promise<Response> {
  const key = req.headers.get('x-r2-key') || ''
  if (!key) {
    return jsonResponse({ error: 'missing x-r2-key header' }, { status: 400 })
  }
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) {
    return jsonResponse({ error: 'invalid partNumber' }, { status: 400 })
  }
  if (!req.body) {
    return jsonResponse({ error: 'empty body' }, { status: 400 })
  }
  const lengthHeader = req.headers.get('content-length')
  const length = lengthHeader ? parseInt(lengthHeader, 10) : 0
  if (length <= 0 || length > MAX_PART_SIZE) {
    return jsonResponse({ error: 'invalid content-length' }, { status: 400 })
  }
  try {
    const multipart = env.R2.resumeMultipartUpload(key, uploadId)
    const part = await multipart.uploadPart(partNumber, req.body)
    return jsonResponse({ partNumber, etag: part.etag })
  } catch (err) {
    console.error('uploadPart failed:', err)
    return jsonResponse(
      { error: 'upload part failed', message: (err as Error).message },
      { status: 500 }
    )
  }
}

export async function handleUploadComplete(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: UploadCompleteBody
  try {
    body = (await req.json()) as UploadCompleteBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 })
  }
  const { uploadId, key, parts, bundleId, version, title, size } = body
  if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
    return jsonResponse({ error: 'missing fields' }, { status: 400 })
  }
  // Extract assetId from key: app/<bundleId>/<version>/<assetId>.ipa
  const m = key.match(/\/([0-9a-f-]{36})\.ipa$/i)
  if (!m) {
    return jsonResponse({ error: 'invalid key' }, { status: 400 })
  }
  const assetId = m[1]!.toLowerCase()

  try {
    const multipart = env.R2.resumeMultipartUpload(key, uploadId)
    await multipart.complete(parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })))
  } catch (err) {
    console.error('complete multipart failed:', err)
    return jsonResponse(
      { error: 'complete failed', message: (err as Error).message },
      { status: 500 }
    )
  }

  const metadata: AssetMetadata = {
    bundleId,
    version,
    title,
    size,
    sha256: body.sha256,
    contentType: body.contentType || 'application/octet-stream',
    uploadedAt: Date.now(),
    r2Key: key,
    email: body.email,
  }
  await env.METADATA.put(`asset:${assetId}`, JSON.stringify(metadata))

  // Capacity-driven cleanup: a fresh upload may push storage past the 70%
  // threshold; run cleanup in the background so the client doesn't wait.
  ctx.waitUntil(ensureCapacity(env).catch((err) => console.warn('ensureCapacity failed:', err)))

  return jsonResponse({ assetId })
}

export async function handleUploadAbort(req: Request, env: Env): Promise<Response> {
  let body: UploadAbortBody
  try {
    body = (await req.json()) as UploadAbortBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.uploadId || !body.key) {
    return jsonResponse({ error: 'missing fields' }, { status: 400 })
  }
  try {
    const multipart = env.R2.resumeMultipartUpload(body.key, body.uploadId)
    await multipart.abort()
  } catch (err) {
    console.warn('abort failed (may already be aborted):', err)
  }
  return jsonResponse({ ok: true })
}

export async function handleListAssets(_req: Request, env: Env): Promise<Response> {
  const assets: Array<AssetMetadata & { assetId: string }> = []
  let cursor: string | undefined = undefined
  do {
    const list: KVNamespaceListResult<unknown, string> = await env.METADATA.list({
      prefix: 'asset:',
      cursor,
    })
    for (const k of list.keys) {
      const id = k.name.slice('asset:'.length)
      const raw = await env.METADATA.get(k.name)
      if (!raw) continue
      try {
        const m = JSON.parse(raw) as AssetMetadata
        assets.push({ ...m, assetId: id })
      } catch {}
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  assets.sort((a, b) => b.uploadedAt - a.uploadedAt)
  return jsonResponse({ assets })
}

export async function handleDeleteAsset(_req: Request, env: Env, assetId: string): Promise<Response> {
  if (!assetId) return jsonResponse({ error: 'missing assetId' }, { status: 400 })
  const raw = await env.METADATA.get(`asset:${assetId}`)
  if (!raw) return jsonResponse({ error: 'not found' }, { status: 404 })
  let metadata: AssetMetadata
  try {
    metadata = JSON.parse(raw) as AssetMetadata
  } catch {
    return jsonResponse({ error: 'corrupt metadata' }, { status: 500 })
  }
  try {
    await env.R2.delete(metadata.r2Key)
  } catch (err) {
    console.warn('R2 delete failed:', err)
  }
  await env.METADATA.delete(`asset:${assetId}`)
  return jsonResponse({ ok: true })
}
