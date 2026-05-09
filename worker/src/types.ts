export interface Env {
  // Bindings
  ASSETS: Fetcher
  R2: R2Bucket
  KV: KVNamespace

  // Vars
  USERNAME: string
  APPLE_HOST_ALLOWLIST: string
  SESSION_TTL_SECONDS: string

  // Secrets (wrangler secret put)
  PASSWORD_BCRYPT: string
  INSTALL_TOKEN_SECRET?: string
  R2_ACCOUNT_ID?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
}

export interface SessionData {
  username: string
  createdAt: number
  lastSeenAt: number
}

export interface AssetMetadata {
  bundleId: string
  version: string
  title: string
  size: number
  sha256?: string
  contentType: string
  uploadedAt: number
  r2Key: string
  /** appleId email used to patch */
  email?: string
}
