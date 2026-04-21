<h1 align="center">ipaTool</h1>

<p align="center">
  移动端优先的 IPA 下载、归档与安装管理工具<br>
  Mobile-first IPA download, archive & installation manager
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js" alt="Vue 3">
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT">
</p>

---

## 特点 · Features

- 支持下载已下架应用的所有历史版本
- 支持免费应用的购买
- 完整版本历史，含构建日期与文件大小
- 版本收藏与备注，同一应用可收藏多个版本
- 实时下载进度，完成后支持 OTA 安装或导出 IPA
- 多 Apple ID 管理，支持二步验证与密码保存

## 📸 预览 · Preview

| 首页 Home | 队列 Queue | 收藏 Favorites |
|:---------:|:----------:|:--------------:|
| <img src="docs/screenshots/home-search.jpg" width="220"> | <img src="docs/screenshots/queue-active.jpg" width="220"> | <img src="docs/screenshots/archive-favorites.jpg" width="220"> |

| 设置 Settings | 添加账号 Add Account | 版本选择 Version Select |
|:------------:|:------------------:|:---------------------:|
| <img src="docs/screenshots/settings-appearance.jpg" width="220"> | <img src="docs/screenshots/add-apple-id.jpg" width="220"> | <img src="docs/screenshots/app-detail.jpg" width="220"> |

## 🚀 快速开始 · Quick Start

### 环境要求 · Prerequisites

Node.js 18+ · npm / pnpm · Rust 1.70+

### 本地开发 · Development

```bash
pnpm install
pnpm run dev                        # 前端 → localhost:5173
cd server && cargo run --bin server # 后端 → localhost:8080
```

### 生产构建 · Production

```bash
pnpm run build
rm -rf server/dist && cp -a dist/. server/dist/
cd server && cargo run --bin server
```

### Docker 部署 · Docker

```bash
docker-compose up -d   # → localhost:8080
```

镜像名称 · Image: `ipa-webtool`

> 默认账号 `admin` / `admin`，首次登录后请立即修改密码。

## ⚠️ 注意事项 · Notes

- **OTA 安装需要 HTTPS** — iOS 系统要求安装描述文件和 IPA 下载链路必须通过 HTTPS，自签名证书不被信任。生产部署请配置有效域名与 SSL 证书。
- **App Store 区域自动匹配** — 添加 Apple ID 时系统根据账号信息自动匹配对应区域，无需手动选择。

## 🛠 技术栈 · Tech Stack

| 前端 Frontend | 后端 Backend |
|--------------|-------------|
| Vue 3 | Rust |
| Vite | Actix Web |
| Pinia | rusqlite |
| Tailwind CSS | reqwest · tokio |

## 📁 项目结构 · Project Structure

```
├── src/            # Vue 前端源码
├── server/         # Rust 后端（静态文件由 server/dist/ 提供）
├── docs/           # 文档
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 📄 License

[MIT](LICENSE)
