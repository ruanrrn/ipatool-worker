import type { Env } from './types'

interface VersionEntry {
  bundle_version: string
  external_identifier: number
  size: number
  created_at: string
}

export async function handleVersions(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url)
  const appid = url.searchParams.get('appid')
  const country = url.searchParams.get('country') || 'us'

  if (!appid) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing appid parameter' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }

  // Build the two third-party API URLs
  const timbrdUrl = `https://api.timbrd.com/apple/app-version/index.php?id=${encodeURIComponent(appid)}&country=${encodeURIComponent(country)}`
  const bilinUrl = `https://apis.bilin.eu.org/history/${encodeURIComponent(appid)}?country=${encodeURIComponent(country)}`

  // Fetch both in parallel, tolerate individual failures
  const [timbrdRes, bilinRes] = await Promise.allSettled([
    fetch(timbrdUrl, { headers: { 'user-agent': 'ipatool-worker/0.1' } }).then(async (r) => {
      if (!r.ok) throw new Error(`timbrd returned ${r.status}`)
      return r.json() as Promise<VersionEntry[]>
    }),
    fetch(bilinUrl, { headers: { 'user-agent': 'ipatool-worker/0.1' } }).then(async (r) => {
      if (!r.ok) throw new Error(`bilin returned ${r.status}`)
      return r.json() as Promise<VersionEntry[]>
    }),
  ])

  const merged: VersionEntry[] = []

  if (timbrdRes.status === 'fulfilled' && Array.isArray(timbrdRes.value)) {
    merged.push(...timbrdRes.value)
  }
  if (bilinRes.status === 'fulfilled' && Array.isArray(bilinRes.value)) {
    merged.push(...bilinRes.value)
  }

  // Deduplicate by external_identifier
  const seen = new Set<number>()
  const unique: VersionEntry[] = []
  for (const entry of merged) {
    const id = entry.external_identifier
    if (!seen.has(id)) {
      seen.add(id)
      unique.push(entry)
    }
  }

  // Sort by created_at descending
  unique.sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0))

  return new Response(
    JSON.stringify({ ok: true, data: unique }),
    { headers: { 'content-type': 'application/json' } }
  )
}
