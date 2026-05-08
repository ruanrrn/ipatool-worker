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
    const list: KVNamespaceListResult<unknown, string> = await env.METADATA.list({
      prefix: 'asset:',
      cursor,
    })
    for (const k of list.keys) {
      const id = k.name.slice('asset:'.length)
      const raw = await env.METADATA.get(k.name)
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

async function deleteAsset(env: Env, entry: AssetEntry): Promise<void> {
  try {
    await env.R2.delete(entry.meta.r2Key)
  } catch (err) {
    console.warn('R2 delete failed:', err)
  }
  await env.METADATA.delete(`asset:${entry.assetId}`)
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
  let deleted = 0
  for (const entry of all) {
    if (entry.meta.uploadedAt < cutoff) {
      await deleteAsset(env, entry)
      deleted++
    }
  }
  console.log(
    `scheduled cleanup: cutoff=${new Date(cutoff).toISOString()} ` +
      `scanned=${all.length} deleted=${deleted}`
  )
  return deleted
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

  // Sort oldest first.
  all.sort((a, b) => a.meta.uploadedAt - b.meta.uploadedAt)
  let deleted = 0
  for (const entry of all) {
    if (used <= target) break
    await deleteAsset(env, entry)
    used -= entry.meta.size || 0
    deleted++
  }
  console.log(
    `capacity cleanup: deleted=${deleted} used_after=${used} ` +
      `threshold=${threshold.toFixed(0)} target=${target.toFixed(0)}`
  )
  return { used, deleted }
}
