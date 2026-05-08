// Host allowlist + private-IP gate for the Wisp tunnel.
// Extracted into its own module so unit tests can import it without
// pulling in `cloudflare:sockets` (Node-side test runners can't resolve it).

import type { Env } from './types'

export function compileHostAllowlist(env: Env): RegExp[] {
  const raw = env.APPLE_HOST_ALLOWLIST || ''
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pattern) => {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp('^' + escaped + '$', 'i')
    })
}

export function isHostAllowed(host: string, allowlist: RegExp[]): boolean {
  if (!host) return false
  if (host === 'localhost' || host === 'localhost.') return false
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false
  }
  if (
    /^fc[0-9a-f]{2}:/i.test(host) ||
    /^fd[0-9a-f]{2}:/i.test(host) ||
    /^fe[89ab][0-9a-f]:/i.test(host)
  ) {
    return false
  }
  return allowlist.some((re) => re.test(host))
}
