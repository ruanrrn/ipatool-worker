// IndexedDB + Web Crypto AES-GCM + PBKDF2(master PIN, 600k iter).
//
// Schema:
//   db: ipatool-creds, version 1
//     stores:
//       - meta:    { id: 'master', salt: Uint8Array, verifier: Uint8Array }
//       - apple:   { email, ciphertext: Uint8Array, iv: Uint8Array }
//       - sessions:{ assetId, ... opaque blobs ... }
//
// The master PIN is never stored. We derive a key with PBKDF2 and encrypt:
//   - Apple ID + password + passwordToken + dsPersonId
// The "verifier" is a fixed plaintext encrypted with the derived key, used
// to detect wrong PIN on unlock.

const DB_NAME = 'ipatool-creds'
const DB_VERSION = 1
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

async function deriveKey(pin, salt) {
  const passKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptBytes(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv, ct: new Uint8Array(ct) }
}

async function decryptBytes(key, ct, iv) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new Uint8Array(pt)
}

export async function isMasterPinSet() {
  const meta = await getMeta()
  return !!meta
}

export async function setMasterPin(pin) {
  if (typeof pin !== 'string' || pin.length < 4) throw new Error('PIN 至少 4 位')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(pin, salt)
  const verifier = await encryptBytes(key, new TextEncoder().encode(VERIFIER_TEXT))
  await putMeta({
    salt,
    verifierIv: verifier.iv,
    verifierCt: verifier.ct,
  })
  _key = key
}

export async function unlockMasterPin(pin) {
  const meta = await getMeta()
  if (!meta) throw new Error('尚未设置主 PIN')
  const key = await deriveKey(pin, meta.salt)
  try {
    const pt = await decryptBytes(key, meta.verifierCt, meta.verifierIv)
    if (new TextDecoder().decode(pt) !== VERIFIER_TEXT) throw new Error('verifier mismatch')
  } catch {
    throw new Error('PIN 错误')
  }
  _key = key
}

export function lockMasterPin() {
  _key = null
}

export function isUnlocked() {
  return _key !== null
}

function ensureKey() {
  if (!_key) throw new Error('主 PIN 未解锁')
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
