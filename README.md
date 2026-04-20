# ipaTool v2.0.0

一个面向移动端体验优化的 IPA 下载、归档与安装管理工具。

前端使用 **Vue 3 + Vite + Pinia**，后端使用 **Rust + Actix Web + SQLite**。项目聚焦在以下工作流：

- 搜索 App / 拉取历史版本
- 选择 Apple ID 发起下载
- 观察任务进度与已完成产物
- 收藏特定版本并补充备注
- 导出 IPA 或通过 OTA 安装链接交付
- 在设置页统一管理账号、外观与后台密码

---

## 功能概览

### 首页 / 下载页
- 支持应用搜索
- 支持按版本查看历史构建
- 下载中直接在按钮内显示进度百分比
- 已下载状态按 **应用 + 版本 + 账号** 精确判断
- 支持收藏当前版本并填写备注
- 支持自动安装 / 下载导出链路

### 队列页
- 展示下载中、已完成任务
- 标题区显示当前 IPA 占用空间
- 支持一键清理已完成 IPA
- 可直接下载、安装或删除单个产物

### 收藏页
- 以版本条目维度展示收藏记录
- 支持版本备注展示
- 支持直接发起该版本下载
- 支持取消收藏单个版本

### 设置页
- Apple ID 账号管理
- 外观配置（浅色 / 深色 / 跟随系统、主题色）
- 管理员密码修改
- 退出登录

---

## 项目截图

> 以下截图仅保留项目风格展示，不包含本地登录态、真实账号、密码或数据库内容。

### 首页与搜索
![首页与搜索](docs/screenshots/home-search.jpg)

### 应用详情与版本下载
![应用详情与版本下载](docs/screenshots/app-detail.jpg)

### 收藏 / 队列 / 设置风格
![收藏 / 队列 / 设置风格](docs/screenshots/archive-queue-settings.jpg)

---

## 技术栈

### 前端
- Vue 3
- Vite
- Pinia
- Tailwind CSS
- 自定义移动端组件体系（Dialog / Toast / Select / Confirm / Input 等）

### 后端
- Rust
- Actix Web
- rusqlite（SQLite）
- reqwest
- tokio

---

## 目录结构

```text
ipaTool/
├── src/                    # Vue 前端源码
│   ├── components/         # 页面与移动端基础组件
│   ├── composables/        # 复用逻辑
│   ├── stores/             # Pinia 状态
│   └── utils/              # 工具函数
├── server/                 # Rust 后端
│   ├── src/                # API、鉴权、下载、签名等逻辑
│   └── dist/               # 后端实际提供的前端静态文件目录
├── docs/                   # 保留的项目文档与 README 截图
├── scripts/                # 校验 / 验证脚本
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 快速开始

## 1. 环境要求

- Node.js 18+
- npm 9+（项目也带 `pnpm-lock.yaml`，但当前文档以 npm 为主）
- Rust 1.70+

## 2. 安装依赖

```bash
npm install
```

## 3. 本地开发

### 启动前端开发服务器

```bash
npm run dev
```

### 启动 Rust 后端

```bash
cd server
cargo run --bin server
```

默认访问：

- 前端开发：`http://127.0.0.1:5173`
- 后端服务：`http://127.0.0.1:8080`

---

## 构建与部署

### 前端构建

```bash
cd /root/ipatool
npm run build
```

### 将前端产物同步到 Rust 静态目录

> 后端是从 `server/dist` 提供静态文件的，因此前端变更后需要同步过去。

```bash
cd /root/ipatool
rm -rf server/dist/*
cp -a dist/. server/dist/
```

### 启动后端（生产/本地统一方式）

```bash
cd /root/ipatool/server
cargo run --bin server
```

### 一次性标准发布流程

```bash
cd /root/ipatool
npm install
npm run build
rm -rf server/dist/*
cp -a dist/. server/dist/
cd server
cargo run --bin server
```

---

## Docker 运行

### 使用 docker-compose

```bash
docker-compose up -d
```

停止：

```bash
docker-compose down
```

访问：

```text
http://127.0.0.1:8080
```

---

## 登录与初始化

首次启动时后端会创建默认管理员账号：

- 用户名：`admin`
- 密码：`admin`

> 首次登录后请立即修改后台密码。

登录后再添加 Apple ID 账号，才能进行版本查询、下载与安装相关流程。

---

## 数据与运行时文件

以下目录/文件包含本地运行态数据，不应直接提交到公开仓库：

- `data/`
- `downloads/`
- `artifacts/`
- `server/target/`
- `dist/`
- 含真实账号信息的截图、导出文件、日志

项目当前 `.gitignore` 已忽略大部分本地运行文件，但在推送前仍建议手动复核一次。

---

## 发布到 GitHub 前的隐私检查

建议在 push 前至少执行一次下面的检查：

### 1. 确认没有提交本地数据库和下载产物

```bash
git status --short
```

重点确认不要出现：

- `data/*.db`
- `downloads/*`
- `artifacts/*`
- 临时调试日志
- 含真实账号信息的截图

### 2. 搜索硬编码敏感信息

```bash
rg -n "token|password|cookie|dsid|@icloud|@gmail|@qq|@outlook" .
```

出现结果后要逐项判断：

- 代码逻辑中的字段名可以保留
- 真实值、测试账号、私有域名、私钥、导出 cookie 不应提交

### 3. 检查 README 和截图

确认：

- 没有真实邮箱
- 没有真实密码
- 没有 token / cookie
- 没有本地私有 IP、内网域名、服务器路径
- 没有显示真实下载记录或账号备注

### 4. 检查 Git 历史

如果你之前误提交过敏感文件，仅删除工作区文件还不够，还要处理 Git 历史。

---

## 常用命令

### 前端

```bash
npm run dev
npm run build
npm run lint
npm run format
```

### 版本同步

```bash
./sync-version.sh 2.0.0
```

### 后端

```bash
cd server
cargo run --bin server
cargo build --release
```

---

## 维护建议

- 前端功能改动后，务必重新构建并同步到 `server/dist`
- 后端请始终在 `server/` 目录启动，避免静态资源路径不一致
- OTA 安装链路需要 HTTPS 环境才更接近真实可用状态
- 收藏、下载、已完成文件三类状态要分开理解：它们不是同一个状态源

---

## License

[MIT](LICENSE)
