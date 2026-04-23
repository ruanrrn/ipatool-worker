# Community Archive v1 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将现有 community archive 代码对齐 v1 规范，支持从官方 CDN 读取下架归档、本地发现下架候选、一键贡献 PR 到 `ruanrrn/ipa-archive`。

**Architecture:** 后端 actix-web 代理 CDN 读取 + GitHub Contents API 提交 PR；前端 ArchiveApp.vue 的"已下架"tab 分两个 section（社区归档 / 本地待贡献）。核心变化是引入新的 community schema struct 与本地 ArchiveApp 解耦。

**Tech Stack:** Rust (actix-web, reqwest, serde), Vue 3 (Pinia, Tailwind), GitHub Contents API

**现状评估：** 代码约 70% 已实现（结构体、路由、前端 UI、PR 流程），核心工作量在 schema 对齐 + publish 精简 + icon 上传逻辑。

---

## Delta 分析（现有 vs 新规范）

| 模块 | 现有 | 新规范 | 改动 |
|------|------|--------|------|
| `CommunityDelistedLiteItem` | `last_seen_version`, 缺 `artist_name` | `latest_version`, 有 `artist_name` | 改字段 |
| `CommunityDelistedLiteIndex` | 包装对象 `{ apps: [...] }` | 纯数组 `[...]`，兼容包装 | 解析兼容 |
| `ArchiveVersion` | 只有 `version_id/version/description` | 新增 `released_at`, `size_bytes` | 加字段 |
| 本地收藏 `ArchiveApp` | 有 `icon_bak_url/icon_base64/icon_content_type/added_by` | 不变（本地继续用） | 无改动 |
| 社区发布 schema | 复用 `ArchiveApp` | 新 struct `CommunityDelistedAppDetail` | 新建 |
| `CommunityPublishRequest` | `owner/repo/branch/path/create_pr` | 精简为 `app_id/notes`，硬编码官方仓库 | 改 |
| `PrepareContributionRequest` | 有 `owner/repo` | 去掉 | 改 |
| icon 处理 | base64 内联 `icon_bak_url` | 仓库存图 `assets/icons/{前两位}/{id}.png` | 重写 |
| 本地候选 | 无 `size_bytes` | 需 `size_bytes` | 加字段 |

---

## Phase 0: 官方仓库初始化

### Task 0.1: 初始化 ruanrrn/ipa-archive 仓库结构

**Objective:** 创建官方仓库并初始化目录和索引文件

**手动操作（GitHub CLI 或网页）：**

```bash
# 1. 创建仓库（如果不存在）
gh repo create ruanrrn/ipa-archive --public --description "Community archive for delisted iOS apps"

# 2. clone 并初始化
git clone git@github.com:ruanrrn/ipa-archive.git
cd ipa-archive

# 3. 创建目录结构
mkdir -p apps/delisted
mkdir -p indexes
mkdir -p assets/icons

# 4. 创建空索引
cat > indexes/delisted-lite.json << 'EOF'
[]
EOF

# 5. 创建 README
cat > README.md << 'EOF'
# ipa-archive

Community archive for delisted iOS applications.

## Structure

- `apps/delisted/{id}.json` — Individual app details
- `indexes/delisted-lite.json` — Index for list views
- `assets/icons/{id_prefix}/{id}.png` — App icons

## Contributing

Contributions are welcome via PR. Use [ipaTool](https://github.com/ruanrrn/ipatool) to prepare and submit contributions.
EOF

# 6. 提交
git add -A
git commit -m "init: repository structure"
git push origin main
```

**验证：**
```bash
curl -s https://raw.githubusercontent.com/ruanrrn/ipa-archive/main/indexes/delisted-lite.json
# Expected: []
```

---

## Phase 1: 后端 — 新社区 schema 结构体

### Task 1.1: 新建 CommunityDelistedAppDetail 结构体

**Objective:** 定义社区详情 JSON 的标准 schema，与本地 ArchiveApp 解耦

**Files:**
- Modify: `server/src/main.rs` (在 `CommunityDelistedLiteItem` 附近插入)

**Step 1: 在 `CommunityDelistedLiteIndex` struct 后插入新结构体**

```rust
// ---- Community Archive Schema (v1) ----
// 用于官方仓库 apps/delisted/{id}.json 的标准格式

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityDelistedAppDetail {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundle_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artist_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_asset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub delisted: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<String>,
    pub versions: Vec<CommunityVersion>,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityVersion {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub version_id: String,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub released_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}
```

**Step 2: 添加转换函数 ArchiveApp → CommunityDelistedAppDetail**

```rust
impl CommunityDelistedAppDetail {
    /// 从本地 ArchiveApp + 补充信息构造社区标准格式
    pub fn from_local_archive(
        app: &ArchiveApp,
        artist_name: Option<String>,
        icon_asset: Option<String>,
        notes: Vec<String>,
    ) -> Self {
        let now = Utc::now().to_rfc3339();
        CommunityDelistedAppDetail {
            id: app.id.clone(),
            name: app.name.clone(),
            bundle_id: app.bundle_id.clone(),
            artist_name: artist_name.or_else(|| app.added_by.clone().filter(|s| !s.is_empty() && s != "user")),
            icon_asset,
            icon_url: None, // 社区归档不保留外部 icon_url
            delisted: true,
            notes,
            versions: app.versions.iter().map(|v| CommunityVersion {
                version_id: v.version_id.clone(),
                version: v.version.clone(),
                released_at: None, // 本地记录通常没有
                size_bytes: None,  // 由 prepare-contribution 从 IPA 补全
                description: v.description.clone(),
            }).collect(),
            updated_at: now,
        }
    }
}
```

**Step 3: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -20
```

Expected: 无新错误

**Step 4: Commit**

```bash
git add server/src/main.rs
git commit -m "feat(community): add CommunityDelistedAppDetail schema structs"
```

---

### Task 1.2: 更新 CommunityDelistedLiteItem 字段

**Objective:** 对齐新 lite 索引规范

**Files:**
- Modify: `server/src/main.rs` (L4958-4972)

**Step 1: 修改 CommunityDelistedLiteItem struct**

```rust
#[derive(Serialize, Deserialize, Clone, Default)]
struct CommunityDelistedLiteItem {
    id: String,
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    bundle_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artist_name: Option<String>,  // 新增
    #[serde(default, skip_serializing_if = "Option::is_none")]
    icon_asset: Option<String>,  // 保留（新规范用这个）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    icon_url: Option<String>,  // 保留兼容旧索引
    #[serde(default, skip_serializing_if = "Option::is_none")]
    latest_version: Option<String>,  // 重命名: last_seen_version → latest_version
    #[serde(alias = "last_seen_version")]  // 兼容旧格式读取
    #[serde(default, skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}
```

注意：`latest_version` 字段加 `#[serde(alias = "last_seen_version")]` 确保旧格式也能解析。

**Step 2: 更新 CommunityDelistedLiteIndex 支持纯数组格式**

```rust
#[derive(Serialize, Deserialize, Clone, Default)]
struct CommunityDelistedLiteIndex {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    generated_at: Option<String>,
    #[serde(default)]
    schema_version: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    #[serde(default)]
    count: usize,
    #[serde(default)]
    apps: Vec<CommunityDelistedLiteItem>,
}

// 新增: 尝试从 Value 解析，兼容纯数组和包装对象
fn parse_delisted_lite_index(data: Value) -> CommunityDelistedLiteIndex {
    // 1. 尝试纯数组
    if let Some(arr) = data.as_array() {
        let apps: Vec<CommunityDelistedLiteItem> = arr.iter()
            .filter_map(|item| serde_json::from_value::<CommunityDelistedLiteItem>(item.clone()).ok())
            .collect();
        return CommunityDelistedLiteIndex {
            schema_version: 1,
            source: Some("flat-array".to_string()),
            count: apps.len(),
            apps,
            ..Default::default()
        };
    }
    // 2. 尝试包装对象 { apps: [...] }
    if let Some(obj) = data.as_object() {
        if let Some(apps_arr) = obj.get("apps").and_then(|v| v.as_array()) {
            let apps: Vec<CommunityDelistedLiteItem> = apps_arr.iter()
                .filter_map(|item| serde_json::from_value::<CommunityDelistedLiteItem>(item.clone()).ok())
                .collect();
            return CommunityDelistedLiteIndex {
                generated_at: obj.get("generated_at").and_then(|v| v.as_str()).map(String::from),
                schema_version: obj.get("schema_version").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                source: obj.get("source").and_then(|v| v.as_str()).map(String::from),
                count: apps.len().max(obj.get("count").and_then(|v| v.as_i64()).unwrap_or(0) as usize),
                apps,
            };
        }
    }
    CommunityDelistedLiteIndex::default()
}
```

**Step 3: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add server/src/main.rs
git commit -m "feat(community): update CommunityDelistedLiteItem with artist_name + latest_version"
```

---

### Task 1.3: 更新 ArchiveVersion 和 LocalDelistedCandidate 加字段

**Objective:** 本地版本记录支持 `size_bytes`/`released_at`，候选列表也携带

**Files:**
- Modify: `server/src/main.rs`

**Step 1: 更新 ArchiveVersion struct（本地收藏继续用，加新字段用 serde default）**

```rust
#[derive(Serialize, Deserialize, Clone)]
struct ArchiveVersion {
    version_id: String,
    version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    released_at: Option<String>,   // 新增
    #[serde(default, skip_serializing_if = "Option::is_none")]
    size_bytes: Option<i64>,       // 新增
}
```

**Step 2: 更新 LocalDelistedCandidate struct**

```rust
#[derive(Serialize, Clone)]
struct LocalDelistedCandidate {
    id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bundle_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    artist_name: Option<String>,
    versions: Vec<ArchiveVersion>,  // 已有新字段
    #[serde(skip_serializing_if = "Option::is_none")]
    last_download_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_record_count: Option<usize>,
    #[serde(default)]
    already_archived_locally: bool,
}
```

**Step 3: 更新 build_local_delisted_candidates 填充 size_bytes**

在 `build_local_delisted_candidates` 函数中，构建 ArchiveVersion 时补充 `size_bytes`：

```rust
entry.versions.push(ArchiveVersion {
    version_id,
    version: version_label,
    description: Some("由本地下载记录聚合".to_string()),
    released_at: None,
    size_bytes: record.file_size.and_then(|s| s.parse::<i64>().ok()),
});
```

**Step 4: 更新 add_archive_app 中版本合并逻辑**

在 `add_archive_app` (L5734) 的版本合并处，也保留 `size_bytes` 和 `released_at`：

```rust
if let Some(existing_version) = app
    .versions
    .iter_mut()
    .find(|existing| existing.version_id == version.version_id)
{
    existing_version.version = if version.version.trim().is_empty() {
        existing_version.version.clone()
    } else {
        version.version.clone()
    };
    existing_version.description = version.description.clone();
    // 新增: 合并新字段
    if version.released_at.is_some() {
        existing_version.released_at = version.released_at.clone();
    }
    if version.size_bytes.is_some() {
        existing_version.size_bytes = version.size_bytes;
    }
} else {
    app.versions.push(version.clone());
}
```

**Step 5: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add server/src/main.rs
git commit -m "feat(community): add size_bytes/released_at to ArchiveVersion + candidates"
```

---

## Phase 2: 后端 — 索引读取对齐

### Task 2.1: 重构 fetch_community_delisted_index 使用新解析器

**Objective:** 用 parse_delisted_lite_index 替代内联解析逻辑

**Files:**
- Modify: `server/src/main.rs` (L5074-5118)

**Step 1: 替换 fetch_community_delisted_index 函数体**

```rust
async fn fetch_community_delisted_index() -> CommunityDelistedLiteIndex {
    let client = Client::new();
    let candidates = [
        format!("{}/indexes/delisted-lite.json", community_archive_base_url()),
        format!("{}/delisted.json", community_archive_base_url()),
    ];

    for url in candidates {
        if let Ok(resp) = client.get(&url).send().await {
            if !resp.status().is_success() {
                continue;
            }
            if let Ok(data) = resp.json::<Value>().await {
                let index = parse_delisted_lite_index(data);
                if !index.apps.is_empty() {
                    return index;
                }
            }
        }
    }

    CommunityDelistedLiteIndex::default()
}
```

**Step 2: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add server/src/main.rs
git commit -m "refactor(community): use parse_delisted_lite_index for flexible format support"
```

---

### Task 2.2: 更新 fetch_community_delisted_app 解析新 schema

**Objective:** 社区详情用 CommunityDelistedAppDetail 解析

**Files:**
- Modify: `server/src/main.rs` (L5120-5128)

**Step 1: 新增 fetch_community_delisted_app_detail 函数**

```rust
async fn fetch_community_delisted_app_detail(app_id: &str) -> Option<CommunityDelistedAppDetail> {
    let client = Client::new();
    let url = format!("{}/{}", community_archive_base_url(), community_archive_app_path(app_id));
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json::<CommunityDelistedAppDetail>().await.ok()
}
```

**Step 2: 保留旧函数做兼容 fallback**

```rust
async fn fetch_community_delisted_app(app_id: &str) -> Option<ArchiveApp> {
    let client = Client::new();
    let url = format!("{}/{}", community_archive_base_url(), community_archive_app_path(app_id));
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json::<ArchiveApp>().await.ok()
}
```

旧函数保留，因为前端部分逻辑（如 `prepareCommunityApp`）仍依赖 ArchiveApp 格式。

**Step 3: Commit**

```bash
git add server/src/main.rs
git commit -m "feat(community): add fetch_community_delisted_app_detail for v1 schema"
```

---

## Phase 3: 后端 — 精简贡献流

### Task 3.1: 精简 PrepareContributionRequest/Response

**Objective:** 去掉 owner/repo，硬编码官方仓库

**Files:**
- Modify: `server/src/main.rs`

**Step 1: 精简 PrepareContributionRequest**

```rust
#[derive(Deserialize)]
struct PrepareContributionRequest {
    app_id: String,
    // notes 可选，用户可在此提供备注
    #[serde(default)]
    notes: Vec<String>,
}
```

**Step 2: 精简 PrepareContributionResponse**

```rust
#[derive(Serialize)]
struct PrepareContributionResponse {
    app_id: String,
    source: String,              // "local-archive" | "download-records"
    github_token_configured: bool,
    app: CommunityDelistedAppDetail,  // 用新 schema
    icon_path: Option<String>,   // 仓库存图路径
    warnings: Vec<String>,
}
```

**Step 3: 重写 prepare_community_contribution handler**

```rust
async fn prepare_community_contribution(
    admin: AuthenticatedAdmin,
    body: web::Json<PrepareContributionRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    let app_id = body.app_id.trim().to_string();
    if app_id.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("app_id 不能为空".to_string()));
    }

    // 1. 从本地 archive 或 download records 加载
    let (local_app, artist_name, source) = {
        let local_path = archive_file_path(&app_id);
        if let Ok(Some(archived)) = load_archive_app_from_path(&local_path) {
            let artist = archived.added_by.clone().filter(|s| !s.is_empty() && s != "user");
            (archived, artist, "local-archive".to_string())
        } else {
            let records = {
                let db = data.db.lock().unwrap();
                normalize_download_record_artifact_paths(&db, &data.downloads_dir);
                sync_download_records_from_filesystem(&db, &data.downloads_dir);
                db.get_all_download_records().unwrap_or_default()
            };
            let candidates = build_local_delisted_candidates(records);
            match candidates.iter().find(|c| c.id == app_id) {
                Some(candidate) => (
                    to_archive_app_from_candidate(candidate),
                    candidate.artist_name.clone(),
                    "download-records".to_string(),
                ),
                None => {
                    return HttpResponse::NotFound().json(ApiResponse::<()>::error(
                        "本地归档与待贡献列表中都未找到该应用".to_string(),
                    ))
                }
            }
        }
    };

    // 2. 尝试从本地下载文件补全 icon（生成 icon_asset 路径）
    let icon_asset = try_get_icon_from_local_downloads(&app_id, &data.downloads_dir)
        .map(|_| format!("assets/icons/{}/{}.png", &app_id[..app_id.len().min(2)], app_id));

    // 3. 构建 community schema
    let community_app = CommunityDelistedAppDetail::from_local_archive(
        &local_app,
        artist_name,
        icon_asset.clone(),
        body.notes.clone(),
    );

    // 4. 检查 GitHub PAT
    let github_token_configured = data
        .db
        .lock()
        .unwrap()
        .get_github_token(&admin.username)
        .ok()
        .flatten()
        .is_some();

    // 5. 生成 warnings
    let mut warnings = Vec::new();
    if community_app.bundle_id.is_none() {
        warnings.push("缺少 bundle_id，建议手动补充".to_string());
    }
    if community_app.artist_name.is_none() {
        warnings.push("缺少开发者名称".to_string());
    }
    if community_app.versions.iter().all(|v| v.size_bytes.is_none()) {
        warnings.push("版本信息中无文件大小，建议从 IPA 补全".to_string());
    }
    if icon_asset.is_none() && local_app.icon_url.is_none() {
        warnings.push("无可用图标".to_string());
    }

    HttpResponse::Ok().json(ApiResponse::success(PrepareContributionResponse {
        app_id,
        source,
        github_token_configured,
        app: community_app,
        icon_path: icon_asset,
        warnings,
    }))
}
```

**Step 4: 添加 try_get_icon_from_local_downloads 辅助函数**

```rust
/// 尝试从本地下载目录中提取 icon
fn try_get_icon_from_local_downloads(app_id: &str, downloads_dir: &Path) -> Option<Vec<u8>> {
    use zip::read::ZipArchive;
    use std::io::Read;

    // 在 downloads/ 目录下搜索包含 app_id 的 IPA
    let Some(entries) = std::fs::read_dir(downloads_dir).ok() else {
        return None;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("ipa") {
            continue;
        }
        if let Ok(file) = std::fs::File::open(&path) {
            if let Ok(mut archive) = ZipArchive::new(file) {
                // 尝试读取 Info.plist 获取 bundle_id 匹配
                // 或者尝试 AppIcon60x60@2x.png
                for name in archive.file_names() {
                    if name.contains("AppIcon") && name.ends_with(".png") {
                        if let Ok(mut icon_file) = archive.by_name(name) {
                            let mut bytes = Vec::new();
                            if icon_file.read_to_end(&mut bytes).is_ok() && !bytes.is_empty() {
                                return Some(bytes);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}
```

**Step 5: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add server/src/main.rs
git commit -m "refactor(community): simplify prepare-contribution with v1 schema"
```

---

### Task 3.2: 精简 CommunityPublishRequest + 重写 publish handler

**Objective:** 简化发布请求，hardcode ruanrrn/ipa-archive，支持 icon 上传 + JSON 提交

**Files:**
- Modify: `server/src/main.rs`

**Step 1: 精简 CommunityPublishRequest**

```rust
#[derive(Deserialize)]
struct CommunityPublishRequest {
    app_id: String,
    #[serde(default)]
    notes: Vec<String>,
    #[serde(default)]
    icon_data_base64: Option<String>,  // icon 的 base64 数据，由前端从 IPA 或 URL 获取
}
```

**Step 2: 新增 CommunityPublishResponse（精简版）**

```rust
#[derive(Serialize)]
struct CommunityPublishResponse {
    app_id: String,
    commit_sha: Option<String>,
    pr_url: Option<String>,
    pr_number: Option<i64>,
    files_committed: Vec<String>,  // 已提交的文件路径列表
}
```

**Step 3: 新增 icon 上传到 GitHub 的辅助函数**

```rust
/// 上传单个文件到 GitHub 仓库指定分支
async fn github_upload_file(
    client: &Client,
    token: &str,
    owner: &str,
    repo: &str,
    branch: &str,
    file_path: &str,
    content_base64: &str,
    commit_message: &str,
    existing_sha: Option<&str>,
) -> Result<Value, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        owner, repo, urlencoding::encode(file_path)
    );
    let mut body = serde_json::json!({
        "message": commit_message,
        "content": content_base64,
        "branch": branch,
    });
    if let Some(sha) = existing_sha {
        body["sha"] = serde_json::json!(sha);
    }

    let resp = client
        .put(&url)
        .bearer_auth(token)
        .header(reqwest::header::USER_AGENT, "ipatool-community-publisher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("上传文件失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("上传文件失败: HTTP {} {}", status, text));
    }

    resp.json::<Value>().await.map_err(|e| format!("解析响应失败: {}", e))
}

/// 获取 GitHub 仓库中指定文件的 SHA（如果存在）
async fn github_get_file_sha(
    client: &Client,
    token: &str,
    owner: &str,
    repo: &str,
    file_path: &str,
    branch: &str,
) -> Option<String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        owner, repo, urlencoding::encode(file_path)
    );
    let resp = client
        .get(&url)
        .bearer_auth(token)
        .header(reqwest::header::USER_AGENT, "ipatool-community-publisher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .query(&[("ref", branch)])
        .send()
        .await
        .ok()?;

    if resp.status().as_u16() == 404 {
        return None;
    }
    if !resp.status().is_success() {
        return None;
    }
    resp.json::<Value>().await.ok()
        .and_then(|v| v.get("sha").and_then(|s| s.as_str()).map(String::from))
}
```

**Step 4: 重写 publish_community_archive handler**

```rust
async fn publish_community_archive(
    admin: AuthenticatedAdmin,
    body: web::Json<CommunityPublishRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    let app_id = body.app_id.trim().to_string();
    if app_id.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("app_id 不能为空".to_string()));
    }

    // 硬编码官方仓库
    let owner = "ruanrrn";
    let repo = "ipa-archive";

    // 获取 GitHub PAT
    let github_token = match data.db.lock().unwrap().get_github_token(&admin.username) {
        Ok(Some(token)) => token.token,
        Ok(None) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error("请先在设置页配置 GitHub PAT".to_string()))
        }
        Err(error) => {
            return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(format!(
                "读取 GitHub Token 失败: {}", error
            )))
        }
    };

    // 加载本地 app 数据
    let local_path = archive_file_path(&app_id);
    let (local_app, artist_name) = match load_archive_app_from_path(&local_path) {
        Ok(Some(app)) => {
            let artist = app.added_by.clone().filter(|s| !s.is_empty() && s != "user");
            (app, artist)
        }
        _ => {
            // 从 download records 尝试
            let records = {
                let db = data.db.lock().unwrap();
                normalize_download_record_artifact_paths(&db, &data.downloads_dir);
                sync_download_records_from_filesystem(&db, &data.downloads_dir);
                db.get_all_download_records().unwrap_or_default()
            };
            let candidates = build_local_delisted_candidates(records);
            match candidates.iter().find(|c| c.id == app_id) {
                Some(c) => {
                    let app = to_archive_app_from_candidate(c);
                    (app, c.artist_name.clone())
                }
                None => {
                    return HttpResponse::NotFound().json(ApiResponse::<()>::error(
                        "未找到该应用的本地数据".to_string(),
                    ))
                }
            }
        }
    };

    // 构建社区格式 JSON
    let icon_asset = body.icon_data_base64.as_ref()
        .map(|_| format!("assets/icons/{}/{}.png", &app_id[..app_id.len().min(2)], app_id));
    let community_json = CommunityDelistedAppDetail::from_local_archive(
        &local_app, artist_name, icon_asset.clone(), body.notes.clone(),
    );
    let app_json_str = serde_json::to_string_pretty(&community_json)
        .map_err(|e| HttpResponse::InternalServerError().json(ApiResponse::<()>::error(format!("序列化失败: {}", e))))
        .unwrap();

    let client = Client::new();
    let default_branch = "main";
    let timestamp = Utc::now().format("%Y%m%d%H%M%S");
    let feature_branch = format!("contribute/{}-{}", app_id, timestamp);

    // Step 1: 获取 main 分支 SHA
    let ref_url = format!(
        "https://api.github.com/repos/{}/{}/git/ref/heads/{}",
        owner, repo, default_branch
    );
    let base_sha = match client
        .get(&ref_url)
        .bearer_auth(&github_token)
        .header(reqwest::header::USER_AGENT, "ipatool-community-publisher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send().await
    {
        Ok(r) if r.status().is_success() => r.json::<Value>().await.ok()
            .and_then(|p| p.get("object").and_then(|o| o.get("sha")).and_then(|v| v.as_str()).map(String::from)),
        _ => None,
    };
    let Some(sha) = base_sha else {
        return HttpResponse::BadGateway().json(ApiResponse::<()>::error(
            "无法获取仓库默认分支信息，请检查 PAT 权限".to_string(),
        ));
    };

    // Step 2: 创建 feature branch
    let create_ref_url = format!("https://api.github.com/repos/{}/{}/git/refs", owner, repo);
    let create_resp = client
        .post(&create_ref_url)
        .bearer_auth(&github_token)
        .header(reqwest::header::USER_AGENT, "ipatool-community-publisher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .json(&serde_json::json!({
            "ref": format!("refs/heads/{}", feature_branch),
            "sha": sha,
        }))
        .send().await;

    match create_resp {
        Ok(r) if r.status().is_success() => {},
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            return HttpResponse::BadGateway().json(ApiResponse::<()>::error(format!(
                "创建分支失败: HTTP {} {}", status, text
            )));
        }
        Err(e) => {
            return HttpResponse::BadGateway().json(ApiResponse::<()>::error(
                format!("创建分支失败: {}", e)
            ));
        }
    }

    // Step 3: 提交 app JSON
    let app_json_path = community_archive_app_path(&app_id); // "apps/delisted/{id}.json"
    let commit_msg = format!("Add delisted app {} ({})", community_json.name, app_id);
    let json_base64 = base64::engine::general_purpose::STANDARD.encode(app_json_str.as_bytes());
    let mut files_committed = Vec::new();

    match github_upload_file(
        &client, &github_token, owner, repo, &feature_branch,
        &app_json_path, &json_base64, &commit_msg, None,
    ).await {
        Ok(_) => files_committed.push(app_json_path.clone()),
        Err(e) => {
            return HttpResponse::BadGateway().json(ApiResponse::<()>::error(
                format!("提交应用 JSON 失败: {}", e)
            ));
        }
    }

    // Step 4: 提交 icon（如果有）
    if let Some(ref icon_b64) = body.icon_data_base64 {
        let icon_path = format!("assets/icons/{}/{}.png", &app_id[..app_id.len().min(2)], app_id);
        match github_upload_file(
            &client, &github_token, owner, repo, &feature_branch,
            &icon_path, icon_b64, &commit_msg, None,
        ).await {
            Ok(_) => files_committed.push(icon_path),
            Err(e) => {
                log::warn!("上传 icon 失败（继续提交 PR）: {}", e);
                // icon 失败不阻塞 PR
            }
        }
    }

    // Step 5: 创建 PR
    let pr_api = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);
    let pr_title = format!("Add delisted app: {} ({})", community_json.name, app_id);
    let pr_body = format!(
        "## Summary\n\n- **App:** {} ({})\n- **Bundle ID:** {}\n- **Versions:** {}\n- **Files:** {}\n\n## Notes\n\n{}",
        community_json.name,
        app_id,
        community_json.bundle_id.as_deref().unwrap_or("unknown"),
        community_json.versions.len(),
        files_committed.join(", "),
        body.notes.join("\n- "),
    );

    let (pr_url, pr_number) = match client
        .post(&pr_api)
        .bearer_auth(&github_token)
        .header(reqwest::header::USER_AGENT, "ipatool-community-publisher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .json(&serde_json::json!({
            "title": pr_title,
            "body": pr_body,
            "head": feature_branch,
            "base": default_branch,
        }))
        .send().await
    {
        Ok(r) if r.status().is_success() => match r.json::<Value>().await {
            Ok(pr_data) => (
                pr_data.get("html_url").and_then(|v| v.as_str()).map(String::from),
                pr_data.get("number").and_then(|v| v.as_i64()),
            ),
            Err(_) => (None, None),
        },
        Ok(r) => {
            log::warn!("PR 创建失败: HTTP {}", r.status());
            (None, None)
        }
        Err(e) => {
            log::warn!("PR 创建失败: {}", e);
            (None, None)
        }
    };

    HttpResponse::Ok().json(ApiResponse::success(CommunityPublishResponse {
        app_id,
        commit_sha: Some(sha),
        pr_url,
        pr_number,
        files_committed,
    }))
}
```

**Step 5: 验证编译**

```bash
cd /root/ipatool/server && cargo check 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add server/src/main.rs
git commit -m "feat(community): simplified publish with icon upload + PR to official repo"
```

---

## Phase 4: 前端对齐

### Task 4.1: 更新 ArchiveApp.vue 归一化逻辑

**Objective:** 前端 normalize 函数支持新字段

**Files:**
- Modify: `src/components/ArchiveApp.vue`

**Step 1: 更新 normalizeArchiveApp 支持新字段**

```javascript
const normalizeArchiveApp = (app, delisted = false) => {
  const normalized = {
    id: String(app?.id ?? app?.app_id ?? app?.trackId ?? ''),
    name: app?.name ?? app?.app_name ?? app?.trackName ?? '未知应用',
    icon_url: app?.icon_url ?? app?.artworkUrl ?? app?.artworkUrl100 ?? app?.artworkUrl60 ?? '',
    icon_asset: app?.icon_asset ?? '',                    // 新增
    bundle_id: app?.bundle_id ?? app?.bundleId ?? '',
    artist_name: app?.artist_name ?? app?.artistName ?? '',
    versions: Array.isArray(app?.versions)
      ? app.versions.map(normalizeVersion).filter(Boolean)
      : [],
    latest_version: app?.latest_version ?? '',             // 新增 (lite index)
    delisted: app?.delisted ?? delisted,
    added_at: app?.added_at ?? app?.updated_at ?? app?.created_at ?? '',
    added_by: app?.added_by ?? '',
    notes: Array.isArray(app?.notes) ? app.notes : [],     // 新增
    note: app?.note || ''
  }
  normalized.archive_key = getArchiveKey(normalized)
  return normalized
}
```

**Step 2: 更新 normalizeVersion 支持 size_bytes**

```javascript
const normalizeVersion = (version) => {
  const versionId = String(
    version?.version_id
    ?? version?.appVersionId
    ?? version?.external_identifier
    ?? version?.id
    ?? ''
  )
  const label = String(
    version?.version
    ?? version?.bundle_version
    ?? version?.name
    ?? versionId
  )
  if (!versionId && !label) return null
  return {
    version_id: versionId,
    version: label,
    description: version?.description || '',
    size_bytes: version?.size_bytes ?? null,               // 新增
    released_at: version?.released_at ?? null,              // 新增
  }
}
```

**Step 3: Commit**

```bash
git add src/components/ArchiveApp.vue
git commit -m "feat(community): update frontend normalize for v1 schema fields"
```

---

### Task 4.2: 精简发布对话框

**Objective:** 去掉 owner/repo 输入，hardcode 官方仓库

**Files:**
- Modify: `src/components/ArchiveApp.vue`

**Step 1: 精简 publishDialog reactive 状态**

```javascript
const publishDialog = reactive({
  visible: false,
  appId: '',
  appName: '',
  notes: '',          // 用户输入的备注
  iconDataUrl: '',    // 从预览中获取的 icon base64
  warnings: [],       // 来自 prepare-contribution 的 warnings
  loading: false,
  result: null,
})
```

**Step 2: 更新 openPublishDialog**

```javascript
const openPublishDialog = (prepared) => {
  publishDialog.visible = true
  publishDialog.appId = prepared.app_id || prepared.app?.id || ''
  publishDialog.appName = prepared.app?.name || ''
  publishDialog.warnings = prepared.warnings || []
  publishDialog.notes = (prepared.app?.notes || []).join('\n')
  publishDialog.iconDataUrl = prepared.icon_data_url || ''
  publishDialog.result = null
}
```

**Step 3: 更新 doPublish 使用新 API**

```javascript
const doPublish = async () => {
  publishDialog.loading = true
  publishDialog.result = null
  try {
    // 提取 icon base64（去掉 data URI 前缀）
    let iconBase64 = null
    if (publishDialog.iconDataUrl) {
      const match = publishDialog.iconDataUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (match) iconBase64 = match[1]
    }

    const notes = publishDialog.notes
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    const res = await fetch(`${API_BASE}/community/publish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: publishDialog.appId,
        notes,
        icon_data_base64: iconBase64,
      }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '发布失败')
    const d = data.data
    const msg = d.pr_url
      ? `✅ PR 已创建: ${d.pr_url}\n提交文件: ${d.files_committed?.join(', ') || ''}`
      : `✅ 已提交到分支，请手动创建 PR`
    publishDialog.result = { ok: true, msg }
    Toast.success('发布成功')
  } catch (e) {
    publishDialog.result = { ok: false, msg: e.message || '发布失败' }
    Toast.error(e.message || '发布失败')
  } finally {
    publishDialog.loading = false
  }
}
```

**Step 4: 更新发布对话框模板**

去掉 owner/repo 输入框，保留：
- App 名称（只读）
- Notes 文本框
- Warnings 列表
- 提交按钮

在模板中找到 publishDialog 的 `v-if` 块并替换为精简版。

**Step 5: Commit**

```bash
git add src/components/ArchiveApp.vue
git commit -m "feat(community): simplify publish dialog — remove owner/repo, add notes"
```

---

### Task 4.3: 更新 prepareCandidateContribution 适配新响应

**Objective:** 前端适配新的 PrepareContributionResponse 结构

**Files:**
- Modify: `src/components/ArchiveApp.vue`

**Step 1: 更新 prepareCandidateContribution**

```javascript
const prepareCandidateContribution = async (app) => {
  contributingAppId.value = app.archive_key || app.id
  try {
    const { response, data } = await apiFetch(`${API_BASE}/community/prepare-contribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: app.id,
        notes: [],
      }),
    })
    if (!response.ok || !data?.ok) throw new Error(data?.error || '生成贡献预览失败')
    const prepared = data.data
    if (!prepared.github_token_configured) {
      Toast.warning('尚未配置 GitHub PAT，发布前请先到设置页保存')
    }
    // 把社区 app 数据转为 icon data URL（如果有 icon_url 则前端加载）
    let iconDataUrl = ''
    if (app.icon_url) {
      iconDataUrl = app.icon_url // 后续 doPublish 会提取 base64
    }
    openPublishDialog({
      ...prepared,
      icon_data_url: iconDataUrl,
    })
  } catch (error) {
    Toast.error(error.message || '生成贡献预览失败')
  } finally {
    contributingAppId.value = ''
  }
}
```

**Step 2: Commit**

```bash
git add src/components/ArchiveApp.vue
git commit -m "feat(community): adapt prepareCandidateContribution to v1 response"
```

---

## Phase 5: 清理与废弃

### Task 5.1: 清理不再使用的旧结构体/代码

**Objective:** 删除被新实现替代的冗余代码

**Files:**
- Modify: `server/src/main.rs`

**Step 1: 标记废弃（而非删除，保持编译）**

在以下结构体上添加注释标记：
- `CommunityPublishResponse` (旧版) → 已被新版替换
- `build_publish_path` → 不再使用
- `ensure_archive_icon_base64` → publish 不再需要 base64，但保留给其他地方用

**注意：** 不要删除 `ensure_archive_icon_base64`，因为它可能被其他地方引用。先 grep 确认。

**Step 2: Commit**

```bash
git add server/src/main.rs
git commit -m "chore(community): mark deprecated structs, clean up unused publish path builder"
```

---

## Phase 6: 构建与集成测试

### Task 6.1: 后端编译测试

```bash
cd /root/ipatool/server && cargo build --release 2>&1 | tail -5
```

Expected: `Finished release [optimized]`

### Task 6.2: 前端构建测试

```bash
cd /root/ipatool && npm run build 2>&1 | tail -10
```

Expected: 构建成功无报错

### Task 6.3: 复制前端产物到 server/dist

```bash
rm -rf /root/ipatool/server/dist && cp -r /root/ipatool/dist /root/ipatool/server/dist
```

### Task 6.4: 启动服务验证 API

```bash
cd /root/ipatool/server && cargo run &
# 测试索引读取
curl -s http://localhost:8080/api/community/delisted-index | python3 -m json.tool | head -20
# 测试本地候选
curl -s -b "$(cat /tmp/test_cookie)" http://localhost:8080/api/local/delisted-candidates | python3 -m json.tool | head -20
```

### Task 6.5: Commit 最终构建状态

```bash
git add -A
git commit -m "release: community archive v1 aligned with new schema"
```

---

## 依赖关系

```
Task 0.1 (仓库初始化)
    ↓
Task 1.1 (新 schema) → Task 1.2 (lite item 更新) → Task 1.3 (version 加字段)
    ↓
Task 2.1 (索引读取) → Task 2.2 (详情读取)
    ↓
Task 3.1 (prepare 精简) → Task 3.2 (publish 精简)
    ↓
Task 4.1 (前端 normalize) → Task 4.2 (发布对话框) → Task 4.3 (prepare 适配)
    ↓
Task 5.1 (清理)
    ↓
Task 6.1-6.5 (构建验证)
```

Task 0.1 需要手动操作 GitHub，其余可由 subagent 执行。

---

## 风险点

1. **旧数据兼容**: 本地 `data/archive/*.json` 文件不含新字段 → serde default 处理
2. **icon 体积**: GitHub Contents API 单文件限 100MB → PNG icon 远小于此，无风险
3. **PR 速率**: GitHub API rate limit (5000 req/hour with PAT) → 单次贡献 3-4 req，无风险
4. **zip 依赖**: `try_get_icon_from_local_downloads` 已有 `zip = "2.0"` 依赖 → 无需新增
