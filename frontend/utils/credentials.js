// IndexedDB + Web Crypto AES-GCM + auto-generated key + PBKDF2.
//
// Schema:
//   db: ipatool-creds, version 2
//     stores:
//       - meta:    { id: 'master', salt: Uint8Array, verifier: Uint8Array,
//                    exportedKey: Uint8Array }  // raw AES key bytes (v2)
//       - apple:   { email, ciphertext: Uint8Array, iv: Uint8Array }
//       - sessions:{ assetId, ... opaque blobs ... }
//
// v2 change: the AES-GCM key is auto-generated and its raw bytes are stored in
// IndexedDB so the user never needs to know a PIN. The PBKDF2 layer is kept for
// backward-compat (verifier check) but on fresh installs we skip it entirely and
// just store the exported key material directly.

const DB_NAME = 'ipatool-creds'
const DB_VERSION = 2
const STORE_META = 'meta'
const STORE_APPLE = 'apple'
const PBKDF2_ITERATIONS = 600_000
const VERIFIER_TEXT = 'ipatool-master-verifier-v1'

let _key = null
let _dbPromise = null

function openDb() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (evt) => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_APPLE)) {
        db.createObjectStore(STORE_APPLE, { keyPath: 'email' })
      }
      // v1→v2: no structural change, we just add exportedKey to existing meta
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function txStore(db, name, mode) {
  return db.transaction(name, mode).objectStore(name)
}

async function getMeta() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_META, 'readonly').get('master')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function putMeta(meta) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_META, 'readwrite').put({ id: 'master', ...meta })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Key generation & persistence ──────────────────────────────────

async function generateAesKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can export
    ['encrypt', 'decrypt']
  )
}

async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

async function importKey(rawBytes) {
  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Encryption helpers ────────────────────────────────────────────

async function encryptBytes(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv, ct: new Uint8Array(ct) }
}

async function decryptBytes(key, ct, iv) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new Uint8Array(pt)
}

// ── Public API ────────────────────────────────────────────────────

export async function isMasterPinSet() {
  const meta = await getMeta()
  return !!meta
}

export function isUnlocked() {
  return _key !== null
}

/**
 * Auto-initialize: on first visit, generate a random AES key and store it
 * in IndexedDB. On subsequent visits, restore the key from IndexedDB.
 * The user never sees or needs to remember anything.
 *
 * Returns true if the key is ready (always, unless something is very wrong).
 */
export async function ensureInitialized() {
  if (_key) return true

  const meta = await getMeta()

  if (meta) {
    // Existing install — try to restore key from exportedKey (v2)
    if (meta.exportedKey) {
      try {
        _key = await importKey(meta.exportedKey)
        return true
      } catch {
        // exportedKey corrupt — fall through to legacy unlock
      }
    }

    // Legacy v1: no exportedKey stored. We cannot recover without PIN.
    // The only option is to clear and reinitialize (user will need to
    // re-add Apple accounts). This should only happen once for v1→v2 upgrade.
    await clearAllData()
    // Fall through to create fresh
  }

  // Fresh install (or cleared legacy) — generate new key
  const key = await generateAesKey()
  const rawKey = await exportKey(key)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier = await encryptBytes(key, new TextEncoder().encode(VERIFIER_TEXT))

  await putMeta({
    salt,
    verifierIv: verifier.iv,
    verifierCt: verifier.ct,
    exportedKey: rawKey,
  })

  _key = key
  return true
}

/**
 * Clear all credential data (IndexedDB stores). Used when migrating from
 * v1 where we can't recover the key.
 */
async function clearAllData() {
  const db = await openDb()
  const tx = db.transaction([STORE_META, STORE_APPLE], 'readwrite')
  tx.objectStore(STORE_META).delete('master')
  tx.objectStore(STORE_APPLE).clear()
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── Legacy API kept for compat (no-ops / thin wrappers) ───────────

export async function setMasterPin(pin) {
  // Legacy — not needed in v2 but kept to avoid import errors
  if (typeof pin !== 'string' || pin.length < 4) throw new Error('PIN 至少 4 位')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await generateAesKey()
  const verifier = await encryptBytes(key, new TextEncoder().encode(VERIFIER_TEXT))
  const rawKey = await exportKey(key)
  await putMeta({
    salt,
    verifierIv: verifier.iv,
    verifierCt: verifier.ct,
    exportedKey: rawKey,
  })
  _key = key
}

export async function autoGeneratePin() {
  // v2: just delegate to ensureInitialized
  await ensureInitialized()
}

export async function unlockMasterPin() {
  // v2: just restore from stored key
  await ensureInitialized()
}

export function lockMasterPin() {
  _key = null
}

function ensureKey() {
  if (!_key) throw new Error('密钥未初始化，请刷新页面')
  return _key
}

export async function saveAppleAccount({ email, password, dsPersonId, passwordToken, region }) {
  const key = ensureKey()
  const data = JSON.stringify({ password, dsPersonId, passwordToken, region })
  const { iv, ct } = await encryptBytes(key, new TextEncoder().encode(data))
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_APPLE, 'readwrite').put({ email, iv, ct })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function loadAppleAccount(email) {
  const key = ensureKey()
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_APPLE, 'readonly').get(email)
    req.onsuccess = async () => {
      if (!req.result) {
        resolve(null)
        return
      }
      try {
        const pt = await decryptBytes(key, req.result.ct, req.result.iv)
        resolve({ email, ...JSON.parse(new TextDecoder().decode(pt)) })
      } catch (e) {
        reject(e)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function listAppleAccounts() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_APPLE, 'readonly').getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteAppleAccount(email) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = txStore(db, STORE_APPLE, 'readwrite').delete(email)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
