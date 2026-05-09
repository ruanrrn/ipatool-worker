# ipaTool

> Private single-user IPA download / sign / OTA install — fully on **Cloudflare Workers + R2**.
> Heavy lifting (sinf 注入、ZIP 重打包、plist 改写) all in the iPhone browser via WebAssembly.
> Zero GitHub dependency at runtime — no Actions, no Releases, no PAT.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ruanrrn/ipatool)

> 一键部署：点上面按钮 → 授权 GitHub fork 仓库 → Cloudflare 自动创建 R2 桶 + 3 个 KV namespace + 装机域名 → 提示填登录密码 (`PASSWORD_BCRYPT`) → 等 1–2 分钟构建完毕。

---

## 部署后第一次登录

1. 部署完成后 Cloudflare 给你 `https://ipatool.<account>.workers.dev`。
2. 默认用户名 `owner`（在 [`wrangler.toml`](./wrangler.toml) `[vars] USERNAME=` 改）。
3. 密码用 `PASSWORD_BCRYPT` secret 注入（cost ≥ 12 bcrypt 哈希）：

   ```bash
   # 本地一行生成 hash
   npx -y bcryptjs-cli hash 'YOUR_PASSWORD' 12
   # 或者 node 内联
   node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"
   ```

   把输出整段（`$2a$12$...` ~60 字符）粘进 Cloudflare Dashboard → Workers → ipatool → Settings → Variables → Secret，名字 `PASSWORD_BCRYPT`。一键部署界面也会直接提示这个 secret。

4. 浏览器开 `https://ipatool.<account>.workers.dev` → 输入用户名/密码 → 进入设置页设主 PIN（保护本地 IndexedDB 凭据）→ 跳到下载页开始用。

---

## 架构

```
iPhone Safari (PWA)                    Cloudflare Worker (单文件)
  ┌──────────────────────┐               ┌──────────────────────────┐
  │ 主 PIN 解锁 IndexedDB │               │ bcrypt + KV session      │
  │  (Apple ID/密码加密)  ├──/auth/login─►│ 5/15min IP rate limit    │
  │                      │               │                          │
  │ Apple iTunes API     ├──/apple/proxy►│ Apple host allowlist     │
  │   登录 / buyProduct  │               │  (TLS to Apple)          │
  │   downloadProduct    │               │                          │
  │                      │               │                          │
  │ fetch CDN (CORS)     ├═══直连═════════════════════►Apple CDN     │
  │ (IPA 字节不经 Worker)│               │                          │
  │                      │               │                          │
  │ WASM patch (in-page) │               │                          │
  │   sinf inject        │               │                          │
  │   iTunesMetadata     │               │                          │
  │                      │               │                          │
  │ multipart upload     ├──/r2/upload-*►│ R2 multipart upload      │
  │   (8 MB chunks ×4)   │               │   + capacity cleanup     │
  │                      │               │                          │
  │ tap install          │               │                          │
  │ ┌─ installd ───────► /m/<id>.plist   │ → manifest.plist 生成    │
  │ │                  ► /d/<id>.ipa     │ → R2 stream + cf.cacheTtl│
  │ └─ install                            │   + capacity cleanup     │
  └──────────────────────┘               └──────────────────────────┘
                                                    │ R2 (private)
                                                    ▼
                                           ┌──────────────────────┐
                                           │ daily cron 04:00 北京│
                                           │ 清除 03:00 之前所有   │
                                           └──────────────────────┘
```

## 三道清理策略（保持账单 $0）

| 触发点 | 行为 | 实现 |
|---|---|---|
| `/r2/upload-complete` 后 | 总占用 > 70% × 10 GB → 按上传时间删最旧到 ≤ 70% | `ctx.waitUntil(ensureCapacity)` |
| `/d/<id>` OTA 下载触发 | 同上 | `ctx.waitUntil(ensureCapacity)` |
| 每日 04:00 北京 (= 20:00 UTC) | 删除所有 `uploadedAt < 03:00 北京` | `[triggers] crons = ["0 20 * * *"]` |

R2 删除全部走批量 API（`env.R2.delete(string[])`，单调用上限 1000，超过自动分块），KV 元数据并行 `Promise.all` 删除。

---

## 隐私 / 安全

- **Apple 凭据**：本地 IndexedDB 加密 `AES-GCM(PBKDF2(主 PIN, 600k iter))`。主 PIN 不入库、不上传。
- **Worker 信任域**：单用户私有部署 → 默认走 `/apple/proxy`，Worker 终结 Apple TLS（用户信任自己的 Worker）。也保留 `/wisp/` 路由（Wisp v1 TCP 中继）作为零信任升级路径，需前端集成 libcurl.js + mbedTLS WASM。
- **Capability URL**：OTA `/m/<uuid>` `/d/<uuid>` 公开（installd 不带 cookie），但 ID 是 128-bit UUID（猜中概率 2^-128）。
- **同源约束**：所有非 GET 路由检查 `Origin` header；session cookie `HttpOnly + Secure + SameSite=Lax`；登录 5 次/15min/IP rate limit。
- **CSP 严格**：`default-src 'self'`；`script-src 'self' 'wasm-unsafe-eval'`；`connect-src 'self' https://*.itunes.apple.com https://*.phobos.apple.com https://*.apple.com`；其他全 `'none'`。

---

## 本地开发

```bash
git clone https://github.com/ruanrrn/ipatool && cd ipatool

# Node 依赖（postinstall 自动跑 cd worker && npm install）
pnpm install

# 起 Worker dev server (默认端口 8787)
npm run worker:dev

# 另一终端起前端 dev server (端口 3000，自动代理 /auth /wisp /r2 /m /d /i 到 8787)
npm run dev
```

仅前端代码改动 → `npm run build` 几秒出新 dist。
WASM 改动 → 需要本机有 Rust + wasm-pack：

```bash
cargo install wasm-pack    # 一次性
npm run build:wasm         # 重新生成 frontend/public/wasm/*
```

提交 commit 时记得把 `frontend/public/wasm/ipa_wasm_bg.wasm` 一起带上 — 一键部署需要这份预编译产物。

---

## 测试

```bash
# Rust WASM crate (11 测试，含 50 MB IPA roundtrip)
npm run test:wasm

# Worker (18 测试: auth / wisp / install / cleanup / capacity)
npm run worker:test
```

CI 建议在 `.github/workflows/ci.yml` 跑这两条；本仓库未默认开 Actions（保持"零 GitHub 依赖"）。

---

## 目录结构

| 路径 | 用途 |
|---|---|
| **`wrangler.toml`** | 根目录 — 一键部署的 manifest |
| `worker/src/index.ts` | Worker 路由分发 |
| `worker/src/auth.ts` | 登录 / KV session / rate limit |
| `worker/src/wisp.ts` + `wisp-allowlist.ts` | Wisp v1 TCP 中继（实验性，主路径） |
| `worker/src/apple.ts` | Apple HTTPS 代理 + host 白名单 |
| `worker/src/r2.ts` | R2 multipart upload / list / delete |
| `worker/src/install.ts` | `/m/`、`/d/`、`/i/` OTA 路由 |
| `worker/src/cleanup.ts` | `runScheduledCleanup` + `ensureCapacity` |
| `ipa-wasm/src/signature.rs` | sinf 注入 / Manifest.plist / Mach-O 检查 |
| `ipa-wasm/src/ota_install.rs` | 生成 manifest.plist + .mobileconfig |
| `ipa-wasm/src/ipa_utils.rs` | 抽元数据 + 抽 icon |
| `ipa-wasm/src/lib.rs` | wasm-bindgen exports |
| `frontend/utils/auth.js` | 登录态封装 |
| `frontend/utils/appleApi.js` | TS 重写自 `apple_auth.rs` |
| `frontend/utils/credentials.js` | IndexedDB + Web Crypto + 主 PIN |
| `frontend/utils/wisp.js` | Wisp v1 客户端（浏览器侧） |
| `frontend/utils/plist.js` | XML plist 编解码 |
| `frontend/utils/r2Upload.js` | 浏览器 multipart 上传 |
| `frontend/utils/ipaPipeline.js` | 端到端流程编排 |
| `frontend/utils/wakeLock.js` | iOS 屏幕锁（防 30s 后台杀） |
| `frontend/components/Shell.vue` | 主 layout |
| `frontend/components/DownloadShell.vue` | 搜索 + Apple 登录 + 下载流水线 UI |
| `frontend/components/ArchiveShell.vue` | 已签 IPA 列表 + 装机/删除 |
| `frontend/components/SettingsShell.vue` | 主 PIN 管理 + 已存 Apple 账户 |
| `frontend/public/wasm/` | 预编译 WASM 产物（已提交） |
| `frontend/public/manifest.webmanifest` | PWA 配置 |
| `frontend/public/service-worker.js` | PWA 缓存 worker |

---

## 一键部署的工作原理

按 [Deploy to Cloudflare] 后 Cloudflare 会：

1. **fork 仓库**到你的 GitHub 名下。
2. **读 `wrangler.toml`** → 自动新建：
   - 一个 R2 桶 `ipatool`
   - 三个 KV namespace（`SESSIONS` / `METADATA` / `RATELIMIT`）
   - 一个 cron 触发器（`0 20 * * *`）
3. **执行 `[build] command`**：`npm install && cd worker && npm install && cd .. && npm run build`，产出 `dist/`。
4. **提示你填 secrets**：至少 `PASSWORD_BCRYPT`。`INSTALL_TOKEN_SECRET` 可不填（capability UUID 已足够单用户场景）。
5. **`wrangler deploy`** 把所有东西推上去，给你一个 `*.workers.dev` 域名。

整个过程 1–2 分钟，**不需要本机装 Rust** —— `frontend/public/wasm/` 下已 commit 了 wasm-pack 的 release 产物（约 700 KB）。

要重建 WASM 自己改源码：本机 `cargo install wasm-pack && npm run build:wasm`，commit 改动后再 `git push` —— Cloudflare 会自动重 deploy。

---

## 已知边界

- **iPhone WASM 1 GB IPA 极限**：iOS Safari 单 tab JS 堆约 1.5 GB（A14+），WASM 2 GB；当前 `replace_zip_entries` 是 2× 内存放大（input + output 同时驻留），所以建议 IPA ≤ 800 MB。> 1 GB 切到桌面浏览器跑（patch 完通过 R2 直传，再回手机点 install）。
- **Apple Private Relay**：iOS 默认开时 Wisp WS 会经双跳，延迟略增；Apple 协议路径不受影响。
- **TestFlight beta**：Apple 一次性 CDN URL 偶尔绑客户端 IP，本方案 fetch 在用户自己 iPhone 浏览器完成，IP 与 Apple 看到的一致 → 没问题。
- **R2 单对象 5 TB / multipart 1 万 part**：1 GB IPA 用 8 MB/part = 128 parts，富余很大。

---

## License

MIT — see [`LICENSE`](./LICENSE).
