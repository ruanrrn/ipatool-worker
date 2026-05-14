import { describe, expect, it, vi } from 'vitest'
import { handleAppleCdn } from '../src/apple-cdn'
import type { Env } from '../src/types'

function env(): Env {
  return {
    ASSETS: {} as Fetcher,
    R2: {} as R2Bucket,
    KV: {} as KVNamespace,
    USERNAME: 'owner',
    PASSWORD_BCRYPT: 'x',
    SESSION_TTL_SECONDS: '3600',
    APPLE_HOST_ALLOWLIST: '*.itunes.apple.com,*.apple.com,*.phobos.apple.com',
  }
}

describe('handleAppleCdn', () => {
  it('streams upstream range response without JSON/base64 buffering', async () => {
    const body = new Uint8Array([1, 2, 3])
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('GET')
      expect(new Headers(init.headers).get('range')).toBe('bytes=0-2')
      return new Response(body, {
        status: 206,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': '3',
          'content-range': 'bytes 0-2/99',
          'accept-ranges': 'bytes',
          'set-cookie': 'should-not-pass',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('https://worker.example/apple/cdn?url=https%3A%2F%2Fiosapps.itunes.apple.com%2Ffoo.ipa', {
      headers: { Range: 'bytes=0-2' },
    })
    const resp = await handleAppleCdn(req, env())

    expect(resp.status).toBe(206)
    expect(resp.headers.get('content-range')).toBe('bytes 0-2/99')
    expect(resp.headers.get('set-cookie')).toBeNull()
    expect(new Uint8Array(await resp.arrayBuffer())).toEqual(body)
  })

  it('rejects non-allowlisted hosts', async () => {
    const req = new Request('https://worker.example/apple/cdn?url=https%3A%2F%2Fevil.example%2Ffoo.ipa')
    const resp = await handleAppleCdn(req, env())
    expect(resp.status).toBe(403)
  })

  it('only accepts GET and HEAD', async () => {
    const req = new Request('https://worker.example/apple/cdn?url=https%3A%2F%2Fiosapps.itunes.apple.com%2Ffoo.ipa', {
      method: 'POST',
    })
    const resp = await handleAppleCdn(req, env())
    expect(resp.status).toBe(405)
  })
})
