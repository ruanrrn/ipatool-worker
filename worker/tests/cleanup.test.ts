import { describe, expect, it } from 'vitest'
import { runCleanup } from '../src/cleanup'
import type { Env, AssetMetadata } from '../src/types'

class FakeKV {
  store = new Map<string, string>()
  async get(key: string) { return this.store.get(key) ?? null }
  async put(key: string, value: string) { this.store.set(key, value) }
  async delete(key: string) { this.store.delete(key) }
  async list({ prefix }: { prefix?: string; cursor?: string }) {
    const keys = Array.from(this.store.keys())
      .filter((k) => !prefix || k.startsWith(prefix))
      .map((name) => ({ name, expiration: undefined }))
    return { keys, list_complete: true, cursor: '' }
  }
}

class FakeR2 {
  store = new Map<string, boolean>()
  delete = async (key: string) => { this.store.delete(key) }
}

function makeMeta(bundleId: string, version: string, uploadedAt: number, key: string): AssetMetadata {
  return {
    bundleId,
    version,
    title: bundleId,
    size: 100,
    contentType: 'application/octet-stream',
    uploadedAt,
    r2Key: key,
  }
}

describe('cleanup cron', () => {
  it('keeps latest K versions per bundle and deletes the rest', async () => {
    const kv = new FakeKV() as unknown as KVNamespace
    const r2 = new FakeR2()
    // 5 versions of A (we keep top 3), 2 versions of B (keep both)
    const items: Array<[string, AssetMetadata]> = [
      ['asset:a1', makeMeta('com.A', '1.0', 100, 'k/a1')],
      ['asset:a2', makeMeta('com.A', '2.0', 200, 'k/a2')],
      ['asset:a3', makeMeta('com.A', '3.0', 300, 'k/a3')],
      ['asset:a4', makeMeta('com.A', '4.0', 400, 'k/a4')],
      ['asset:a5', makeMeta('com.A', '5.0', 500, 'k/a5')],
      ['asset:b1', makeMeta('com.B', '1.0', 50, 'k/b1')],
      ['asset:b2', makeMeta('com.B', '2.0', 150, 'k/b2')],
    ]
    for (const [k, v] of items) {
      ;(kv as any).store.set(k, JSON.stringify(v))
      ;(r2 as any).store.set(v.r2Key, true)
    }

    const env = {
      METADATA: kv,
      R2: r2 as unknown as R2Bucket,
      KEEP_VERSIONS_PER_BUNDLE: '3',
    } as unknown as Env

    await runCleanup(env)

    const remaining = Array.from((kv as any).store.keys()).sort()
    expect(remaining).toEqual([
      'asset:a3',
      'asset:a4',
      'asset:a5',
      'asset:b1',
      'asset:b2',
    ])
    expect((r2 as any).store.has('k/a1')).toBe(false)
    expect((r2 as any).store.has('k/a2')).toBe(false)
    expect((r2 as any).store.has('k/a5')).toBe(true)
  })

  it('does nothing when count <= K', async () => {
    const kv = new FakeKV() as unknown as KVNamespace
    const r2 = new FakeR2()
    ;(kv as any).store.set('asset:a1', JSON.stringify(makeMeta('com.A', '1.0', 100, 'k/a1')))
    ;(r2 as any).store.set('k/a1', true)
    const env = {
      METADATA: kv,
      R2: r2 as unknown as R2Bucket,
      KEEP_VERSIONS_PER_BUNDLE: '3',
    } as unknown as Env
    await runCleanup(env)
    expect((kv as any).store.size).toBe(1)
  })
})
