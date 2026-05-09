// R2 cleanup policies.
//
// (1) Daily scheduled cron: at 04:00 Beijing (= 20:00 UTC), delete every IPA
//     uploaded before 03:00 Beijing of the same Beijing-day. In effect this
//     keeps only the IPAs that were uploaded within the last hour, and
//     resets storage daily.
//
// (2) Capacity-driven cleanup: triggered after a download (`/d/`) and after
//     a successful upload (`/r2/upload-complete`). When total stored bytes
//     exceed 70% of the R2 free-tier quota (10 GB), delete the oldest IPA(s)
//     by `uploadedAt` ascending until usage drops back below the threshold.

import type { Env, AssetMetadata } from './types'

const QUOTA_BYTES = 10 * 1024 * 1024 * 1024 // R2 free tier
export const CAPACITY_THRESHOLD_FRACTION = 0.7 // start cleanup when used > 70%
export const CAPACITY_TARGET_FRACTION = 0.7 // delete down to <= 70%
const BEIJING_OFFSET_MS = 8 * 3600 * 1000

export interface AssetEntry {
  assetId: string
  meta: AssetMetadata
}

async function listAllAssets(env: Env): Promise<AssetEntry[]> {
  const out: AssetEntry[] = []
  let cursor: string | undefined = undefined
  do {
    const list: KVNamespaceListResult<unknown, string> = await env.KV.list({
      prefix: 'asset:',
      cursor,
    })
    for (const k of list.keys) {
      const id = k.name.slice('asset:'.length)
      const raw = await env.KV.get(k.name)
      if (!raw) continue
      try {
        const meta = JSON.parse(raw) as AssetMetadata
        out.push({ assetId: id, meta })
      } catch {}
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)
  return out
}

// Cloudflare R2 binding `delete()` accepts an array of keys (S3
// DeleteObjects under the hood, max 1000 per call). Deleting in bulk
// keeps Class A operations down — important inside the Worker free-tier
// caps and for keeping cleanup latency bounded when the bucket has
// many objects.
const R2_BULK_DELETE_LIMIT = 1000

async function deleteAssetsBulk(env: Env, entries: AssetEntry[]): Promise<void> {
  if (entries.length === 0) return
  // R2 batch delete (chunked).
  const r2Keys = entries.map((e) => e.meta.r2Key)
  for (let i = 0; i < r2Keys.length; i += R2_BULK_DELETE_LIMIT) {
    const slice = r2Keys.slice(i, i + R2_BULK_DELETE_LIMIT)
    try {
      await env.R2.delete(slice)
    } catch (err) {
      console.warn('R2 bulk delete failed:', err)
    }
  }
  // KV has no bulk delete — issue all deletes in parallel.
  await Promise.all(
    entries.map((e) =>
      env.KV.delete(`asset:${e.assetId}`).catch((err) => {
        console.warn(`KV delete asset:${e.assetId} failed:`, err)
      })
    )
  )
}

/**
 * "03:00 Beijing of today (Beijing-day at `now`)" expressed as a UTC ms
 * timestamp. Anything strictly before this is considered "yesterday's"
 * IPA from the user's daily perspective.
 *
 * Exported for tests so we can pin a synthetic `now`.
 */
export function beijing0300CutoffUtcMs(now: Date = new Date()): number {
  const beijing = new Date(now.getTime() + BEIJING_OFFSET_MS)
  // beijing.getUTC*() now returns Beijing date components.
  return Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate(),
    3 - 8, // 3 (Beijing 03:00) - 8 (offset) = -5h UTC; Date.UTC normalises into the previous UTC day.
    0,
    0,
    0
  )
}

/**
 * Daily scheduled cleanup. Drops every asset whose uploadedAt is strictly
 * before "03:00 Beijing today". Cron schedule (in wrangler.toml) is set to
 * `0 20 * * *` UTC = 04:00 Beijing.
 */
export async function runScheduledCleanup(env: Env, now: Date = new Date()): Promise<number> {
  const cutoff = beijing0300CutoffUtcMs(now)
  const all = await listAllAssets(env)
  const victims = all.filter((e) => e.meta.uploadedAt < cutoff)
  await deleteAssetsBulk(env, victims)
  console.log(
    `scheduled cleanup: cutoff=${new Date(cutoff).toISOString()} ` +
      `scanned=${all.length} deleted=${victims.length}`
  )
  return victims.length
}

/**
 * Capacity-driven cleanup: if the total bytes exceed
 * QUOTA * CAPACITY_THRESHOLD_FRACTION, drop oldest-by-uploadedAt IPAs
 * until usage is back at <= QUOTA * CAPACITY_TARGET_FRACTION.
 */
export async function ensureCapacity(env: Env): Promise<{ used: number; deleted: number }> {
  const all = await listAllAssets(env)
  let used = all.reduce((acc, e) => acc + (e.meta.size || 0), 0)
  const threshold = QUOTA_BYTES * CAPACITY_THRESHOLD_FRACTION
  const target = QUOTA_BYTES * CAPACITY_TARGET_FRACTION
  if (used <= threshold) return { used, deleted: 0 }

  // Pick the oldest-first slice that brings usage at or below target, then
  // delete them in a single R2 batch call.
  all.sort((a, b) => a.meta.uploadedAt - b.meta.uploadedAt)
  const victims: AssetEntry[] = []
  for (const entry of all) {
    if (used <= target) break
    victims.push(entry)
    used -= entry.meta.size || 0
  }
  await deleteAssetsBulk(env, victims)
  console.log(
    `capacity cleanup: deleted=${victims.length} used_after=${used} ` +
      `threshold=${threshold.toFixed(0)} target=${target.toFixed(0)}`
  )
  return { used, deleted: victims.length }
}
