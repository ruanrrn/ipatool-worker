// Daily cleanup cron: keep latest K versions per bundle_id, delete the rest.
import type { Env, AssetMetadata } from './types'

export async function runCleanup(env: Env): Promise<void> {
  const KEEP = Math.max(1, parseInt(env.KEEP_VERSIONS_PER_BUNDLE || '3', 10))
  const byBundle = new Map<string, Array<{ assetId: string; meta: AssetMetadata }>>()

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
        const arr = byBundle.get(meta.bundleId) ?? []
        arr.push({ assetId: id, meta })
        byBundle.set(meta.bundleId, arr)
      } catch {}
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  let deleted = 0
  for (const [, arr] of byBundle) {
    arr.sort((a, b) => b.meta.uploadedAt - a.meta.uploadedAt)
    const drop = arr.slice(KEEP)
    for (const item of drop) {
      try {
        await env.R2.delete(item.meta.r2Key)
      } catch (err) {
        console.warn('cleanup R2 delete failed:', err)
      }
      await env.METADATA.delete(`asset:${item.assetId}`)
      deleted++
    }
  }

  console.log(`cleanup: scanned ${byBundle.size} bundles, deleted ${deleted} old versions`)
}
