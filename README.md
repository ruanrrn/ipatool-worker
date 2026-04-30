<h1 align="center">ipaTool</h1>

<p align="center">
  移动端优先的 IPA 下载、归档与安装管理工具<br>
  Mobile-first IPA download, archive & installation manager
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js" alt="Vue 3">
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT">
  <a href="https://github.com/ruanrrn/ipaTool/releases"><img src="https://img.shields.io/github/v/release/ruanrrn/ipaTool?label=release" alt="GitHub release"></a>
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

| 设置 Settings | 添加账户 Add Account | 版本选择 Version Select |
|:------------:|:------------------:|:---------------------:|
| <img src="docs/screenshots/settings-appearance.jpg" width="220"> | <img src="docs/screenshots/add-apple-id.jpg" width="220"> | <img src="docs/screenshots/app-detail.jpg" width="220"> |

## 🚀 快速开始 · Quick Start

### 推荐方式：一键安装 · Recommended: One-Click Install

```bash
curl -fsSL https://raw.githubusercontent.com/ruanrrn/ipaTool/main/scripts/install.sh | bash -s -- install
```

该脚本会自动完成以下操作：
- 识别 Linux 系统架构（amd64 / arm64）
- 从 GitHub Releases 下载最新版本
- 安装到 `/opt/ipatool`
- 创建并启动 systemd 服务
- 首次运行时自动生成管理员密码（可通过 `journalctl -u ipatool -f` 查看）

**升级到最新版本：**

```bash
curl -fsSL https://raw.githubusercontent.com/ruanrrn/ipaTool/main/scripts/install.sh | bash -s -- upgrade
```

**重置管理员密码：**

```bash
curl -fsSL https://raw.githubusercontent.com/ruanrrn/ipaTool/main/scripts/install.sh | bash -s -- reset-password
```

> 安装脚本也可手动下载后运行：`bash scripts/install.sh install`。脚本源码位于 [scripts/install.sh](scripts/install.sh)。

---

### 环境要求 · Prerequisites

Node.js 18+ · pnpm · Rust 1.85+

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

参考项目中的 [docker-compose.yml](docker-compose.yml) 启动：

```bash
docker-compose up -d   # → localhost:8080
```

**方式二：直接使用镜像**

```bash
# 使用最新版本
docker run -d -p 8080:8080 --name ipatool heard/ipatool:latest

# 使用指定版本
docker run -d -p 8080:8080 --name ipatool heard/ipatool:2.2.1
```

### 管理员账户与密码 · Admin Password

默认管理员账户是 `admin`。首次初始化时不再使用固定默认密码：

- 推荐：启动前设置 `IPA_ADMIN_INITIAL_PASSWORD`，首次初始化将使用该值作为初始密码。
- 未设置时：系统会生成一次性随机密码，并输出到后端日志 / stderr。

**Docker 获取初始密码**

推荐显式指定初始密码：

```bash
docker run -d \
  -p 8080:8080 \
  -e IPA_ADMIN_INITIAL_PASSWORD='***' \
  --name ipatool \
  heard/ipatool:2.2.1
```

如果未指定，查看首次启动日志：

```bash
docker logs ipatool 2>&1 | grep 'Generated one-time admin password'
```

**源码运行获取初始密码**

推荐显式指定初始密码：

```bash
cd server
IPA_ADMIN_INITIAL_PASSWORD='***' cargo run --bin server
```

如果未指定，查看运行终端输出或日志文件中的：

```text
[SECURITY] Generated one-time admin password for first run: ...
```

> 初始密码仅在数据库首次创建且 `admin_users` 为空时生成 / 输出。若日志丢失，无法从数据库 hash 反推密码，请使用下面的手动重置方案。

**手动重置管理员密码**

该命令为离线管理命令，不需要登录；默认只重置 `admin` 的密码，不改用户名。重置后该账户现有登录会话将失效。

使用一键安装脚本（推荐）：

```bash
curl -fsSL https://raw.githubusercontent.com/ruanrrn/ipaTool/main/scripts/install.sh | bash -s -- reset-password
```

Docker：

```bash
docker exec -i ipatool ./server reset-admin-password --username admin --password-stdin <<'EOF'
new-secure-password
EOF
```

源码运行：

```bash
cd server
printf '%s' 'new-secure-password' | cargo run --bin server -- reset-admin-password --username admin --password-stdin
```

如果数据库不在默认位置，可显式指定：

```bash
DATABASE_PATH=/path/to/ipa-webtool.db cargo run --bin server -- reset-admin-password --username admin --password-stdin
```

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
| Vue 3 + Vite 6 | Rust |
| Pinia | Actix Web |
| Tailwind CSS（纯 Tailwind，已移除 Element Plus） | rusqlite |
| | reqwest · tokio · OpenSSL（vendored） |

## 📁 项目结构 · Project Structure

```
├── frontend/            # Vue 3 前端（源码 + 构建配置）
│   ├── index.html       # Vite 入口 HTML
│   ├── vite.config.js   # Vite 构建配置
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── .prettierrc
│   ├── main.js          # 应用入口
│   ├── App.vue          # 根组件
│   ├── components/      # 组件
│   ├── composables/     # 组合式函数
│   ├── stores/          # Pinia 状态管理
│   └── utils/           # 工具函数
├── server/              # Rust 后端 (Actix Web)
│   ├── src/             # 后端源码
│   ├── Cargo.toml
│   └── rustfmt.toml
├── scripts/             # 构建和运维脚本
│   ├── install.sh       # 一键安装/升级/重置密码
│   ├── verify-build.sh
│   ├── sync-version.sh
│   └── check-no-hardcoded-colors.sh
├── docs/                # 文档和截图
│   ├── screenshots/
│   └── learnings/
├── .github/workflows/   # CI/CD (ci, docker, release)
├── Dockerfile
├── docker-compose.yml
├── .npmrc               # pnpm 配置
├── package.json         # 项目脚本 (dev/build/lint/format)
├── pnpm-lock.yaml
└── README.md
```

## 📄 License

[MIT](LICENSE)
