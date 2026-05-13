import { handleLogin, handleLogout, handleWhoami, requireSession } from './auth'
import { handleWisp } from './wisp'
import { handleAppleProxy } from './apple'
import { handleVersions } from './versions'
import {
  handleUploadInit,
  handleUploadPart,
  handleUploadComplete,
  handleUploadAbort,
  handleListAssets,
  handleDeleteAsset,
  handleBatchDelete,
} from './r2'
import { handleManifest, handleDownload, handleInstallPage } from './install'
import { runScheduledCleanup } from './cleanup'
import type { Env } from './types'

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
}

// Strict CSP. Notes:
// - 'wasm-unsafe-eval' is required to instantiate the ipa-wasm bundle.
// - connect-src 'self' covers /auth, /apple/proxy, /r2, /wisp on the Worker
//   origin (wss: at the same origin counts as 'self').
// - img-src allows Apple's mzstatic.com (App Store artwork) and data: URIs.
// - Apple's IPA CDN (*.itunes.apple.com / *.phobos.apple.com) is needed for
//   `fetch(signed_cdn_url)` from ipaPipeline.js — but those are reached
//   directly from the browser with mode:'cors', so we whitelist them here.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self' https://*.itunes.apple.com https://*.phobos.apple.com https://*.apple.com https://api.timbrd.com https://apis.bilin.eu.org",
  "img-src 'self' data: https://*.mzstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

function applySecurityHeaders(resp: Response): Response {
  // Don't add CSP to non-HTML/JSON responses (e.g. plist for installd, R2 streams)
  const ct = resp.headers.get('content-type') || ''
  const isHtml = ct.startsWith('text/html')
  const out = new Response(resp.body, resp)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    out.headers.set(k, v)
  }
  if (isHtml) {
    out.headers.set('content-security-policy', CSP)
  }
  return out
}

function notFound(): Response {
  return new Response('not found', { status: 404 })
}

function methodNotAllowed(): Response {
  return new Response('method not allowed', { status: 405 })
}

async function handleHealthz(): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, version: '0.1.0', timestamp: Date.now() }),
    { headers: { 'content-type': 'application/json' } }
  )
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      const resp = await route(request, env, ctx, url, path)
      return applySecurityHeaders(resp)
    } catch (err) {
      console.error('unhandled error:', err)
      return new Response(
        JSON.stringify({ error: 'internal server error', message: (err as Error).message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runScheduledCleanup(env)
  },
}

async function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  path: string
): Promise<Response> {
  // Health
  if (path === '/healthz') return handleHealthz()

  // Auth
  if (path === '/auth/login') return handleLogin(request, env)
  if (path === '/auth/logout') return handleLogout(request, env)
  if (path === '/auth/whoami') return handleWhoami(request, env)

  // Versions lookup (requires session)
  if (path === '/api/versions') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleVersions(request, env)
  }

  // Wisp tunnel - Apple TLS relay (requires session)
  if (path === '/wisp' || path === '/wisp/') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleWisp(request, env)
  }

  // Apple proxy (HTTPS pass-through; user trusts own Worker)
  if (path === '/apple/proxy') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleAppleProxy(request, env)
  }

  // R2 upload (multipart) - requires session
  if (path === '/r2/upload-init' && request.method === 'POST') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleUploadInit(request, env)
  }
  const partMatch = path.match(/^\/r2\/upload-part\/([^/]+)\/(\d+)$/)
  if (partMatch && request.method === 'PUT') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleUploadPart(request, env, partMatch[1]!, parseInt(partMatch[2]!, 10))
  }
  if (path === '/r2/upload-complete' && request.method === 'POST') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleUploadComplete(request, env, ctx)
  }
  if (path === '/r2/upload-abort' && request.method === 'POST') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleUploadAbort(request, env)
  }
  if (path === '/r2/list' && (request.method === 'GET' || request.method === 'POST')) {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleListAssets(request, env)
  }
  const deleteMatch = path.match(/^\/r2\/object\/([^/]+)$/)
  if (deleteMatch && request.method === 'DELETE') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleDeleteAsset(request, env, deleteMatch[1]!)
  }
  if (path === '/r2/batch' && request.method === 'DELETE') {
    const session = await requireSession(env, request)
    if (session instanceof Response) return session
    return handleBatchDelete(request, env)
  }

  // OTA install - public (installd doesn't carry cookies). Capability via opaque asset_id (UUID).
  const manifestMatch = path.match(/^\/m\/([^/]+)\.plist$/) || path.match(/^\/m\/([^/]+)$/)
  if (manifestMatch && request.method === 'GET') {
    return handleManifest(request, env, url, manifestMatch[1]!)
  }
  const downloadMatch = path.match(/^\/d\/([^/]+)(?:\.ipa)?$/)
  if (downloadMatch && (request.method === 'GET' || request.method === 'HEAD')) {
    return handleDownload(request, env, ctx, url, downloadMatch[1]!)
  }
  const installMatch = path.match(/^\/i\/([^/]+)$/)
  if (installMatch && request.method === 'GET') {
    return handleInstallPage(request, env, url, installMatch[1]!)
  }

  // Static assets fall back to the SPA / Wrangler Assets binding.
  if (env.ASSETS) {
    return env.ASSETS.fetch(request)
  }

  return notFound()
}
