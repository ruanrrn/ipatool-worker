import type { Env } from './types'
import { compileHostAllowlist, isHostAllowed } from './wisp-allowlist'

const ALLOWED_REQUEST_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
  'user-agent',
])

const RESPONSE_HEADERS_TO_PASS = new Set([
  'accept-ranges',
  'age',
  'cache-control',
  'content-disposition',
  'content-encoding',
  'content-length',
  'content-range',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
])

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function parseCdnUrl(req: Request, allowlist: RegExp[]): URL | Response {
  const selfUrl = new URL(req.url)
  const rawUrl = selfUrl.searchParams.get('url')
  if (!rawUrl) return jsonResponse({ error: 'missing url' }, { status: 400 })

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return jsonResponse({ error: 'invalid url' }, { status: 400 })
  }

  if (target.protocol !== 'https:') {
    return jsonResponse({ error: 'https required' }, { status: 400 })
  }
  if (!isHostAllowed(target.hostname, allowlist)) {
    return jsonResponse({ error: 'host not allowed', host: target.hostname }, { status: 403 })
  }
  return target
}

function buildUpstreamHeaders(req: Request): Headers {
  const headers = new Headers()
  req.headers.forEach((value, key) => {
    const lk = key.toLowerCase()
    if (!ALLOWED_REQUEST_HEADERS.has(lk)) return
    headers.set(key, value)
  })

  // Keep the same iTunes-style UA used by /apple/proxy. Some Apple endpoints
  // are sensitive to UA and signed CDN redirects are short-lived.
  if (!headers.has('user-agent')) {
    headers.set(
      'User-Agent',
      'Configurator/2.17 (Macintosh; OS X 15.2; 24C5089c) AppleWebKit/0620.1.16.11.6'
    )
  }
  return headers
}

function buildDownstreamHeaders(upstream: Response, target: URL): Headers {
  const headers = new Headers()
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_HEADERS_TO_PASS.has(key.toLowerCase())) headers.set(key, value)
  })
  headers.set('x-apple-cdn-final-url', target.toString())
  headers.set('access-control-expose-headers', 'content-length, content-range, accept-ranges, etag')
  return headers
}

/**
 * Dedicated Apple CDN binary range proxy.
 *
 * Unlike /apple/proxy, this endpoint never buffers upstream bodies into JSON or
 * base64. It streams upstream.body directly so large IPA range chunks stay below
 * Cloudflare Worker memory limits.
 */
export async function handleAppleCdn(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return jsonResponse({ error: 'method not allowed' }, { status: 405 })
  }

  const allowlist = compileHostAllowlist(env)
  const target = parseCdnUrl(req, allowlist)
  if (target instanceof Response) return target

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      redirect: 'follow',
      cf: { cacheTtl: 0, cacheEverything: false },
    })
  } catch (err) {
    return jsonResponse(
      { error: 'upstream fetch failed', message: (err as Error).message },
      { status: 502 }
    )
  }

  return new Response(req.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildDownstreamHeaders(upstream, target),
  })
}
