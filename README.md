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

- 支持下载已下架应用
- 支持免费应用的购买
- 完整版本历史
- 版本收藏与备注
- 支持 OTA 安装或导出 IPA
- 多 Apple ID 管理

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

**方式一：使用 docker-compose**

参照项目中的 [docker-compose.yml](docker-compose.yml) 启动：

```bash
docker-compose up -d   # → localhost:8080
```

**方式二：直接使用镜像**

```bash
docker run -d -p 8080:8080 --name ipatool heard/ipatool
```

> 默认账号 `admin` / `admin`，首次登录后请立即修改密码。

## ⚠️ 注意事项 · Notes

OTA 安装需要 HTTPS，以下为几种常见方案：

| 方案 | 说明 |
|------|------|
| **Nginx + Let's Encrypt** | 用 Certbot 自动申请免费证书，Nginx 反向代理转发到后端 8080 端口，最常用的轻量方案 |
| **Cloudflare Tunnel** | 无需开放公网端口，通过 Cloudflare 隧道暴露服务，自带 HTTPS |

示例 - Nginx 反向代理配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

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
