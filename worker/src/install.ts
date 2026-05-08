// OTA install routes:
//   GET /m/:assetId        -> manifest.plist (consumed by iOS installd)
//   GET /d/:assetId        -> streams IPA from R2 (with cf.cacheTtl)
//   GET /i/:assetId        -> human-friendly landing page with itms-services link + QR
//
// installd doesn't carry cookies, so these endpoints are public-by-knowledge
// of the random 128-bit asset_id (UUIDv4). Optional HMAC token strengthens
// this if INSTALL_TOKEN_SECRET is set.

import type { Env, AssetMetadata } from './types'

async function loadAsset(env: Env, assetId: string): Promise<AssetMetadata | null> {
  const raw = await env.METADATA.get(`asset:${assetId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AssetMetadata
  } catch {
    return null
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildManifestPlist(meta: {
  ipaUrl: string
  bundleId: string
  version: string
  title: string
}): string {
  const u = escapeXml(meta.ipaUrl)
  const b = escapeXml(meta.bundleId)
  const v = escapeXml(meta.version)
  const t = escapeXml(meta.title)
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${u}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${b}</string>
        <key>bundle-version</key>
        <string>${v}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${t}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
`
}

function sanitizeFilenameSegment(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80) || 'app'
}

function canonicalIpaFilename(meta: AssetMetadata): string {
  const title = sanitizeFilenameSegment(meta.title)
  const bundleId = sanitizeFilenameSegment(meta.bundleId)
  return `${title}@${bundleId}.ipa`
}

export async function handleManifest(
  _req: Request,
  env: Env,
  url: URL,
  assetId: string
): Promise<Response> {
  const meta = await loadAsset(env, assetId)
  if (!meta) return new Response('not found', { status: 404 })
  const ipaUrl = `${url.origin}/d/${assetId}.ipa`
  const xml = buildManifestPlist({
    ipaUrl,
    bundleId: meta.bundleId,
    version: meta.version,
    title: meta.title,
  })
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

export async function handleDownload(
  req: Request,
  env: Env,
  _url: URL,
  assetId: string
): Promise<Response> {
  const meta = await loadAsset(env, assetId)
  if (!meta) return new Response('not found', { status: 404 })

  const range = req.headers.get('range')
  const r2Opts: R2GetOptions = {}
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/)
    if (m) {
      const start = parseInt(m[1]!, 10)
      const end = m[2] ? parseInt(m[2]!, 10) : undefined
      r2Opts.range = end !== undefined ? { offset: start, length: end - start + 1 } : { offset: start }
    }
  }

  const obj = await env.R2.get(meta.r2Key, r2Opts)
  if (!obj) return new Response('object missing', { status: 404 })

  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        'content-type': meta.contentType,
        'content-length': String(meta.size),
        'accept-ranges': 'bytes',
        'content-disposition': `attachment; filename="${canonicalIpaFilename(meta)}"`,
        'cache-control': 'public, max-age=86400, immutable',
      },
    })
  }

  const headers: Record<string, string> = {
    'content-type': meta.contentType,
    'accept-ranges': 'bytes',
    'content-disposition': `attachment; filename="${canonicalIpaFilename(meta)}"`,
    'cache-control': 'public, max-age=86400, immutable',
  }

  if (range && obj.range) {
    const start = (obj.range as { offset: number; length?: number }).offset
    const length = (obj.range as { offset: number; length?: number }).length ?? meta.size - start
    const end = start + length - 1
    headers['content-range'] = `bytes ${start}-${end}/${meta.size}`
    headers['content-length'] = String(length)
    return new Response(obj.body, { status: 206, headers })
  }

  headers['content-length'] = String(meta.size)
  return new Response(obj.body, { status: 200, headers })
}

export async function handleInstallPage(
  _req: Request,
  env: Env,
  url: URL,
  assetId: string
): Promise<Response> {
  const meta = await loadAsset(env, assetId)
  if (!meta) return new Response('not found', { status: 404 })
  const manifestUrl = `${url.origin}/m/${assetId}.plist`
  const itms = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`
  const title = escapeXml(meta.title)
  const ver = escapeXml(meta.version)
  const bid = escapeXml(meta.bundleId)
  const sizeMb = (meta.size / (1024 * 1024)).toFixed(1)
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>安装 ${title}</title>
<style>
:root{color-scheme:light dark}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px;background:#f5f5f7;color:#111}
@media (prefers-color-scheme:dark){body{background:#000;color:#eee}}
.card{max-width:520px;margin:40px auto;padding:24px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
@media (prefers-color-scheme:dark){.card{background:#1c1c1e}}
h1{margin:0 0 8px;font-size:22px}
.meta{font-size:14px;color:#888;margin-bottom:24px}
.btn{display:block;width:100%;text-align:center;padding:14px 20px;border-radius:10px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:600;font-size:17px}
.btn:active{opacity:.8}
.tip{margin-top:16px;font-size:13px;color:#888;line-height:1.5}
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <div class="meta">版本 ${ver} · ${sizeMb} MB · <code>${bid}</code></div>
  <a class="btn" href="${escapeXml(itms)}">在 iPhone 上安装</a>
  <p class="tip">在 iPhone Safari 中点击上方按钮 → 系统会弹出"是否安装"对话框。<br>
  如果在桌面浏览器，请用 iPhone 扫描页面 URL 二维码后再点击。</p>
</div>
</body>
</html>`
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
