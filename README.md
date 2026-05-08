# ipaTool — Private Single-User IPA Sign + OTA Install

完全私有化部署、单用户独享。零 GitHub 依赖（无 Actions / Releases / PAT）。
重活全在手机端 WASM，Worker 只做鉴权 / Apple TLS 中继 / R2 分发。

## 架构

```
iPhone Safari (PWA)                    Cloudflare Worker (单文件)
  ┌──────────────────────┐               ┌──────────────────────────┐
  │ Login → cookie sid   ├──/auth/login─►│ bcrypt + KV session      │
  │ Apple ID 加密在本地   │               │ 5/15min IP rate limit    │
  │  IndexedDB+AES-GCM   │               │                          │
  │  PBKDF2(主 PIN, 600k)│               │                          │
  │                      ├──/apple/proxy►│ Apple host allowlist     │
  │ WASM patch (in-page) │   或 /wisp    │ TLS to Apple             │
  │  inject sinf+plist   │               │                          │
  │                      ├──/r2/upload-*►│ R2 multipart upload      │
  │                      │               │                          │
  │ tap install → installd                                          │
  │   GET /m/<id>.plist  ◄──manifest──── │ build OTA plist          │
  │   GET /d/<id>.ipa    ◄──cache─────── │ stream R2 + cf.cacheTtl  │
  └──────────────────────┘               └──────────────────────────┘
                                                    │ R2 (private bucket)
                                                    ▼
                                           ┌──────────────────────┐
                                           │ daily cleanup cron   │
                                           │ keep 3 / bundle_id   │
                                           └──────────────────────┘
```

## 目录

| 路径 | 用途 |
|---|---|
| `ipa-wasm/` | Rust crate (cdylib) → WASM。负责 inspect / sinf 注入 / iTunesMetadata / OTA manifest 生成 |
| `worker/` | Cloudflare Worker — 单一部署单元，含 R2 / KV bindings 和 Wrangler Assets 静态托管 |
| `worker/src/index.ts` | 路由分发 |
| `worker/src/auth.ts` | 登录 / session / rate limit |
| `worker/src/wisp.ts` + `wisp-allowlist.ts` | Wisp v1 TCP 中继（实验性） |
| `worker/src/apple.ts` | Apple HTTPS 代理（默认主路径） |
| `worker/src/r2.ts` | R2 multipart upload / list / delete |
| `worker/src/install.ts` | `/m/`、`/d/`、`/i/` OTA 路由 |
| `worker/src/cleanup.ts` | 定时清理 cron handler |
| `frontend/` | Vue 3 SPA |
| `frontend/utils/auth.js` | 登录态包装 |
| `frontend/utils/appleApi.js` | TS 重写自 `apple_auth.rs` |
| `frontend/utils/credentials.js` | IndexedDB + Web Crypto + 主 PIN |
| `frontend/utils/wisp.js` | Wisp v1 客户端 |
| `frontend/utils/plist.js` | XML plist 编解码 |
| `frontend/utils/r2Upload.js` | 浏览器侧 multipart 上传 |
| `frontend/utils/ipaPipeline.js` | 端到端流程编排 |
| `frontend/utils/wakeLock.js` | iOS 屏幕锁 |
| `frontend/public/wasm/` | wasm-pack 输出（构建产物） |

## 部署（5 分钟）

```bash
# 1. 克隆 + 安装
git clone <repo> && cd ipaTool
npm install
cd worker && npm install && cd ..

# 2. 构建 WASM + 前端
cargo install wasm-pack         # 第一次需要
npm run build:all               # → dist/ + frontend/public/wasm/

# 3. Cloudflare 资源
wrangler r2 bucket create ipatool
wrangler kv:namespace create SESSIONS
wrangler kv:namespace create METADATA
wrangler kv:namespace create RATELIMIT
# 把返回的 id 填到 worker/wrangler.toml 的对应 [[kv_namespaces]] 段

# 4. 设密码（cost=12 bcrypt）
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD_HERE', 12))" \
  | wrangler -c worker/wrangler.toml secret put PASSWORD_BCRYPT

# 5. 改 USERNAME
$EDITOR worker/wrangler.toml

# 6. 部署
cd worker && npx wrangler deploy
# → https://ipatool.<account>.workers.dev
```

## 开发

```bash
# Worker 本地起 (port 8787)
cd worker && npm run dev

# 前端 dev server (port 3000，自动代理到 8787)
cd .. && npm run dev
```

## 测试

```bash
# Rust WASM crate (11 测试)
npm run test:wasm

# Worker (10 测试)
npm run worker:test
```

## 验证

1. **登录**：浏览器 `http://localhost:8787` → 登录 → cookie 设置成功 → `/auth/whoami` 返回 200。
2. **Apple 登录 + 下载 + Patch + 上传**：在"下载"页输入 Apple ID + 密码 → 选择 App → 点开始 → 全流程跑通 → 跳转到装机页。
3. **OTA 安装**：iPhone Safari 开 `<worker>/i/<assetId>` → tap 按钮 → 系统弹"是否安装" → 装机成功。
4. **未登录拒绝**：清 cookie 直接 `POST /r2/upload-init` → 401；`GET /wisp/` → 401。
5. **暴力破解**：连续 5 次错误密码 → 第 6 次 429 + Retry-After。
6. **清理 cron**：`wrangler dev --test-scheduled` → 旧版本 R2 + KV 同步删除。

## 隐私 / 安全

- Apple 凭据加密存在浏览器 IndexedDB（AES-GCM + PBKDF2(主 PIN, 600k iter)）。主 PIN 不入库。
- 默认 `/apple/proxy` 路径让 Worker 终结到 Apple 的 TLS（用户信任自己的 Worker）。
- 实验性 `/wisp/` 路径为完全零信任设计，需要前端集成 libcurl.js + mbedTLS（未默认开启）。
- R2 桶私有；OTA URL 用不可枚举的 UUIDv4 capability。
- 严格 CSP；同源约束；登录限速 5/15min/IP。
- Worker 不持久化用户输入（除 KV session 和 R2 metadata）。
