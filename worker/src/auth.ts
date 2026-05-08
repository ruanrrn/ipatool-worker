import bcrypt from 'bcryptjs'
import type { Env, SessionData } from './types'

const SESSION_COOKIE = 'sid'
const RATELIMIT_WINDOW_SECONDS = 15 * 60
const RATELIMIT_MAX = 5

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function sessionTtl(env: Env): number {
  const v = parseInt(env.SESSION_TTL_SECONDS || '2592000', 10)
  return isFinite(v) && v > 0 ? v : 2592000
}

function randomToken(): string {
  // 64 bytes hex
  const a = crypto.randomUUID().replace(/-/g, '')
  const b = crypto.randomUUID().replace(/-/g, '')
  return a + b
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

export function getSessionId(req: Request): string | null {
  return parseCookie(req.headers.get('cookie'), SESSION_COOKIE)
}

export async function getSession(env: Env, req: Request): Promise<SessionData | null> {
  const sid = getSessionId(req)
  if (!sid) return null
  const raw = await env.SESSIONS.get(sid)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as SessionData
    // Sliding window: if last seen > 5 min ago, refresh.
    const now = Date.now()
    if (now - data.lastSeenAt > 5 * 60 * 1000) {
      data.lastSeenAt = now
      await env.SESSIONS.put(sid, JSON.stringify(data), {
        expirationTtl: sessionTtl(env),
      })
    }
    return data
  } catch {
    return null
  }
}

export async function requireSession(env: Env, req: Request): Promise<SessionData | Response> {
  const session = await getSession(env, req)
  if (!session) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 })
  }
  // Same-origin enforcement on state-changing methods. SameSite=Lax already
  // limits cross-site form posts, but also reject cross-origin XHR/fetch.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin')
    if (origin) {
      try {
        const o = new URL(origin)
        const target = new URL(req.url)
        if (o.host !== target.host) {
          return jsonResponse({ error: 'cross-origin denied' }, { status: 403 })
        }
      } catch {
        return jsonResponse({ error: 'invalid origin' }, { status: 400 })
      }
    }
  }
  return session
}

function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return 'unknown'
}

async function checkRateLimit(env: Env, ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `login:${ip}`
  const now = Math.floor(Date.now() / 1000)
  const raw = await env.RATELIMIT.get(key)
  let entries: number[] = []
  if (raw) {
    try {
      entries = JSON.parse(raw) as number[]
    } catch {
      entries = []
    }
  }
  // Drop entries outside the rolling window.
  entries = entries.filter((t) => now - t < RATELIMIT_WINDOW_SECONDS)
  if (entries.length >= RATELIMIT_MAX) {
    const oldest = entries[0]!
    const retryAfter = RATELIMIT_WINDOW_SECONDS - (now - oldest)
    return { allowed: false, retryAfter }
  }
  entries.push(now)
  await env.RATELIMIT.put(key, JSON.stringify(entries), {
    expirationTtl: RATELIMIT_WINDOW_SECONDS,
  })
  return { allowed: true, retryAfter: 0 }
}

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, { status: 405 })
  }
  const ip = clientIp(req)
  const rl = await checkRateLimit(env, ip)
  if (!rl.allowed) {
    return jsonResponse(
      { error: 'rate limited', retryAfter: rl.retryAfter },
      {
        status: 429,
        headers: { 'retry-after': String(rl.retryAfter) },
      }
    )
  }

  let body: { username?: string; password?: string }
  try {
    body = (await req.json()) as { username?: string; password?: string }
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''
  if (!username || !password) {
    return jsonResponse({ error: 'missing credentials' }, { status: 400 })
  }
  if (!env.PASSWORD_BCRYPT) {
    return jsonResponse(
      { error: 'server not configured: PASSWORD_BCRYPT secret missing' },
      { status: 500 }
    )
  }
  if (username !== env.USERNAME) {
    return jsonResponse({ error: 'invalid credentials' }, { status: 401 })
  }

  const ok = await bcrypt.compare(password, env.PASSWORD_BCRYPT)
  if (!ok) {
    return jsonResponse({ error: 'invalid credentials' }, { status: 401 })
  }

  const sid = randomToken()
  const session: SessionData = {
    username,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  }
  await env.SESSIONS.put(sid, JSON.stringify(session), {
    expirationTtl: sessionTtl(env),
  })

  const cookie = [
    `${SESSION_COOKIE}=${sid}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${sessionTtl(env)}`,
  ].join('; ')

  return jsonResponse(
    { ok: true, username },
    {
      headers: {
        'set-cookie': cookie,
      },
    }
  )
}

export async function handleLogout(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, { status: 405 })
  }
  const sid = getSessionId(req)
  if (sid) {
    await env.SESSIONS.delete(sid)
  }
  const cookie = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ')
  return jsonResponse({ ok: true }, { headers: { 'set-cookie': cookie } })
}

export async function handleWhoami(req: Request, env: Env): Promise<Response> {
  const session = await getSession(env, req)
  if (!session) {
    return jsonResponse({ authenticated: false }, { status: 401 })
  }
  return jsonResponse({
    authenticated: true,
    username: session.username,
    createdAt: session.createdAt,
  })
}
