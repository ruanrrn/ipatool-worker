import { describe, expect, it, vi } from 'vitest'
import type { Env, AssetMetadata } from '../src/types'
import { handleManifest, handleDownload, handleInstallPage } from '../src/install'

function fakeEnv(metadata: Record<string, AssetMetadata>): Env {
  const kv: any = {
    async get(key: string) {
      const id = key.replace(/^asset:/, '')
      return metadata[id] ? JSON.stringify(metadata[id]) : null
    },
  }
  const r2Objs: any = {
    'app/com.test/1.0.0/aaa.ipa': {
      body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close() } }),
      range: undefined,
    },
  }
  const R2: any = {
    async get(key: string) {
      return r2Objs[key] || null
    },
  }
  return {
    USERNAME: 'owner',
    APPLE_HOST_ALLOWLIST: '',
    SESSION_TTL_SECONDS: '60',
    KEEP_VERSIONS_PER_BUNDLE: '3',
    PASSWORD_BCRYPT: '',
    METADATA: kv,
    R2,
    ASSETS: {} as any,
    SESSIONS: {} as any,
    RATELIMIT: {} as any,
  } as Env
}

describe('install routes', () => {
  it('generates manifest plist with all required fields', async () => {
    const meta: AssetMetadata = {
      bundleId: 'com.test.app',
      version: '1.0.0',
      title: 'TestApp',
      size: 1234,
      contentType: 'application/octet-stream',
      uploadedAt: 0,
      r2Key: 'app/com.test/1.0.0/aaa.ipa',
    }
    const env = fakeEnv({ aaa: meta })
    const url = new URL('https://example.workers.dev/m/aaa.plist')
    const req = new Request(url)
    const resp = await handleManifest(req, env, url, 'aaa')
    expect(resp.status).toBe(200)
    const xml = await resp.text()
    expect(xml).toContain('<key>bundle-identifier</key>')
    expect(xml).toContain('<string>com.test.app</string>')
    expect(xml).toContain('<string>1.0.0</string>')
    expect(xml).toContain('<string>TestApp</string>')
    expect(xml).toContain('https://example.workers.dev/d/aaa.ipa')
    expect(xml).toContain('software-package')
  })

  it('returns 404 for unknown asset', async () => {
    const env = fakeEnv({})
    const url = new URL('https://example.workers.dev/m/unknown.plist')
    const resp = await handleManifest(new Request(url), env, url, 'unknown')
    expect(resp.status).toBe(404)
  })

  it('serves install landing HTML with itms link', async () => {
    const meta: AssetMetadata = {
      bundleId: 'com.test.app',
      version: '1.0.0',
      title: 'TestApp',
      size: 1234,
      contentType: 'application/octet-stream',
      uploadedAt: 0,
      r2Key: 'app/com.test/1.0.0/aaa.ipa',
    }
    const env = fakeEnv({ aaa: meta })
    const url = new URL('https://example.workers.dev/i/aaa')
    const resp = await handleInstallPage(new Request(url), env, url, 'aaa')
    expect(resp.status).toBe(200)
    const html = await resp.text()
    expect(html).toContain('itms-services://')
    expect(html).toContain('TestApp')
    expect(html.toLowerCase()).toContain('action=download-manifest')
  })

  it('escapes XML metacharacters in titles', async () => {
    const meta: AssetMetadata = {
      bundleId: 'com.test',
      version: '1.0.0',
      title: 'Evil<title>"&\'</xml>',
      size: 1,
      contentType: 'application/octet-stream',
      uploadedAt: 0,
      r2Key: 'app/com.test/1.0.0/aaa.ipa',
    }
    const env = fakeEnv({ aaa: meta })
    const url = new URL('https://example.workers.dev/m/aaa.plist')
    const resp = await handleManifest(new Request(url), env, url, 'aaa')
    const xml = await resp.text()
    expect(xml).not.toContain('<title>"')
    expect(xml).toContain('Evil&lt;title&gt;&quot;&amp;&apos;&lt;/xml&gt;')
  })
})
