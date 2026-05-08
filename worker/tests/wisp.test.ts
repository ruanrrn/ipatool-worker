import { describe, expect, it } from 'vitest'
import { isHostAllowed } from '../src/wisp-allowlist'

function compile(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp('^' + escaped + '$', 'i')
  })
}

describe('wisp host allowlist', () => {
  const allow = compile([
    '*.itunes.apple.com',
    '*.apple.com',
    '*.apple-cloudkit.com',
    'init-p01st.push.apple.com',
  ])

  it('accepts apple subdomains', () => {
    expect(isHostAllowed('p25-buy.itunes.apple.com', allow)).toBe(true)
    expect(isHostAllowed('auth.itunes.apple.com', allow)).toBe(true)
    expect(isHostAllowed('init-p01st.push.apple.com', allow)).toBe(true)
    expect(isHostAllowed('developer.apple.com', allow)).toBe(true)
  })

  it('rejects non-apple hosts', () => {
    expect(isHostAllowed('example.com', allow)).toBe(false)
    expect(isHostAllowed('evil.notapple.com', allow)).toBe(false)
  })

  it('rejects loopback / private IPs', () => {
    expect(isHostAllowed('127.0.0.1', allow)).toBe(false)
    expect(isHostAllowed('localhost', allow)).toBe(false)
    expect(isHostAllowed('10.0.0.5', allow)).toBe(false)
    expect(isHostAllowed('192.168.1.1', allow)).toBe(false)
    expect(isHostAllowed('172.20.5.5', allow)).toBe(false)
    expect(isHostAllowed('169.254.5.5', allow)).toBe(false)
  })

  it('rejects empty / undefined', () => {
    expect(isHostAllowed('', allow)).toBe(false)
  })
})
