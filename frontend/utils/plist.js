// Minimal Apple plist (XML) builder/parser for browser use.
//
// Apple iTunes private API speaks plain XML plist (not the binary variant).
// We only need the value types Apple actually uses in its auth/download
// endpoints: <string>, <integer>, <true/>, <false/>, <data>, <array>, <dict>,
// <date> (rare). No <real>.

const PLIST_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
  '<plist version="1.0">\n'
const PLIST_FOOTER = '</plist>\n'

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function emit(value) {
  if (value === null || value === undefined) return '<string></string>'
  if (typeof value === 'string') return `<string>${escapeXml(value)}</string>`
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return `<integer>${value}</integer>`
    return `<real>${value}</real>`
  }
  if (value instanceof Uint8Array) {
    let s = ''
    const chunk = 0x8000
    for (let i = 0; i < value.byteLength; i += chunk) {
      s += String.fromCharCode.apply(null, value.subarray(i, i + chunk))
    }
    return `<data>${btoa(s)}</data>`
  }
  if (Array.isArray(value)) {
    return '<array>' + value.map(emit).join('') + '</array>'
  }
  if (typeof value === 'object') {
    let s = '<dict>'
    for (const [k, v] of Object.entries(value)) {
      s += `<key>${escapeXml(k)}</key>${emit(v)}`
    }
    s += '</dict>'
    return s
  }
  return '<string></string>'
}

export function buildPlist(value) {
  return PLIST_HEADER + emit(value) + PLIST_FOOTER
}

// Parser uses DOMParser (available in browsers and modern Node via JSDOM).

function getDomParser() {
  if (typeof DOMParser !== 'undefined') return new DOMParser()
  throw new Error('DOMParser not available')
}

function parseNode(node) {
  if (!node) return null
  switch (node.tagName) {
    case 'string': return node.textContent || ''
    case 'integer': {
      const t = (node.textContent || '').trim()
      if (/^-?\d+$/.test(t)) {
        const n = Number(t)
        if (Number.isSafeInteger(n)) return n
        return t
      }
      return t
    }
    case 'real': return parseFloat(node.textContent || '0')
    case 'true': return true
    case 'false': return false
    case 'data': {
      const b64 = (node.textContent || '').replace(/\s/g, '')
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return arr
    }
    case 'date': return node.textContent
    case 'array': {
      const out = []
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) continue
        out.push(parseNode(child))
      }
      return out
    }
    case 'dict': {
      const obj = {}
      const children = Array.from(node.childNodes).filter((n) => n.nodeType === 1)
      for (let i = 0; i < children.length; i += 2) {
        const keyNode = children[i]
        const valueNode = children[i + 1]
        if (!keyNode || keyNode.tagName !== 'key') continue
        obj[keyNode.textContent || ''] = parseNode(valueNode)
      }
      return obj
    }
    default:
      return node.textContent
  }
}

function normalizeBody(body) {
  if (!body) return ''
  const t = body.trim()
  if (!t) return ''
  const start = t.indexOf('<plist')
  const endStr = '</plist>'
  const end = t.lastIndexOf(endStr)
  if (start >= 0 && end >= 0) return t.slice(start, end + endStr.length).trim()
  const dictStart = t.indexOf('<dict')
  const dictEnd = t.lastIndexOf('</dict>')
  if (dictStart >= 0 && dictEnd >= 0) {
    const inner = t.slice(dictStart, dictEnd + '</dict>'.length).trim()
    return PLIST_HEADER + inner + PLIST_FOOTER
  }
  if (t.indexOf('<key>') >= 0) return PLIST_HEADER + '<dict>' + t + '</dict>' + PLIST_FOOTER
  return t
}

export function parsePlist(body) {
  const text = normalizeBody(body)
  if (!text) return {}
  const dom = getDomParser().parseFromString(text, 'text/xml')
  const root = dom.querySelector('plist > *') || dom.querySelector('dict')
  if (!root) return {}
  return parseNode(root)
}
