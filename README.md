# ipaTool

> Private single-user IPA download / sign / OTA install — fully on **Cloudflare Workers + R2**.
> Heavy lifting (sinf 注入、ZIP 重打包、plist 改写) all in the iPhone browser via WebAssembly.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ruanrrn/ipatool-worker)

---

## Quick Start

**一键部署**：点上面按钮 → 授权 fork → Cloudflare 自动创建 R2 桶 + KV + cron → 填 `PASSWORD_BCRYPT` secret → 1–2 分钟完成。

**CLI 部署**：

```bash
git clone https://github.com/ruanrrn/ipatool-worker.git && cd ipatool-worker
pnpm install
npx wrangler login
npx wrangler deploy
```

**首次登录**：

1. 打开 `https://ipatool.<account>.workers.dev`
2. 默认用户名 `owner`（[`wrangler.toml`](./wrangler.toml) `[vars] USERNAME=` 改）
3. 密码通过 `PASSWORD_BCRYPT` secret 注入：

```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"
# 输出粘到 Cloudflare Dashboard → Workers → ipatool → Settings → Variables → Secret
```

---

## Features

- **全链路在 iPhone Safari 完成** — Apple 登录 → 购买 → 下载 → sinf 注入 → OTA 安装
- **WASM 签名** — sinf 注入、iTunesMetadata 改写、ZIP 重打包全部在浏览器端 WebAssembly 完成
- **零服务器成本** — R2 免费额度内运行，三道自动清理策略保持账单 $0
- **隐私优先** — Apple 凭据本地 IndexedDB 加密（AES-GCM + PBKDF2 600k iter），主 PIN 不入库不上传
- **一键部署** — 无需本机 Rust 工具链，WASM 产物已预编译提交

---

## Architecture

```
iPhone Safari (PWA)                    Cloudflare Worker
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

**自动清理**（保持账单 $0）：

- 上传完成后：R2 占用超 70% → 按时间删最旧到 ≤ 70%
- OTA 下载时：同上
- 每日 04:00 北京：删除所有 03:00 之前上传的文件

---

## Local Development

```bash
pnpm install          # postinstall 自动装 worker/ 依赖
npm run worker:dev    # Worker dev server :8787
npm run dev           # 前端 dev server :3000，代理 API 到 8787
```

WASM 改动需要本机 Rust + wasm-pack：

```bash
cargo install wasm-pack
npm run build:wasm    # → frontend/public/wasm/
```

测试：`npm run worker:test`（Worker 18 测试）、`npm run test:wasm`（WASM 11 测试）

---

## Security

- Apple 凭据：IndexedDB + AES-GCM(PBKDF2(主 PIN, 600k iter))，主 PIN 不入库不上传
- OTA URL：128-bit UUID capability URL，公开但不可猜测
- 同源约束：非 GET 检查 Origin header，session cookie `HttpOnly + Secure + SameSite=Lax`
- CSP：`default-src 'self'`，`script-src 'self' 'wasm-unsafe-eval'`，`connect-src` 仅 Apple 域名

---

## Known Limits

- **iPhone IPA ≤ 800 MB**：iOS Safari WASM 堆 ~2 GB，当前 ZIP 重打包有 2× 内存放大；更大文件用桌面浏览器
- **R2 单对象 5 TB / 1 万 part**：1 GB IPA = 128 parts，远未触及上限

---

## License

MIT — see [`LICENSE`](./LICENSE).
