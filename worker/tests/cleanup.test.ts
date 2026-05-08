import { describe, expect, it } from 'vitest'
import {
  beijing0300CutoffUtcMs,
  ensureCapacity,
  runScheduledCleanup,
} from '../src/cleanup'
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

function makeMeta(
  bundleId: string,
  version: string,
  uploadedAt: number,
  key: string,
  size = 100
): AssetMetadata {
  return {
    bundleId,
    version,
    title: bundleId,
    size,
    contentType: 'application/octet-stream',
    uploadedAt,
    r2Key: key,
  }
}

function fakeEnv(items: Array<[string, AssetMetadata]>): { env: Env; kv: FakeKV; r2: FakeR2 } {
  const kv = new FakeKV()
  const r2 = new FakeR2()
  for (const [k, v] of items) {
    kv.store.set(k, JSON.stringify(v))
    r2.store.set(v.r2Key, true)
  }
  const env = {
    METADATA: kv as unknown as KVNamespace,
    R2: r2 as unknown as R2Bucket,
  } as unknown as Env
  return { env, kv, r2 }
}

describe('beijing0300CutoffUtcMs', () => {
  it('computes 03:00 Beijing of "today" given a UTC instant', () => {
    // 2026-05-08 04:00 Beijing == 2026-05-07 20:00 UTC.
    const now = new Date(Date.UTC(2026, 4, 7, 20, 0, 0)) // May 7 20:00 UTC
    const cutoff = beijing0300CutoffUtcMs(now)
    // Expect 03:00 Beijing on May 8 == 19:00 UTC on May 7.
    expect(cutoff).toBe(Date.UTC(2026, 4, 7, 19, 0, 0))
  })

  it('handles the cron jitter case where now is slightly later', () => {
    // 04:00:01 Beijing on May 8 = 20:00:01 UTC on May 7. Cutoff still
    // 03:00 Beijing on May 8 = 19:00 UTC on May 7.
    const now = new Date(Date.UTC(2026, 4, 7, 20, 0, 1))
    expect(beijing0300CutoffUtcMs(now)).toBe(Date.UTC(2026, 4, 7, 19, 0, 0))
  })

  it('crosses month boundary correctly', () => {
    // 04:00 Beijing on Jun 1 = 20:00 UTC on May 31. Cutoff = 03:00 Beijing
    // on Jun 1 = 19:00 UTC on May 31.
    const now = new Date(Date.UTC(2026, 4, 31, 20, 0, 0))
    expect(beijing0300CutoffUtcMs(now)).toBe(Date.UTC(2026, 4, 31, 19, 0, 0))
  })
})

describe('runScheduledCleanup', () => {
  it('drops every IPA uploaded before 03:00 Beijing of today', async () => {
    // Pretend "now" is 04:00 Beijing on May 8 (= 20:00 UTC on May 7).
    const now = new Date(Date.UTC(2026, 4, 7, 20, 0, 0))
    const cutoff = beijing0300CutoffUtcMs(now)
    const items: Array<[string, AssetMetadata]> = [
      // Old: yesterday's IPA, before cutoff
      ['asset:old1', makeMeta('com.A', '1.0', cutoff - 3600 * 1000, 'k/old1')],
      ['asset:old2', makeMeta('com.B', '1.0', cutoff - 1, 'k/old2')],
      // Fresh: uploaded between 03:00 and 04:00 Beijing today
      ['asset:fresh1', makeMeta('com.A', '2.0', cutoff + 60 * 1000, 'k/fresh1')],
      ['asset:fresh2', makeMeta('com.C', '1.0', cutoff + 30 * 60 * 1000, 'k/fresh2')],
    ]
    const { env, kv, r2 } = fakeEnv(items)
    const deleted = await runScheduledCleanup(env, now)
    expect(deleted).toBe(2)
    expect([...kv.store.keys()].sort()).toEqual(['asset:fresh1', 'asset:fresh2'])
    expect(r2.store.has('k/old1')).toBe(false)
    expect(r2.store.has('k/old2')).toBe(false)
    expect(r2.store.has('k/fresh1')).toBe(true)
  })
})

describe('ensureCapacity', () => {
  const ONE_GB = 1024 * 1024 * 1024
  it('does nothing when used <= 70% of 10 GB', async () => {
    // 6 GB used (60%) — below 7 GB threshold.
    const items: Array<[string, AssetMetadata]> = [
      ['asset:a', makeMeta('com.A', '1.0', 1, 'k/a', 3 * ONE_GB)],
      ['asset:b', makeMeta('com.B', '1.0', 2, 'k/b', 3 * ONE_GB)],
    ]
    const { env, kv } = fakeEnv(items)
    const result = await ensureCapacity(env)
    expect(result.deleted).toBe(0)
    expect(kv.store.size).toBe(2)
  })

  it('deletes oldest first when usage exceeds 70%', async () => {
    // 9 GB used (90%) — must drop oldest until <= 7 GB.
    // Sizes: oldest=3 GB, mid=3 GB, newest=3 GB.
    const items: Array<[string, AssetMetadata]> = [
      ['asset:oldest', makeMeta('com.A', '1.0', 100, 'k/oldest', 3 * ONE_GB)],
      ['asset:mid', makeMeta('com.A', '2.0', 200, 'k/mid', 3 * ONE_GB)],
      ['asset:newest', makeMeta('com.A', '3.0', 300, 'k/newest', 3 * ONE_GB)],
    ]
    const { env, kv, r2 } = fakeEnv(items)
    const result = await ensureCapacity(env)
    // After deleting oldest (3 GB), used = 6 GB <= 7 GB → stop.
    expect(result.deleted).toBe(1)
    expect(kv.store.has('asset:oldest')).toBe(false)
    expect(kv.store.has('asset:mid')).toBe(true)
    expect(kv.store.has('asset:newest')).toBe(true)
    expect(r2.store.has('k/oldest')).toBe(false)
  })

  it('keeps deleting in order until under target', async () => {
    // 9.5 GB used: 5 small (0.5 GB each) + 1 big (7 GB), oldest first.
    // Threshold 7 GB. Need to drop until used <= 7 GB.
    // After o1: 9 GB. After o2: 8.5. After o3: 8. After o4: 7.5. After o5: 7. (stop)
    const HALF = ONE_GB / 2
    const items: Array<[string, AssetMetadata]> = [
      ['asset:o1', makeMeta('com.A', '1.0', 100, 'k/o1', HALF)],
      ['asset:o2', makeMeta('com.A', '2.0', 200, 'k/o2', HALF)],
      ['asset:o3', makeMeta('com.A', '3.0', 300, 'k/o3', HALF)],
      ['asset:o4', makeMeta('com.A', '4.0', 400, 'k/o4', HALF)],
      ['asset:o5', makeMeta('com.A', '5.0', 500, 'k/o5', HALF)],
      ['asset:big', makeMeta('com.B', '1.0', 600, 'k/big', 7 * ONE_GB)],
    ]
    const { env, kv } = fakeEnv(items)
    const result = await ensureCapacity(env)
    expect(result.deleted).toBe(5)
    expect([...kv.store.keys()]).toEqual(['asset:big'])
  })
})
