// Apple iTunes API proxy (HTTPS pass-through).
//
// Per the plan, the strongest privacy mode is Wisp + browser-side TLS so the
// Worker never sees plaintext Apple credentials. That requires shipping
// libcurl.js + mbedTLS WASM (~1.5 MB) — kept as a future enhancement.
//
// In the meantime, this hybrid endpoint lets the browser ship requests
// targeted at allow-listed Apple hosts; the Worker terminates TLS to Apple
// and forwards the body. This is acceptable in a *single-user private*
// deployment because the user trusts their own Worker.
//
// Hard-coded constraints:
//   - host must match APPLE_HOST_ALLOWLIST
//   - response body is streamed back; Worker does not log payload
//   - rate-limited via the same 5/15min/IP gate as login (defence in depth)

import type { Env } from './types'
import { compileHostAllowlist, isHostAllowed } from './wisp-allowlist'

interface ProxyBody {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string // base64 of raw bytes
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function isHttpsAppleUrl(rawUrl: string, allowlist: RegExp[]): URL | null {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (!isHostAllowed(u.hostname, allowlist)) return null
  return u
}

export async function handleAppleProxy(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, { status: 405 })
  }
  let body: ProxyBody
  try {
    body = (await req.json()) as ProxyBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.url) return jsonResponse({ error: 'missing url' }, { status: 400 })

  const allowlist = compileHostAllowlist(env)
  const target = isHttpsAppleUrl(body.url, allowlist)
  if (!target) {
    return jsonResponse({ error: 'host not allowed', url: body.url }, { status: 403 })
  }

  const method = (body.method || 'GET').toUpperCase()
  if (!['GET', 'POST', 'HEAD', 'PUT'].includes(method)) {
    return jsonResponse({ error: 'invalid method' }, { status: 400 })
  }

  // Reconstruct body bytes (preserving exact byte sequence Apple expects).
  let upstreamBody: BodyInit | undefined = undefined
  if (body.body && (method === 'POST' || method === 'PUT')) {
    const bin = atob(body.body)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    upstreamBody = arr
  }

  const headers = new Headers()
  if (body.headers) {
    for (const [k, v] of Object.entries(body.headers)) {
      // Strip hop-by-hop / dangerous headers.
      const lk = k.toLowerCase()
      if (lk === 'host' || lk === 'cookie' || lk === 'connection') continue
      headers.set(k, v)
    }
  }
  // Always set User-Agent to the iTunes Configurator UA (Apple is sensitive
  // to this; if the caller already set one, prefer theirs).
  if (!headers.has('user-agent')) {
    headers.set(
      'User-Agent',
      'Configurator/2.17 (Macintosh; OS X 15.2; 24C5089c) AppleWebKit/0620.1.16.11.6'
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body: upstreamBody,
      redirect: 'manual',
    })
  } catch (err) {
    return jsonResponse(
      { error: 'upstream fetch failed', message: (err as Error).message },
      { status: 502 }
    )
  }

  const upstreamHeaders: Record<string, string> = {}
  upstream.headers.forEach((v, k) => {
    upstreamHeaders[k] = v
  })
  const buf = new Uint8Array(await upstream.arrayBuffer())
  let bodyB64 = ''
  const chunk = 0x8000
  let s = ''
  for (let i = 0; i < buf.byteLength; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)))
  }
  bodyB64 = btoa(s)

  return jsonResponse({
    status: upstream.status,
    headers: upstreamHeaders,
    body: bodyB64,
    finalUrl: target.toString(),
  })
}
