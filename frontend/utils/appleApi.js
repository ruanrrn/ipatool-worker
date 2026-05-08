// High-level client for Apple's iTunes private API.
// Routes through the Worker's /apple/proxy endpoint (allow-listed Apple
// hosts only). The Worker is fully trusted in this single-user private
// deployment.
//
// Reference: server/src/apple_auth.rs (the Rust impl this is a 1:1 port of)

import { buildPlist, parsePlist } from './plist.js'

const USER_AGENT = 'Configurator/2.17 (Macintosh; OS X 15.2; 24C5089c) AppleWebKit/0620.1.16.11.6'

const STOREFRONT_REGIONS = {
  '143441': 'US',
  '143465': 'CN',
  '143462': 'JP',
  '143444': 'GB',
  '143443': 'DE',
  '143442': 'FR',
  '143455': 'CA',
  '143460': 'AU',
}

function bytesToBase64(bytes) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(s)
}

function base64ToBytes(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function proxyFetch({ url, method = 'GET', headers = {}, bodyBytes }) {
  const resp = await fetch('/apple/proxy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method,
      headers,
      body: bodyBytes ? bytesToBase64(bodyBytes) : undefined,
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    const err = new Error(`apple proxy ${resp.status}: ${txt}`)
    err.status = resp.status
    throw err
  }
  const json = await resp.json()
  return {
    status: json.status,
    headers: json.headers || {},
    body: json.body ? base64ToBytes(json.body) : new Uint8Array(),
    finalUrl: json.finalUrl,
  }
}

function utf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function generateGuid() {
  // 12 hex chars, matches /sys/class/net MAC pattern from the server impl.
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function ensureGuidQuery(endpoint, guid) {
  if (endpoint.includes('guid=')) return endpoint
  return endpoint + (endpoint.includes('?') ? '&' : '?') + 'guid=' + guid
}

function normalizeRegionCandidate(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  const alpha = trimmed.replace(/[^a-zA-Z]/g, '').toUpperCase()
  if (alpha.length >= 2 && alpha.length <= 3) return alpha
  const digits = trimmed.match(/^\d+/)?.[0]
  if (digits && STOREFRONT_REGIONS[digits]) return STOREFRONT_REGIONS[digits]
  return null
}

function extractRegionFromHeaders(headers) {
  const keys = ['x-set-apple-store-front', 'x-apple-store-front', 'x-apple-storefront']
  for (const k of keys) {
    const v = headers[k] || headers[k.toLowerCase()]
    if (v) {
      const r = normalizeRegionCandidate(v)
      if (r) return r
    }
  }
  return null
}

export class Store {
  constructor() {
    this.guid = generateGuid()
  }

  async _resolveAuthEndpoint() {
    const url = `https://init.itunes.apple.com/bag.xml?guid=${this.guid}`
    const r = await proxyFetch({
      url,
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' },
    })
    if (r.status !== 200) throw new Error(`bag returned ${r.status}`)
    const parsed = parsePlist(utf8(r.body))
    const ep = parsed?.urlBag?.authenticateAccount
    if (!ep) throw new Error('bag missing urlBag.authenticateAccount')
    return ep
  }

  async authenticate(email, password, mfa) {
    const fallback = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`
    let endpoint
    try {
      endpoint = await this._resolveAuthEndpoint()
    } catch (e) {
      console.warn('bag resolve failed, falling back:', e)
      endpoint = fallback
    }
    let url = ensureGuidQuery(endpoint, this.guid)
    let inferredRegion = null
    let lastResult = {}
    const cleanMfa = (mfa || '').replace(/\s+/g, '')

    for (let attempt = 1; attempt <= 4; attempt++) {
      const combinedPassword = password + cleanMfa
      const bodyXml = buildPlist({
        appleId: email,
        attempt: String(attempt),
        createSession: 'true',
        guid: this.guid,
        password: combinedPassword,
        rmp: '0',
        why: 'signIn',
      })
      const bodyBytes = new TextEncoder().encode(bodyXml)

      const r = await proxyFetch({
        url,
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        bodyBytes,
      })

      const region = extractRegionFromHeaders(r.headers)
      if (region) inferredRegion = region

      // 302 redirect handling
      if (r.status === 301 || r.status === 302) {
        const loc = r.headers['location'] || r.headers['Location']
        if (loc) {
          let next
          try {
            next = new URL(loc, url).toString()
          } catch {
            next = null
          }
          if (next) {
            url = ensureGuidQuery(next, this.guid)
            continue
          }
        }
        return {
          _state: 'failure',
          failureType: 'RedirectError',
          customerMessage: 'Apple 登录重定向异常，请重新开始登录流程',
        }
      }

      let result
      try {
        result = parsePlist(utf8(r.body))
      } catch (e) {
        return {
          _state: 'failure',
          failureType: 'ParseError',
          customerMessage: '无法解析 Apple 的响应，请稍后重试',
        }
      }
      if (inferredRegion) result.region = inferredRegion

      const failureType = result?.failureType || ''
      // Apple sometimes returns -5000 on first attempt even with correct password;
      // automatically retry once.
      if (attempt === 1 && failureType === '-5000') {
        lastResult = result
        continue
      }
      lastResult = result
      break
    }

    const out = { ...lastResult }
    const success = lastResult.dsPersonId || lastResult.passwordToken
    if (success) {
      out._state = 'success'
      const ai = lastResult.accountInfo || {}
      const addr = ai.address || {}
      const display = [addr.firstName, addr.lastName].filter(Boolean).join(' ').trim()
      if (display) out.displayName = display
      if (ai.appleId) out.email = ai.appleId
      const region = normalizeRegionCandidate(addr.countryCode || ai.countryCode || ai.storefront)
      if (region) out.region = region
      else if (inferredRegion) out.region = inferredRegion
    } else {
      out._state = 'failure'
    }
    return out
  }

  async ensureLicense(appIdentifier, appVerId, authInfo) {
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`
    const fields = {
      appExtVrsId: appVerId || '0',
      hasAskedToFulfillPreorder: 'true',
      buyWithoutAuthorization: 'true',
      hasDoneAgeCheck: 'true',
      guid: this.guid,
      needDiv: '0',
      origPage: `Software-${appIdentifier}`,
      origPageLocation: 'Buy',
      price: '0',
      pricingParameters: 'STDQ',
      productType: 'C',
      salableAdamId: appIdentifier,
    }
    if (appVerId) fields.externalVersionId = appVerId
    const bodyXml = buildPlist(fields)
    const headers = {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-apple-plist',
      Accept: 'application/x-apple-plist, text/xml, application/xml, */*',
    }
    if (authInfo?.dsPersonId) {
      headers['X-Dsid'] = authInfo.dsPersonId
      headers['iCloud-DSID'] = authInfo.dsPersonId
    }
    if (authInfo?.passwordToken) headers['X-Token'] = authInfo.passwordToken
    const r = await proxyFetch({
      url,
      method: 'POST',
      headers,
      bodyBytes: new TextEncoder().encode(bodyXml),
    })
    let result = {}
    try {
      result = parsePlist(utf8(r.body))
    } catch {}
    const failureType = result?.failureType || ''
    result._state = failureType ? 'failure' : 'success'
    return result
  }

  async downloadProduct(appIdentifier, appVerId, authInfo) {
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`
    const fields = {
      creditDisplay: '',
      guid: this.guid,
      salableAdamId: appIdentifier,
    }
    if (appVerId) fields.externalVersionId = appVerId
    const bodyXml = buildPlist(fields)
    const headers = {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-apple-plist',
      Accept: 'application/x-apple-plist, text/xml, application/xml, */*',
    }
    if (authInfo?.dsPersonId) {
      headers['X-Dsid'] = authInfo.dsPersonId
      headers['iCloud-DSID'] = authInfo.dsPersonId
    }
    if (authInfo?.passwordToken) headers['X-Token'] = authInfo.passwordToken
    const r = await proxyFetch({
      url,
      method: 'POST',
      headers,
      bodyBytes: new TextEncoder().encode(bodyXml),
    })
    let result = {}
    try {
      result = parsePlist(utf8(r.body))
    } catch {}
    const failureType = result?.failureType || ''
    const songList = Array.isArray(result?.songList) ? result.songList : []
    result._state = failureType || songList.length === 0 ? 'failure' : 'success'
    return result
  }
}

// iTunes Search API - public, doesn't need auth, returns JSON. CORS-friendly.
export async function searchApps(term, country = 'US', limit = 25) {
  const url = `https://itunes.apple.com/search?media=software&country=${encodeURIComponent(country)}&limit=${limit}&term=${encodeURIComponent(term)}`
  const resp = await fetch(url, { mode: 'cors' })
  if (!resp.ok) throw new Error(`search failed: ${resp.status}`)
  const json = await resp.json()
  return json.results || []
}
