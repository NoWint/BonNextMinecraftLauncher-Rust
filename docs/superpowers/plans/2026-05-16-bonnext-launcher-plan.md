# BonNext Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Minecraft Java Edition launcher with Rust + Tauri + React that can authenticate via Microsoft OAuth, download game files, and launch Minecraft.

**Architecture:** Tauri 2.x shell hosts a React frontend. All heavy logic (auth, version resolution, downloads, JVM argument construction, process spawning) lives in Rust behind Tauri commands. Frontend calls `invoke` to trigger actions; Rust pushes state/progress via `emit`.

**Tech Stack:** Tauri 2.11, React 18 + TypeScript, Vite, pnpm, reqwest, serde, tracing

---

## Phase 1: Skeleton & Core Launch (MVP Core)

Phase 1 goal: `tauri dev` opens a window with version selector + launch button. Clicking "Start Game" downloads a Minecraft version and launches it.

### Task 1: Scaffold Tauri + React project

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/capabilities/default.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Initialize the Tauri + React project using `pnpm create tauri-app`**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm create tauri-app . --template react-ts --manager pnpm
```

Expected: The command scaffolds a Tauri 2.x project with React + TypeScript + Vite.

- [ ] **Step 2: Verify project structure exists**

```bash
ls src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/main.rs src-tauri/src/lib.rs package.json vite.config.ts src/main.tsx src/App.tsx
```

Expected: All files exist.

- [ ] **Step 3: Verify `tauri dev` launches**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tauri dev
```

Expected: A window opens showing the default Tauri + React welcome screen. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git init
git add -A
git commit -m "feat: scaffold Tauri 2 + React + TypeScript project"
```

---

### Task 2: Add Rust dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add all required Rust dependencies to Cargo.toml**

Open `src-tauri/Cargo.toml` and replace the `[dependencies]` section:

```toml
[package]
name = "bonnext"
version = "0.1.0"
description = "A cross-platform Minecraft Java Edition launcher"
authors = ["you"]
edition = "2021"

[lib]
name = "bonnext_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
sha1 = { package = "sha1", version = "0.10" }
hex = "0.4"
thiserror = "2"
directories = "6"
futures-util = "0.3"
uuid = { version = "1", features = ["v4"] }
url = "2"
```

- [ ] **Step 2: Verify the project compiles**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add Rust dependencies (reqwest, serde, tokio, tracing, sha1, thiserror)"
```

---

### Task 3: Create unified error type

**Files:**
- Create: `src-tauri/src/error.rs`

- [ ] **Step 1: Write the error module**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("URL parse error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Java not found")]
    JavaNotFound,

    #[error("Version not found: {0}")]
    VersionNotFound(String),

    #[error("Download failed after {retries} retries: {url}")]
    DownloadFailed { url: String, retries: u32 },

    #[error("SHA1 verification failed for {file}")]
    Sha1Mismatch { file: String },

    #[error("Launch failed: {reason}")]
    LaunchFailed { reason: String },

    #[error("Game crashed with exit code {code}")]
    GameCrashed { code: i32 },

    #[error("Authentication failed: {reason}")]
    AuthFailed { reason: String },

    #[error("Not enough disk space: need {required}MB, have {available}MB")]
    DiskSpace { required: u64, available: u64 },

    #[error("{0}")]
    Other(String),
}

impl From<LauncherError> for String {
    fn from(e: LauncherError) -> Self {
        e.to_string()
    }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/error.rs
git commit -m "feat: add unified error type with thiserror"
```

---

### Task 4: Create platform paths module

**Files:**
- Create: `src-tauri/src/platform/mod.rs`
- Create: `src-tauri/src/platform/paths.rs`

- [ ] **Step 1: Write the paths module**

```rust
use directories::BaseDirs;
use std::path::PathBuf;

pub fn get_game_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_dir().join("bonnext")
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_versions_dir() -> PathBuf {
    get_game_dir().join("versions")
}

pub fn get_libraries_dir() -> PathBuf {
    get_game_dir().join("libraries")
}

pub fn get_assets_dir() -> PathBuf {
    get_game_dir().join("assets")
}

pub fn get_logs_dir() -> PathBuf {
    get_game_dir().join("logs")
}

pub fn get_config_path() -> PathBuf {
    get_game_dir().join("config.json")
}

pub fn get_launcher_log_path() -> PathBuf {
    get_logs_dir().join("launcher.log")
}

pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [
        get_game_dir(),
        get_versions_dir(),
        get_libraries_dir(),
        get_assets_dir(),
        get_logs_dir(),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
```

- [ ] **Step 2: Write the platform mod.rs**

```rust
pub mod paths;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/platform/
git commit -m "feat: add platform paths module for game directory management"
```

---

### Task 5: Create version manifest module

**Files:**
- Create: `src-tauri/src/version/mod.rs`
- Create: `src-tauri/src/version/manifest.rs`

- [ ] **Step 1: Write the manifest types and parser**

```rust
use serde::{Deserialize, Serialize};

pub const VERSION_MANIFEST_URL: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    let client = reqwest::Client::new();
    let manifest: VersionManifest = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(manifest)
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
```

- [ ] **Step 2: Write the version mod.rs**

```rust
pub mod manifest;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/version/
git commit -m "feat: add version manifest parser (fetch & parse Mojang API)"
```

---

### Task 6: Create version resolver (parse version JSON)

**Files:**
- Create: `src-tauri/src/version/resolver.rs`

- [ ] **Step 1: Write the version JSON types and resolver**

```rust
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
pub struct VersionDetails {
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    pub assets: String,
    #[serde(rename = "complianceLevel", default)]
    pub compliance_level: u32,
    pub downloads: Downloads,
    pub id: String,
    #[serde(rename = "javaVersion", default)]
    pub java_version: JavaVersion,
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minimumLauncherVersion")]
    pub minimum_launcher_version: u32,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub version_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Downloads {
    pub client: Download,
    #[serde(rename = "client_mappings", default)]
    pub client_mappings: Option<Download>,
    pub server: Option<Download>,
    #[serde(rename = "server_mappings", default)]
    pub server_mappings: Option<Download>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Download {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub natives: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<LibraryArtifact>,
    pub classifiers: Option<HashMap<String, LibraryArtifact>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryArtifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: String,
}

pub struct ResolvedVersion {
    pub id: String,
    pub main_class: String,
    pub client_jar: Download,
    pub asset_index: AssetIndex,
    pub libraries: Vec<LibraryArtifact>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

fn rule_allows(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        let os_match = match &rule.os {
            Some(os) => {
                #[cfg(target_os = "windows")]
                { os.name == "windows" }
                #[cfg(target_os = "macos")]
                { os.name == "osx" || os.name == "macos" }
                #[cfg(not(any(target_os = "windows", target_os = "macos")))]
                { os.name == "linux" }
            }
            None => true,
        };
        if rule.action == "allow" && os_match {
            allowed = true;
        } else if rule.action == "disallow" && os_match {
            allowed = false;
        }
    }
    allowed
}

fn resolve_arg_templates(args: &[serde_json::Value], version: &VersionDetails) -> Vec<String> {
    let mut resolved = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                resolved.push(s.clone());
            }
            serde_json::Value::Object(obj) => {
                if let Some(rules_val) = obj.get("rules") {
                    let rules: Vec<Rule> =
                        serde_json::from_value(rules_val.clone()).unwrap_or_default();
                    if !rule_allows(&rules) {
                        continue;
                    }
                }
                if let Some(value_val) = obj.get("value") {
                    match value_val {
                        serde_json::Value::String(s) => {
                            resolved.push(s.clone());
                        }
                        serde_json::Value::Array(arr) => {
                            for v in arr {
                                if let Some(s) = v.as_str() {
                                    resolved.push(s.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    resolved
}

impl ResolvedVersion {
    pub fn from_details(version: &VersionDetails) -> Self {
        let libraries: Vec<LibraryArtifact> = version
            .libraries
            .iter()
            .filter(|lib| rule_allows(&lib.rules))
            .filter_map(|lib| {
                if let Some(downloads) = &lib.downloads {
                    if let Some(classifiers) = &downloads.classifiers {
                        #[cfg(target_os = "windows")]
                        let native_key = "natives-windows";
                        #[cfg(target_os = "macos")]
                        let native_key = "natives-osx";
                        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
                        let native_key = "natives-linux";

                        if let Some(artifact) = classifiers.get(native_key) {
                            return Some(artifact.clone());
                        }
                    }
                    if let Some(artifact) = &downloads.artifact {
                        return Some(artifact.clone());
                    }
                }
                None
            })
            .collect();

        let jvm_args = resolve_arg_templates(&version.arguments.jvm, version);
        let game_args = resolve_arg_templates(&version.arguments.game, version);

        ResolvedVersion {
            id: version.id.clone(),
            main_class: version.main_class.clone(),
            client_jar: version.downloads.client.clone(),
            asset_index: version.asset_index.clone(),
            libraries,
            jvm_args,
            game_args,
        }
    }
}

pub async fn fetch_version_details(
    version_url: &str,
) -> Result<VersionDetails, crate::error::LauncherError> {
    let client = reqwest::Client::new();
    let details: VersionDetails = client
        .get(version_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(details)
}
```

- [ ] **Step 2: Update version/mod.rs**

Replace `src-tauri/src/version/mod.rs` to also expose resolver:

```rust
pub mod manifest;
pub mod resolver;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/version/
git commit -m "feat: add version resolver (parse version JSON, resolve libraries & args)"
```

---

### Task 7: Create download module

**Files:**
- Create: `src-tauri/src/download/mod.rs`
- Create: `src-tauri/src/download/queue.rs`
- Create: `src-tauri/src/download/verifier.rs`

- [ ] **Step 1: Write the SHA1 verifier**

```rust
use sha1::{Digest, Sha1};
use std::path::Path;
use tokio::io::AsyncReadExt;

pub async fn verify_sha1(path: &Path, expected: &str) -> Result<bool, std::io::Error> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let result = hex::encode(hasher.finalize());
    Ok(result == expected)
}
```

- [ ] **Step 2: Write the download queue**

```rust
use crate::error::LauncherError;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone)]
pub struct DownloadItem {
    pub url: String,
    pub path: PathBuf,
    pub sha1: String,
    pub size: u64,
}

pub struct DownloadProgress {
    pub total_files: u64,
    pub completed_files: AtomicU64,
    pub total_bytes: u64,
    pub downloaded_bytes: AtomicU64,
    pub current_file: parking_lot::Mutex<String>,
}

impl DownloadProgress {
    pub fn new(total_files: u64, total_bytes: u64) -> Self {
        Self {
            total_files,
            completed_files: AtomicU64::new(0),
            total_bytes,
            downloaded_bytes: AtomicU64::new(0),
            current_file: parking_lot::Mutex::new(String::new()),
        }
    }
}

async fn download_single(
    item: &DownloadItem,
    progress: Arc<DownloadProgress>,
) -> Result<(), LauncherError> {
    if let Some(parent) = item.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    *progress.current_file.lock() = item.url.clone();

    let client = reqwest::Client::new();
    let mut existing_size = 0u64;

    if item.path.exists() {
        existing_size = tokio::fs::metadata(&item.path).await?.len();
    }

    let mut request = client.get(&item.url);
    if existing_size > 0 && existing_size < item.size {
        request = request.header("Range", format!("bytes={}-", existing_size));
    }

    let response = request.send().await?.error_for_status()?;

    let file = if existing_size > 0 && existing_size < item.size {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&item.path)
            .await?
    } else {
        tokio::fs::File::create(&item.path).await?
    };

    let mut file = file;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        progress
            .downloaded_bytes
            .fetch_add(chunk.len() as u64, Ordering::SeqCst);
    }

    Ok(())
}

pub async fn download_with_progress(
    items: Vec<DownloadItem>,
    concurrency: usize,
) -> Result<(), LauncherError> {
    let total_bytes: u64 = items.iter().map(|i| i.size).sum();
    let total_files = items.len() as u64;
    let progress = Arc::new(DownloadProgress::new(total_files, total_bytes));

    let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for item in items {
        let item = item.clone();
        let progress = progress.clone();
        let permit = semaphore.clone().acquire_owned().await.unwrap();

        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let mut last_err = None;
            for attempt in 0..3 {
                match download_single(&item, progress.clone()).await {
                    Ok(()) => {
                        match super::verifier::verify_sha1(&item.path, &item.sha1).await {
                            Ok(true) => {
                                progress.completed_files.fetch_add(1, Ordering::SeqCst);
                                return Ok::<_, LauncherError>(());
                            }
                            Ok(false) => {
                                let _ = tokio::fs::remove_file(&item.path).await;
                                last_err = Some(LauncherError::Sha1Mismatch {
                                    file: item
                                        .path
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                });
                            }
                            Err(e) => {
                                last_err = Some(LauncherError::Io(e));
                            }
                        }
                    }
                    Err(e) => {
                        last_err = Some(e);
                    }
                }
                if attempt < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1 << attempt)).await;
                }
            }
            Err(last_err.unwrap_or_else(|| LauncherError::DownloadFailed {
                url: item.url.clone(),
                retries: 3,
            }))
        }));
    }

    for handle in handles {
        handle.await.unwrap()?;
    }

    Ok(())
}
```

Wait — the download module uses `parking_lot`. I need to add that dependency to Cargo.toml. Let me note that.

Also for the progress reporting to the frontend, I need Tauri's `AppHandle` to emit events. Let me revise the design — the download function needs access to the Tauri app handle to emit progress events. Let me adjust the approach.

Actually, a better approach for MVP: the download function takes a callback channel, or we structure it so that the Tauri command orchestrates the download and emits events. Let me keep it simpler — have the Tauri command layer handle event emission, and the download module just returns results. Then the command layer polls progress.

Actually, for simplicity in MVP, let me have the download queue emit progress via a tokio broadcast channel, and the Tauri command layer listens to it. But that's complex. Even simpler: just have the command layer wrap everything and emit events based on a shared progress struct. Let me think...

For the plan, I'll use a simpler approach: use `std::sync::mpsc` to send progress updates, and the Tauri command will receive them and emit events. Actually, the simplest approach that works:

1. Download queue uses a callback approach — takes a closure that's called for each file completed
2. The Tauri command builds the closure using the app handle

But closures across async boundaries are tricky. Let me just use a broadcast channel.

OK let me simplify drastically for the plan. I'll use an approach where the download function reports progress via a channel, and the Tauri command spawns the download and listens.

Let me rewrite the download module properly.</think>

<｜DSML｜tool_calls>
<｜DSML｜invoke name="Write">
<｜DSML｜parameter name="content" string="true"># BonNext Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Minecraft Java Edition launcher with Rust + Tauri + React that can authenticate via Microsoft OAuth, download game files, and launch Minecraft.

**Architecture:** Tauri 2.x shell hosts a React frontend. All heavy logic (auth, version resolution, downloads, JVM argument construction, process spawning) lives in Rust behind Tauri commands. Frontend calls `invoke` to trigger actions; Rust pushes state/progress via `emit`.

**Tech Stack:** Tauri 2.11, React 18 + TypeScript, Vite, pnpm, reqwest, serde, tracing, parking_lot

---

## Phase 1: Skeleton & Core Launch (MVP Core)

Phase 1 goal: `pnpm tauri dev` opens a window with version selector + launch button. Clicking "Start Game" downloads a Minecraft version and launches it.

### Task 1: Scaffold Tauri + React project

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/capabilities/default.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Initialize the Tauri + React project**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm create tauri-app . --template react-ts --manager pnpm
```

Expected: The command scaffolds a Tauri 2.x project with React + TypeScript + Vite.

- [ ] **Step 2: Verify project structure exists**

```bash
ls src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/main.rs src-tauri/src/lib.rs package.json vite.config.ts src/main.tsx src/App.tsx
```

Expected: All files exist.

- [ ] **Step 3: Verify `pnpm tauri dev` launches**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tauri dev
```

Expected: A window opens showing the default Tauri + React welcome screen. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git init
git add -A
git commit -m "feat: scaffold Tauri 2 + React + TypeScript project"
```

---

### Task 2: Add Rust dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Read existing Cargo.toml, then replace dependencies**

Read `src-tauri/Cargo.toml` first. In the `[dependencies]` section under `tauri`, add these extra crates:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
sha1 = { version = "0.10", package = "sha1" }
hex = "0.4"
thiserror = "2"
directories = "6"
futures-util = "0.3"
uuid = { version = "1", features = ["v4"] }
url = "2"
parking_lot = "0.12"
```

Note: `tauri` and `serde` + `serde_json` likely already exist from scaffolding. Add only the missing crates.

- [ ] **Step 2: Verify the project compiles**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add Rust dependencies (reqwest, serde, tokio, tracing, sha1, thiserror)"
```

---

### Task 3: Create unified error type

**Files:**
- Create: `src-tauri/src/error.rs`

- [ ] **Step 1: Write the error module**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("URL parse error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Java not found")]
    JavaNotFound,

    #[error("Version not found: {0}")]
    VersionNotFound(String),

    #[error("Download failed after 3 retries: {0}")]
    DownloadFailed(String),

    #[error("SHA1 verification failed for {0}")]
    Sha1Mismatch(String),

    #[error("Launch failed: {0}")]
    LaunchFailed(String),

    #[error("Game crashed with exit code {0}")]
    GameCrashed(i32),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Not enough disk space: need {required}MB, have {available}MB")]
    DiskSpace { required: u64, available: u64 },

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/error.rs
git commit -m "feat: add unified error type with thiserror"
```

---

### Task 4: Create platform paths module

**Files:**
- Create: `src-tauri/src/platform/mod.rs`
- Create: `src-tauri/src/platform/paths.rs`

- [ ] **Step 1: Write paths.rs**

```rust
use directories::BaseDirs;
use std::path::PathBuf;

pub fn get_game_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_dir().join("bonnext")
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_versions_dir() -> PathBuf {
    get_game_dir().join("versions")
}

pub fn get_libraries_dir() -> PathBuf {
    get_game_dir().join("libraries")
}

pub fn get_assets_dir() -> PathBuf {
    get_game_dir().join("assets")
}

pub fn get_logs_dir() -> PathBuf {
    get_game_dir().join("logs")
}

pub fn get_config_path() -> PathBuf {
    get_game_dir().join("config.json")
}

pub fn get_launcher_log_path() -> PathBuf {
    get_logs_dir().join("launcher.log")
}

pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [
        get_game_dir(),
        get_versions_dir(),
        get_libraries_dir(),
        get_assets_dir(),
        get_logs_dir(),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
```

- [ ] **Step 2: Write platform mod.rs**

```rust
pub mod paths;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/platform/
git commit -m "feat: add platform paths module for game directory management"
```

---

### Task 5: Create version manifest module

**Files:**
- Create: `src-tauri/src/version/mod.rs`
- Create: `src-tauri/src/version/manifest.rs`

- [ ] **Step 1: Write manifest.rs**

```rust
use serde::{Deserialize, Serialize};

pub const VERSION_MANIFEST_URL: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    let client = reqwest::Client::new();
    let manifest: VersionManifest = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(manifest)
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
```

- [ ] **Step 2: Write version mod.rs**

```rust
pub mod manifest;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/version/
git commit -m "feat: add version manifest parser (fetch & parse Mojang API)"
```

---

### Task 6: Create version resolver (parse version JSON)

**Files:**
- Create: `src-tauri/src/version/resolver.rs`

- [ ] **Step 1: Write resolver.rs**

```rust
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
pub struct VersionDetails {
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    pub assets: String,
    pub downloads: Downloads,
    pub id: String,
    #[serde(rename = "javaVersion", default)]
    pub java_version: JavaVersion,
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minimumLauncherVersion")]
    pub minimum_launcher_version: u32,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub version_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    pub jvm: Vec<serde_json::Value>,
}

impl Default for Arguments {
    fn default() -> Self {
        Arguments {
            game: vec![],
            jvm: vec![],
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Downloads {
    pub client: Download,
    pub server: Option<Download>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Download {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

impl Default for JavaVersion {
    fn default() -> Self {
        JavaVersion {
            component: "jre-legacy".to_string(),
            major_version: 8,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub natives: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<LibraryArtifact>,
    pub classifiers: Option<HashMap<String, LibraryArtifact>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryArtifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: String,
}

pub struct ResolvedVersion {
    pub id: String,
    pub main_class: String,
    pub client_jar: Download,
    pub asset_index: AssetIndex,
    pub libraries: Vec<LibraryArtifact>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

fn rule_allows(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        let os_match = match &rule.os {
            Some(os) => {
                if cfg!(target_os = "windows") {
                    os.name == "windows"
                } else if cfg!(target_os = "macos") {
                    os.name == "osx" || os.name == "macos"
                } else {
                    os.name == "linux"
                }
            }
            None => true,
        };
        if rule.action == "allow" && os_match {
            allowed = true;
        } else if rule.action == "disallow" && os_match {
            allowed = false;
        }
    }
    allowed
}

fn resolve_arg_templates(
    args: &[serde_json::Value],
    _version: &VersionDetails,
) -> Vec<String> {
    let mut resolved = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                resolved.push(s.clone());
            }
            serde_json::Value::Object(obj) => {
                if let Some(rules_val) = obj.get("rules") {
                    let rules: Vec<Rule> =
                        serde_json::from_value(rules_val.clone()).unwrap_or_default();
                    if !rule_allows(&rules) {
                        continue;
                    }
                }
                if let Some(value_val) = obj.get("value") {
                    match value_val {
                        serde_json::Value::String(s) => {
                            resolved.push(s.clone());
                        }
                        serde_json::Value::Array(arr) => {
                            for v in arr {
                                if let Some(s) = v.as_str() {
                                    resolved.push(s.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    resolved
}

impl ResolvedVersion {
    pub fn from_details(version: &VersionDetails) -> Self {
        let libraries: Vec<LibraryArtifact> = version
            .libraries
            .iter()
            .filter(|lib| rule_allows(&lib.rules))
            .filter_map(|lib| {
                if let Some(downloads) = &lib.downloads {
                    if let Some(classifiers) = &downloads.classifiers {
                        let native_key = if cfg!(target_os = "windows") {
                            "natives-windows"
                        } else if cfg!(target_os = "macos") {
                            "natives-osx"
                        } else {
                            "natives-linux"
                        };
                        if let Some(artifact) = classifiers.get(native_key) {
                            return Some(artifact.clone());
                        }
                    }
                    if let Some(artifact) = &downloads.artifact {
                        return Some(artifact.clone());
                    }
                }
                None
            })
            .collect();

        let jvm_args = resolve_arg_templates(&version.arguments.jvm, version);
        let game_args = resolve_arg_templates(&version.arguments.game, version);

        ResolvedVersion {
            id: version.id.clone(),
            main_class: version.main_class.clone(),
            client_jar: version.downloads.client.clone(),
            asset_index: version.asset_index.clone(),
            libraries,
            jvm_args,
            game_args,
        }
    }
}

pub async fn fetch_version_details(
    version_url: &str,
) -> Result<VersionDetails, crate::error::LauncherError> {
    let client = reqwest::Client::new();
    let details: VersionDetails = client
        .get(version_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(details)
}
```

- [ ] **Step 2: Update version/mod.rs**

```rust
pub mod manifest;
pub mod resolver;
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/version/
git commit -m "feat: add version resolver (parse version JSON, resolve libraries & args)"
```

---

### Task 7: Create download module

**Files:**
- Create: `src-tauri/src/download/mod.rs`
- Create: `src-tauri/src/download/queue.rs`
- Create: `src-tauri/src/download/verifier.rs`

- [ ] **Step 1: Write verifier.rs**

```rust
use sha1::{Digest, Sha1};
use std::path::Path;

pub fn verify_sha1(path: &Path, expected: &str) -> Result<bool, std::io::Error> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let result = hex::encode(hasher.finalize());
    Ok(result == expected)
}
```

- [ ] **Step 2: Write queue.rs**

```rust
use crate::error::LauncherError;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone)]
pub struct DownloadItem {
    pub url: String,
    pub path: PathBuf,
    pub sha1: String,
    pub size: u64,
}

pub struct DownloadProgress {
    pub total_files: u64,
    pub completed_files: AtomicU64,
    pub total_bytes: u64,
    pub downloaded_bytes: AtomicU64,
    pub current_file: parking_lot::Mutex<String>,
}

impl DownloadProgress {
    pub fn new(total_files: u64, total_bytes: u64) -> Self {
        Self {
            total_files,
            completed_files: AtomicU64::new(0),
            total_bytes,
            downloaded_bytes: AtomicU64::new(0),
            current_file: parking_lot::Mutex::new(String::new()),
        }
    }

    pub fn get_progress(&self) -> DownloadProgressSnapshot {
        DownloadProgressSnapshot {
            total_files: self.total_files,
            completed_files: self.completed_files.load(Ordering::SeqCst),
            total_bytes: self.total_bytes,
            downloaded_bytes: self.downloaded_bytes.load(Ordering::SeqCst),
            current_file: self.current_file.lock().clone(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgressSnapshot {
    pub total_files: u64,
    pub completed_files: u64,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub current_file: String,
}

async fn download_single(
    item: &DownloadItem,
    progress: Arc<DownloadProgress>,
) -> Result<(), LauncherError> {
    if let Some(parent) = item.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    *progress.current_file.lock() = item.path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let client = reqwest::Client::new();
    let mut existing_size = 0u64;

    if item.path.exists() {
        existing_size = tokio::fs::metadata(&item.path).await?.len();
    }

    let mut request = client.get(&item.url);
    if existing_size > 0 && existing_size < item.size {
        request = request.header("Range", format!("bytes={}-", existing_size));
    }

    let response = request.send().await?.error_for_status()?;

    let file = if existing_size > 0 && existing_size < item.size {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&item.path)
            .await?
    } else {
        tokio::fs::File::create(&item.path).await?
    };

    let mut file = file;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        progress.downloaded_bytes.fetch_add(chunk.len() as u64, Ordering::SeqCst);
    }

    Ok(())
}

pub async fn download_all(
    items: Vec<DownloadItem>,
    concurrency: usize,
) -> Result<Arc<DownloadProgress>, LauncherError> {
    let total_bytes: u64 = items.iter().map(|i| i.size).sum();
    let total_files = items.len() as u64;
    let progress = Arc::new(DownloadProgress::new(total_files, total_bytes));

    let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for item in items {
        let item = item.clone();
        let progress = progress.clone();
        let permit = semaphore.clone().acquire_owned().await.unwrap();

        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let mut last_err = None;
            for attempt in 0u32..3 {
                match download_single(&item, progress.clone()).await {
                    Ok(()) => {
                        match super::verifier::verify_sha1(&item.path, &item.sha1) {
                            Ok(true) => {
                                progress.completed_files.fetch_add(1, Ordering::SeqCst);
                                return Ok::<_, LauncherError>(());
                            }
                            Ok(false) => {
                                let _ = std::fs::remove_file(&item.path);
                                last_err = Some(LauncherError::Sha1Mismatch(
                                    item.path
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                ));
                            }
                            Err(e) => {
                                last_err = Some(LauncherError::Io(e));
                            }
                        }
                    }
                    Err(e) => {
                        last_err = Some(e);
                    }
                }
                if attempt < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1 << attempt)).await;
                }
            }
            Err(last_err.unwrap_or_else(|| LauncherError::DownloadFailed(
                item.url.clone(),
            )))
        }));
    }

    for handle in handles {
        handle.await.unwrap()?;
    }

    Ok(progress)
}
```

- [ ] **Step 3: Write download mod.rs**

```rust
pub mod queue;
pub mod verifier;
```

- [ ] **Step 4: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/download/
git commit -m "feat: add download module with SHA1 verification, retry, and concurrency"
```

---

### Task 8: Create launch module (JVM args + process)

**Files:**
- Create: `src-tauri/src/launch/mod.rs`
- Create: `src-tauri/src/launch/args.rs`
- Create: `src-tauri/src/launch/process.rs`
- Create: `src-tauri/src/launch/state.rs`

- [ ] **Step 1: Write state.rs**

```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "state")]
pub enum LaunchState {
    Idle,
    Checking,
    Downloading {
        total_files: u64,
        completed_files: u64,
        total_bytes: u64,
        downloaded_bytes: u64,
        current_file: String,
    },
    Validating,
    Launching,
    Running {
        pid: u32,
    },
    Exited {
        code: i32,
    },
    Crashed {
        code: i32,
        reason: String,
    },
    Error {
        message: String,
    },
}

impl LaunchState {
    pub fn is_busy(&self) -> bool {
        !matches!(self, LaunchState::Idle | LaunchState::Exited { .. } | LaunchState::Crashed { .. } | LaunchState::Error { .. })
    }
}
```

- [ ] **Step 2: Write args.rs**

```rust
use crate::version::resolver::ResolvedVersion;
use std::path::PathBuf;

pub struct LaunchConfig {
    pub java_path: String,
    pub max_memory_mb: u32,
    pub extra_jvm_args: Vec<String>,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub game_dir: PathBuf,
}

pub fn build_launch_command(
    resolved: &ResolvedVersion,
    config: &LaunchConfig,
    libraries_dir: &PathBuf,
    versions_dir: &PathBuf,
    assets_dir: &PathBuf,
) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    args.push(config.java_path.clone());

    let classpath_separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };

    let mut classpath_parts: Vec<String> = Vec::new();

    let client_jar_path = versions_dir.join(&resolved.id).join("client.jar");
    classpath_parts.push(client_jar_path.to_string_lossy().to_string());

    for lib in &resolved.libraries {
        let lib_path = libraries_dir.join(&lib.path);
        classpath_parts.push(lib_path.to_string_lossy().to_string());
    }

    let classpath = classpath_parts.join(classpath_separator);

    for jvm_arg in &resolved.jvm_args {
        let arg = jvm_arg
            .replace("${classpath}", &classpath)
            .replace("${natives_directory}", &versions_dir.join(&resolved.id).join("natives").to_string_lossy())
            .replace("${library_directory}", &libraries_dir.to_string_lossy())
            .replace("${version_name}", &resolved.id)
            .replace("${launcher_name}", "bonnext")
            .replace("${launcher_version}", "0.1.0");
        args.push(arg);
    }

    args.push(format!("-Xmx{}M", config.max_memory_mb));

    for extra in &config.extra_jvm_args {
        if !extra.is_empty() {
            args.push(extra.clone());
        }
    }

    args.push(resolved.main_class.clone());

    for game_arg in &resolved.game_args {
        let arg = game_arg
            .replace("${auth_player_name}", &config.username)
            .replace("${auth_uuid}", &config.uuid)
            .replace("${auth_access_token}", &config.access_token)
            .replace("${user_type}", "mojang")
            .replace("${version_name}", &resolved.id)
            .replace("${game_directory}", &config.game_dir.to_string_lossy())
            .replace("${assets_root}", &assets_dir.to_string_lossy())
            .replace("${assets_index_name}", &resolved.asset_index.id)
            .replace("${user_properties}", "{}")
            .replace("${version_type}", "release")
            .replace("${clientid}", "bonnext")
            .replace("${auth_xuid}", "");
        args.push(arg);
    }

    args
}
```

- [ ] **Step 3: Write process.rs**

```rust
use crate::error::LauncherError;
use crate::launch::state::LaunchState;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;

pub async fn launch_minecraft(
    app: tauri::AppHandle,
    args: Vec<String>,
) -> Result<(), LauncherError> {
    let java_path = &args[0];
    let jvm_args = &args[1..];

    let mut child = Command::new(java_path)
        .args(jvm_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| LauncherError::LaunchFailed(format!("Failed to spawn Java: {}", e)))?;

    let pid = child.id().unwrap_or(0);

    let _ = app.emit("launch-state", LaunchState::Running { pid });

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
    let mut stderr_reader = tokio::io::BufReader::new(stderr).lines();

    let stderr_app = app.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut stderr_lines = Vec::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            stderr_lines.push(line);
        }
        stderr_lines
    });

    let stdout_handle = tokio::spawn(async move {
        while let Ok(Some(_line)) = stdout_reader.next_line().await {
            // Log stdout lines as game output
        }
    });

    let status = child.wait().await.map_err(|e| {
        LauncherError::LaunchFailed(format!("Failed to wait for Minecraft: {}", e))
    })?;

    stdout_handle.await.ok();
    let stderr_lines = stderr_handle.await.unwrap_or_default();

    match status.code() {
        Some(0) => {
            let _ = app.emit("launch-state", LaunchState::Exited { code: 0 });
            Ok(())
        }
        Some(code) => {
            let reason = stderr_lines.join("\n");
            let _ = app.emit(
                "launch-state",
                LaunchState::Crashed {
                    code,
                    reason: reason.clone(),
                },
            );
            Err(LauncherError::GameCrashed(code))
        }
        None => {
            let _ = app.emit("launch-state", LaunchState::Exited { code: -1 });
            Ok(())
        }
    }
}
```

- [ ] **Step 4: Write launch mod.rs**

```rust
pub mod args;
pub mod process;
pub mod state;
```

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/launch/
git commit -m "feat: add launch engine (JVM args builder, process manager, state machine)"
```

---

### Task 9: Wire up Tauri commands and module registration

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Read existing lib.rs, then write the complete lib.rs**

```rust
mod error;
mod platform;
mod version;
mod download;
mod launch;

use error::LauncherError;
use launch::args::{build_launch_command, LaunchConfig};
use launch::process::launch_minecraft;
use launch::state::LaunchState;
use platform::paths;
use std::sync::Mutex;
use tauri::Manager;
use version::manifest::VersionEntry;
use version::resolver::{fetch_version_details, ResolvedVersion};

struct AppState {
    launch_state: Mutex<LaunchState>,
}

#[tauri::command]
async fn get_versions() -> Result<Vec<VersionEntry>, LauncherError> {
    version::manifest::fetch_versions_sorted().await
}

#[tauri::command]
async fn start_game(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    version_id: String,
    java_path: String,
    max_memory_mb: u32,
    username: String,
    uuid: String,
) -> Result<(), LauncherError> {
    {
        let current = state.launch_state.lock().unwrap();
        if current.is_busy() {
            return Err(LauncherError::Other("A launch is already in progress".to_string()));
        }
    }

    {
        let mut current = state.launch_state.lock().unwrap();
        *current = LaunchState::Checking;
    }
    let _ = app.emit("launch-state", LaunchState::Checking);

    paths::ensure_dirs().map_err(|e| LauncherError::Io(e))?;

    let versions = version::manifest::fetch_versions_sorted().await?;
    let entry = versions
        .iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::VersionNotFound(version_id.clone()))?;

    let details = fetch_version_details(&entry.url).await?;
    let resolved = ResolvedVersion::from_details(&details);

    let mut download_items = Vec::new();

    let client_jar_path = paths::get_versions_dir().join(&version_id).join("client.jar");
    download_items.push(download::queue::DownloadItem {
        url: resolved.client_jar.url.clone(),
        path: client_jar_path,
        sha1: resolved.client_jar.sha1.clone(),
        size: resolved.client_jar.size,
    });

    for lib in &resolved.libraries {
        let lib_path = paths::get_libraries_dir().join(&lib.path);
        if lib_path.exists() {
            if download::verifier::verify_sha1(&lib_path, &lib.sha1).unwrap_or(false) {
                continue;
            }
        }
        download_items.push(download::queue::DownloadItem {
            url: lib.url.clone(),
            path: lib_path,
            sha1: lib.sha1.clone(),
            size: lib.size,
        });
    }

    if !download_items.is_empty() {
        let total_bytes: u64 = download_items.iter().map(|i| i.size).sum();
        let total_files = download_items.len() as u64;

        {
            let mut current = state.launch_state.lock().unwrap();
            *current = LaunchState::Downloading {
                total_files,
                completed_files: 0,
                total_bytes,
                downloaded_bytes: 0,
                current_file: String::new(),
            };
        }

        let progress = download::queue::download_all(download_items, 8).await?;

        {
            let mut current = state.launch_state.lock().unwrap();
            *current = LaunchState::Validating;
        }
        let _ = app.emit("launch-state", LaunchState::Validating);
    }

    {
        let mut current = state.launch_state.lock().unwrap();
        *current = LaunchState::Launching;
    }
    let _ = app.emit("launch-state", LaunchState::Launching);

    let game_dir = paths::get_game_dir();
    let access_token = "0".to_string();

    let config = LaunchConfig {
        java_path,
        max_memory_mb,
        extra_jvm_args: Vec::new(),
        username,
        uuid,
        access_token,
        game_dir: game_dir.clone(),
    };

    let args = build_launch_command(
        &resolved,
        &config,
        &paths::get_libraries_dir(),
        &paths::get_versions_dir(),
        &paths::get_assets_dir(),
    );

    launch_minecraft(app.clone(), args).await
}

#[tauri::command]
async fn get_launch_state(state: tauri::State<'_, AppState>) -> Result<LaunchState, LauncherError> {
    let current = state.launch_state.lock().unwrap();
    Ok(current.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            launch_state: Mutex::new(LaunchState::Idle),
        })
        .invoke_handler(tauri::generate_handler![
            get_versions,
            start_game,
            get_launch_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Verify main.rs exists and looks correct**

Read `src-tauri/src/main.rs`. It should contain:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    bonnext_lib::run()
}
```

If it has different content from scaffolding, update it.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/lib.rs src-tauri/src/main.rs
git commit -m "feat: wire up Tauri commands (get_versions, start_game, get_launch_state)"
```

---

### Task 10: Build frontend — state management and Tauri bridge

**Files:**
- Create: `src/state/appReducer.ts`
- Create: `src/hooks/useTauri.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write appReducer.ts**

```typescript
export interface LaunchState {
  state: string;
  total_files?: number;
  completed_files?: number;
  total_bytes?: number;
  downloaded_bytes?: number;
  current_file?: string;
  pid?: number;
  code?: number;
  reason?: string;
  message?: string;
}

export interface VersionEntry {
  id: string;
  version_type: string;
  url: string;
  time: string;
  release_time: string;
}

export interface AppState {
  auth: {
    loggedIn: boolean;
    username: string;
    uuid: string;
  };
  versions: VersionEntry[];
  selectedVersion: string;
  launchState: LaunchState;
  javaPath: string;
  maxMemory: number;
}

export type AppAction =
  | { type: "SET_AUTH"; payload: { username: string; uuid: string } }
  | { type: "LOGOUT" }
  | { type: "SET_VERSIONS"; payload: VersionEntry[] }
  | { type: "SET_SELECTED_VERSION"; payload: string }
  | { type: "SET_LAUNCH_STATE"; payload: LaunchState }
  | { type: "SET_JAVA_PATH"; payload: string }
  | { type: "SET_MAX_MEMORY"; payload: number };

export const initialAppState: AppState = {
  auth: {
    loggedIn: false,
    username: "",
    uuid: "",
  },
  versions: [],
  selectedVersion: "",
  launchState: { state: "Idle" },
  javaPath: "",
  maxMemory: 4096,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_AUTH":
      return {
        ...state,
        auth: {
          loggedIn: true,
          username: action.payload.username,
          uuid: action.payload.uuid,
        },
      };
    case "LOGOUT":
      return {
        ...state,
        auth: { loggedIn: false, username: "", uuid: "" },
      };
    case "SET_VERSIONS":
      return {
        ...state,
        versions: action.payload,
        selectedVersion:
          state.selectedVersion || action.payload[0]?.id || "",
      };
    case "SET_SELECTED_VERSION":
      return { ...state, selectedVersion: action.payload };
    case "SET_LAUNCH_STATE":
      return { ...state, launchState: action.payload };
    case "SET_JAVA_PATH":
      return { ...state, javaPath: action.payload };
    case "SET_MAX_MEMORY":
      return { ...state, maxMemory: action.payload };
    default:
      return state;
  }
}
```

- [ ] **Step 2: Write useTauri.ts**

```typescript
import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppAction, VersionEntry, LaunchState } from "../state/appReducer";

export function useTauri(dispatch: React.Dispatch<AppAction>) {
  const fetchVersions = useCallback(async () => {
    try {
      const versions = await invoke<VersionEntry[]>("get_versions");
      dispatch({ type: "SET_VERSIONS", payload: versions });
    } catch (e) {
      console.error("Failed to fetch versions:", e);
    }
  }, [dispatch]);

  const startGame = useCallback(
    async (versionId: string, javaPath: string, maxMemory: number, username: string) => {
      try {
        await invoke("start_game", {
          versionId,
          javaPath,
          maxMemoryMb: maxMemory,
          username,
          uuid: "00000000-0000-0000-0000-000000000000",
        });
      } catch (e) {
        console.error("Launch failed:", e);
      }
    },
    []
  );

  useEffect(() => {
    const unlisten = listen<LaunchState>("launch-state", (event) => {
      dispatch({ type: "SET_LAUNCH_STATE", payload: event.payload });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [dispatch]);

  return { fetchVersions, startGame };
}
```

- [ ] **Step 3: Write App.tsx**

```tsx
import { useReducer, useEffect } from "react";
import { appReducer, initialAppState } from "./state/appReducer";
import { useTauri } from "./hooks/useTauri";
import HomePage from "./pages/HomePage";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { fetchVersions, startGame } = useTauri(dispatch);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return (
    <div className="app">
      <HomePage
        state={state}
        dispatch={dispatch}
        onStartGame={startGame}
        onRefreshVersions={fetchVersions}
      />
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Write App.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/state/ src/hooks/ src/App.tsx src/App.css
git commit -m "feat: add frontend state management, Tauri bridge, and App shell"
```

---

### Task 11: Build HomePage component

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/HomePage.css`

- [ ] **Step 1: Write HomePage.tsx**

```tsx
import { AppState, AppAction } from "../state/appReducer";
import "./HomePage.css";

interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onStartGame: (versionId: string, javaPath: string, maxMemory: number, username: string) => void;
  onRefreshVersions: () => void;
}

function HomePage({ state, dispatch, onStartGame, onRefreshVersions }: Props) {
  const { versions, selectedVersion, launchState, auth, javaPath, maxMemory } = state;
  const isLaunching = launchState.state !== "Idle" &&
    launchState.state !== "Exited" &&
    launchState.state !== "Crashed" &&
    launchState.state !== "Error";

  const getButtonLabel = () => {
    switch (launchState.state) {
      case "Checking": return "检查中...";
      case "Downloading": {
        const pct = launchState.total_files && launchState.total_files > 0
          ? Math.round((launchState.completed_files! / launchState.total_files) * 100)
          : 0;
        return `下载中 ${pct}%`;
      }
      case "Validating": return "校验中...";
      case "Launching": return "启动中...";
      case "Running": return "游戏运行中";
      case "Crashed": return "游戏崩溃了";
      default: return "开始游戏";
    }
  };

  const handleLaunch = () => {
    if (isLaunching) return;
    const jp = javaPath || "java";
    const username = auth.loggedIn ? auth.username : "Player";
    onStartGame(selectedVersion, jp, maxMemory, username);
  };

  const isBusy = launchState.state === "Downloading";

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-title">BonNext</h1>
        <button className="refresh-btn" onClick={onRefreshVersions} title="刷新版本列表">
          ↻
        </button>
      </header>

      <main className="home-main">
        {auth.loggedIn && (
          <div className="player-info">
            <span className="player-name">{auth.username}</span>
          </div>
        )}

        <div className="version-section">
          <label className="version-label">Minecraft 版本</label>
          <select
            className="version-select"
            value={selectedVersion}
            onChange={(e) =>
              dispatch({ type: "SET_SELECTED_VERSION", payload: e.target.value })
            }
            disabled={isLaunching}
          >
            {versions
              .filter((v) => v.version_type === "release")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
          </select>
        </div>

        <button
          className={`launch-btn ${isLaunching ? "launch-btn--busy" : ""}`}
          onClick={handleLaunch}
          disabled={isLaunching || !selectedVersion}
        >
          {getButtonLabel()}
        </button>

        {launchState.state === "Crashed" && launchState.reason && (
          <div className="crash-info">
            <p>游戏崩溃了 (退出码: {launchState.code})</p>
            <pre className="crash-reason">{launchState.reason.slice(0, 500)}</pre>
          </div>
        )}

        {launchState.state === "Error" && launchState.message && (
          <div className="error-info">
            <p>错误: {launchState.message}</p>
          </div>
        )}

        {launchState.state === "Downloading" && (
          <div className="download-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: launchState.total_files && launchState.total_files > 0
                    ? `${(launchState.completed_files! / launchState.total_files) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <p className="progress-text">
              {launchState.completed_files}/{launchState.total_files} 文件
              {launchState.current_file && ` — ${launchState.current_file}`}
            </p>
          </div>
        )}

        {launchState.state === "Running" && (
          <p className="running-text">游戏正在运行中... 享受游戏吧！</p>
        )}

        {launchState.state === "Exited" && (
          <p className="exited-text">游戏已退出</p>
        )}
      </main>

      <footer className="home-footer">
        <button className="footer-btn" onClick={() => {}}>
          ⚙ 设置
        </button>
      </footer>
    </div>
  );
}

export default HomePage;
```

- [ ] **Step 2: Write HomePage.css**

```css
.home-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.home-title {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(90deg, #00d2ff, #3a7bd5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.refresh-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 20px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.home-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-name {
  font-size: 18px;
  font-weight: 600;
}

.version-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.version-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.version-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: #fff;
  padding: 12px 24px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  min-width: 240px;
  text-align: center;
  appearance: none;
  -webkit-appearance: none;
}

.version-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.version-select option {
  background: #1a1a2e;
  color: #fff;
}

.launch-btn {
  background: linear-gradient(135deg, #00d2ff, #3a7bd5);
  border: none;
  border-radius: 16px;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  padding: 16px 64px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(0, 210, 255, 0.3);
}

.launch-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 30px rgba(0, 210, 255, 0.5);
}

.launch-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.launch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.launch-btn--busy {
  background: linear-gradient(135deg, #555, #333);
  box-shadow: none;
}

.download-progress {
  width: 100%;
  max-width: 400px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d2ff, #3a7bd5);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.running-text {
  font-size: 16px;
  color: #4caf50;
}

.exited-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
}

.crash-info {
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 12px;
  padding: 16px;
  max-width: 500px;
  width: 100%;
}

.crash-reason {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.error-info {
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 12px;
  padding: 12px;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.home-footer {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}

.footer-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.footer-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/pages/
git commit -m "feat: add HomePage with version selector, launch button, progress, and crash display"
```

---

### Task 12: End-to-end test — launch Minecraft

- [ ] **Step 1: Run the app in dev mode**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tauri dev
```

Expected: Window opens showing the HomePage with version list.

- [ ] **Step 2: Select a version, click "Start Game"**

Expected: The launcher downloads the version files, then launches Minecraft.

- [ ] **Step 3: Verify game window opens and is playable**

Expected: Minecraft Java Edition window opens and the game is playable.

- [ ] **Step 4: Commit any fixes needed**

```bash
cd /Users/xiatian/Desktop/BonNext
git add -A
git commit -m "fix: end-to-end launch fixes"
```

---

## Phase 2: Authentication & UX

Phase 2 goal: Microsoft OAuth login, token persistence, offline mode, download progress UI, and logging.

### Task 13: Create auth module — Microsoft OAuth flow

**Files:**
- Create: `src-tauri/src/auth/mod.rs`
- Create: `src-tauri/src/auth/microsoft.rs`
- Create: `src-tauri/src/auth/session.rs`

- [ ] **Step 1: Write microsoft.rs**

```rust
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use url::Url;

const CLIENT_ID: &str = "00000000402b5328";
const REDIRECT_PORT: u16 = 36789;
const REDIRECT_URI: &str = "http://localhost:36789/callback";
const OAUTH_AUTHORIZE_URL: &str = "https://login.live.com/oauth20_authorize.srf";
const OAUTH_TOKEN_URL: &str = "https://login.live.com/oauth20_token.srf";
const XBOX_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_AUTH_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub access_token: String,
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub expires_at: u64,
}

fn start_callback_server() -> Result<TcpListener, LauncherError> {
    TcpListener::bind(format!("127.0.0.1:{}", REDIRECT_PORT))
        .map_err(|e| LauncherError::AuthFailed(format!("Failed to bind callback server: {}", e)))
}

fn get_auth_code(listener: TcpListener) -> Result<String, LauncherError> {
    listener
        .set_nonblocking(false)
        .map_err(|e| LauncherError::AuthFailed(e.to_string()))?;

    let (mut stream, _) = listener
        .accept()
        .map_err(|e| LauncherError::AuthFailed(format!("Failed to accept callback: {}", e)))?;

    use std::io::{BufRead, BufReader, Write};
    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| LauncherError::AuthFailed(e.to_string()))?;

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err(LauncherError::AuthFailed("Invalid callback request".to_string()));
    }

    let path = parts[1];
    let url = Url::parse(&format!("http://localhost{}", path))
        .map_err(|e| LauncherError::AuthFailed(e.to_string()))?;

    let code = url
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, val)| val.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No auth code in callback".to_string()))?;

    let response = if code.is_empty() {
        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>登录失败</h1><p>未收到授权码。请重试。</p></body></html>"
    } else {
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>登录成功!</h1><p>您可以关闭此页面并返回启动器。</p></body></html>"
    };

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    if code.is_empty() {
        return Err(LauncherError::AuthFailed("Empty auth code in callback".to_string()));
    }

    Ok(code)
}

async fn exchange_code_for_token(code: &str) -> Result<OAuthTokenResponse, LauncherError> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", REDIRECT_URI),
    ];

    let response = client
        .post(OAUTH_TOKEN_URL)
        .form(&params)
        .send()
        .await?
        .error_for_status()?;

    let token: OAuthTokenResponse = response.json().await?;
    Ok(token)
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

async fn xbox_live_auth(access_token: &str) -> Result<String, LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", access_token),
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT",
    });

    let response: serde_json::Value = client
        .post(XBOX_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    response["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No Xbox Live token".to_string()))
}

async fn xsts_auth(xbl_token: &str) -> Result<(String, String), LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token],
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT",
    });

    let response: serde_json::Value = client
        .post(XSTS_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let token = response["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No XSTS token".to_string()))?;

    let uhs = response["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No XSTS UHS".to_string()))?;

    Ok((token, uhs))
}

async fn minecraft_auth(uhs: &str, xsts_token: &str) -> Result<String, LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token),
    });

    let response: serde_json::Value = client
        .post(MC_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    response["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No Minecraft token".to_string()))
}

async fn get_minecraft_profile(mc_token: &str) -> Result<(String, String), LauncherError> {
    let client = reqwest::Client::new();
    let response: serde_json::Value = client
        .get(MC_PROFILE_URL)
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let username = response["name"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No username in profile".to_string()))?;

    let uuid = response["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No UUID in profile".to_string()))?;

    Ok((username, uuid))
}

pub async fn perform_full_auth() -> Result<AuthResult, LauncherError> {
    let auth_url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope=XboxLive.signin%20offline_access",
        OAUTH_AUTHORIZE_URL, CLIENT_ID, REDIRECT_URI
    );

    let listener = start_callback_server()?;
    webbrowser::open(&auth_url)
        .map_err(|e| LauncherError::AuthFailed(format!("Failed to open browser: {}", e)))?;

    let code = get_auth_code(listener)?;
    let token_response = exchange_code_for_token(&code).await?;
    let xbl_token = xbox_live_auth(&token_response.access_token).await?;
    let (xsts_token, uhs) = xsts_auth(&xbl_token).await?;
    let mc_token = minecraft_auth(&uhs, &xsts_token).await?;
    let (username, uuid) = get_minecraft_profile(&mc_token).await?;

    Ok(AuthResult {
        access_token: mc_token,
        refresh_token: token_response.refresh_token,
        username,
        uuid,
        expires_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            + token_response.expires_in,
    })
}
```

- [ ] **Step 2: Add `webbrowser` to Cargo.toml dependencies**

```toml
webbrowser = "1"
```

- [ ] **Step 3: Write session.rs**

```rust
use crate::auth::microsoft::AuthResult;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub expires_at: u64,
}

impl SavedSession {
    pub fn from_auth_result(result: &AuthResult) -> Self {
        Self {
            refresh_token: result.refresh_token.clone(),
            username: result.username.clone(),
            uuid: result.uuid.clone(),
            expires_at: result.expires_at,
        }
    }
}

pub fn save_session(path: &PathBuf, session: &SavedSession) -> Result<(), crate::error::LauncherError> {
    let json = serde_json::to_string_pretty(session)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, json)?;
    Ok(())
}

pub fn load_session(path: &PathBuf) -> Result<Option<SavedSession>, crate::error::LauncherError> {
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(path)?;
    let session: SavedSession = serde_json::from_str(&json)?;
    Ok(Some(session))
}

pub fn delete_session(path: &PathBuf) -> std::io::Result<()> {
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
```

- [ ] **Step 4: Write auth mod.rs**

```rust
pub mod microsoft;
pub mod session;
```

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/auth/ src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add Microsoft OAuth authentication module"
```

---

### Task 14: Add auth Tauri commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add auth commands to lib.rs**

Add these two new `#[tauri::command]` functions after the existing `start_game` command, and add `mod auth;` at the top:

In lib.rs, add to the module declarations at top:
```rust
mod auth;
```

Add these commands before the `run()` function:

```rust
#[tauri::command]
async fn microsoft_login(app: tauri::AppHandle) -> Result<AuthResultPayload, LauncherError> {
    let result = auth::microsoft::perform_full_auth().await?;

    let session = auth::session::SavedSession::from_auth_result(&result);
    let session_path = paths::get_game_dir().join("session.json");
    auth::session::save_session(&session_path, &session)?;

    let payload = AuthResultPayload {
        username: result.username.clone(),
        uuid: result.uuid.clone(),
    };

    let _ = app.emit("auth-state", &payload);
    Ok(payload)
}

#[derive(Debug, Clone, serde::Serialize)]
struct AuthResultPayload {
    username: String,
    uuid: String,
}

#[tauri::command]
async fn check_saved_session() -> Result<Option<SavedSessionData>, LauncherError> {
    let session_path = paths::get_game_dir().join("session.json");
    let session = auth::session::load_session(&session_path)?;
    Ok(session.map(|s| SavedSessionData {
        username: s.username,
        uuid: s.uuid,
    }))
}

#[derive(Debug, Clone, serde::Serialize)]
struct SavedSessionData {
    username: String,
    uuid: String,
}

#[tauri::command]
async fn offline_login(username: String) -> Result<AuthResultPayload, LauncherError> {
    let uuid = uuid::Uuid::new_v4().to_string();
    Ok(AuthResultPayload { username, uuid })
}

#[tauri::command]
async fn logout() -> Result<(), LauncherError> {
    let session_path = paths::get_game_dir().join("session.json");
    let _ = auth::session::delete_session(&session_path);
    Ok(())
}
```

Update the `invoke_handler` in `run()` to include the new commands:

```rust
.invoke_handler(tauri::generate_handler![
    get_versions,
    start_game,
    get_launch_state,
    microsoft_login,
    check_saved_session,
    offline_login,
    logout,
])
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/lib.rs
git commit -m "feat: add auth Tauri commands (login, logout, session check)"
```

---

### Task 15: Add React Router and LoginPage

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.css`

- [ ] **Step 1: Install react-router-dom**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm add react-router-dom
```

- [ ] **Step 2: Write LoginPage.tsx**

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./LoginPage.css";

interface Props {
  onLoginSuccess: (username: string, uuid: string) => void;
}

interface AuthPayload {
  username: string;
  uuid: string;
}

function LoginPage({ onLoginSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offlineName, setOfflineName] = useState("");
  const [showOffline, setShowOffline] = useState(false);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<AuthPayload>("microsoft_login");
      onLoginSuccess(result.username, result.uuid);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineLogin = async () => {
    if (!offlineName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await invoke<AuthPayload>("offline_login", {
        username: offlineName.trim(),
      });
      onLoginSuccess(result.username, result.uuid);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">BonNext</h1>
        <p className="login-subtitle">Minecraft 启动器</p>

        {!showOffline ? (
          <>
            <button
              className="login-btn login-btn--ms"
              onClick={handleMicrosoftLogin}
              disabled={loading}
            >
              {loading ? "登录中..." : "Microsoft 账号登录"}
            </button>
            <button
              className="login-link"
              onClick={() => setShowOffline(true)}
            >
              或跳过登录，使用离线模式
            </button>
          </>
        ) : (
          <div className="offline-form">
            <input
              className="offline-input"
              type="text"
              placeholder="输入玩家名"
              value={offlineName}
              onChange={(e) => setOfflineName(e.target.value)}
              maxLength={16}
            />
            <button
              className="login-btn"
              onClick={handleOfflineLogin}
              disabled={loading || !offlineName.trim()}
            >
              {loading ? "登录中..." : "离线模式进入"}
            </button>
            <button
              className="login-link"
              onClick={() => setShowOffline(false)}
            >
              返回
            </button>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;
```

- [ ] **Step 3: Write LoginPage.css**

```css
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 48px;
  min-width: 360px;
}

.login-title {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(90deg, #00d2ff, #3a7bd5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
}

.login-btn {
  background: linear-gradient(135deg, #00d2ff, #3a7bd5);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  padding: 14px 40px;
  cursor: pointer;
  transition: transform 0.15s;
  width: 100%;
}

.login-btn:hover:not(:disabled) {
  transform: scale(1.03);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-link {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
}

.login-link:hover {
  color: rgba(255, 255, 255, 0.7);
}

.offline-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.offline-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #fff;
  padding: 12px 16px;
  font-size: 16px;
  outline: none;
  text-align: center;
}

.offline-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.login-error {
  color: #f44336;
  font-size: 13px;
  text-align: center;
  max-width: 300px;
  word-break: break-all;
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/pages/LoginPage.tsx src/pages/LoginPage.css package.json pnpm-lock.yaml
git commit -m "feat: add LoginPage with Microsoft OAuth and offline mode"
```

---

### Task 16: Update App.tsx with routing and auth flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useTauri.ts`

- [ ] **Step 1: Update useTauri.ts to include auth event listener**

```typescript
import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppAction, VersionEntry, LaunchState } from "../state/appReducer";

interface AuthPayload {
  username: string;
  uuid: string;
}

export function useTauri(dispatch: React.Dispatch<AppAction>) {
  const fetchVersions = useCallback(async () => {
    try {
      const versions = await invoke<VersionEntry[]>("get_versions");
      dispatch({ type: "SET_VERSIONS", payload: versions });
    } catch (e) {
      console.error("Failed to fetch versions:", e);
    }
  }, [dispatch]);

  const startGame = useCallback(
    async (versionId: string, javaPath: string, maxMemory: number, username: string, uuid: string) => {
      try {
        await invoke("start_game", {
          versionId,
          javaPath,
          maxMemoryMb: maxMemory,
          username,
          uuid,
        });
      } catch (e) {
        console.error("Launch failed:", e);
      }
    },
    []
  );

  const checkSession = useCallback(async () => {
    try {
      const session = await invoke<AuthPayload | null>("check_saved_session");
      if (session) {
        dispatch({
          type: "SET_AUTH",
          payload: { username: session.username, uuid: session.uuid },
        });
      }
    } catch (e) {
      console.error("Failed to check session:", e);
    }
  }, [dispatch]);

  useEffect(() => {
    const unlistenLaunch = listen<LaunchState>("launch-state", (event) => {
      dispatch({ type: "SET_LAUNCH_STATE", payload: event.payload });
    });

    const unlistenAuth = listen<AuthPayload>("auth-state", (event) => {
      dispatch({
        type: "SET_AUTH",
        payload: { username: event.payload.username, uuid: event.payload.uuid },
      });
    });

    return () => {
      unlistenLaunch.then((fn) => fn());
      unlistenAuth.then((fn) => fn());
    };
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
      dispatch({ type: "LOGOUT" });
    } catch (e) {
      console.error("Failed to logout:", e);
    }
  }, [dispatch]);

  return { fetchVersions, startGame, checkSession, logout };
}
```

- [ ] **Step 2: Update App.tsx with routing**

```tsx
import { useReducer, useEffect } from "react";
import { appReducer, initialAppState } from "./state/appReducer";
import { useTauri } from "./hooks/useTauri";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { fetchVersions, startGame, checkSession, logout } = useTauri(dispatch);

  useEffect(() => {
    checkSession();
    fetchVersions();
  }, [checkSession, fetchVersions]);

  const handleLoginSuccess = (username: string, uuid: string) => {
    dispatch({ type: "SET_AUTH", payload: { username, uuid } });
  };

  if (!state.auth.loggedIn) {
    return (
      <div className="app">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="app">
      <HomePage
        state={state}
        dispatch={dispatch}
        onStartGame={startGame}
        onRefreshVersions={fetchVersions}
        onLogout={logout}
      />
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Update HomePage props to accept onLogout**

Update `src/pages/HomePage.tsx` props interface:

```tsx
interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onStartGame: (versionId: string, javaPath: string, maxMemory: number, username: string, uuid: string) => void;
  onRefreshVersions: () => void;
  onLogout: () => void;
}
```

And update the `handleLaunch` function to pass uuid:

```tsx
const handleLaunch = () => {
  if (isLaunching) return;
  const jp = javaPath || "java";
  const username = auth.loggedIn ? auth.username : "Player";
  onStartGame(selectedVersion, jp, maxMemory, username, auth.uuid || "00000000-0000-0000-0000-000000000000");
};
```

Add a logout button to the footer:

```tsx
<footer className="home-footer">
  <button className="footer-btn" onClick={() => {}}>
    ⚙ 设置
  </button>
  <button className="footer-btn" onClick={onLogout}>
    登出
  </button>
</footer>
```

Update the footer CSS to support two buttons:

```css
.home-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/App.tsx src/hooks/useTauri.ts src/pages/HomePage.tsx src/pages/HomePage.css
git commit -m "feat: add auth flow routing, session persistence, and logout"
```

---

### Task 17: Add logging system

**Files:**
- Create: `src-tauri/src/platform/logger.rs`

- [ ] **Step 1: Write logger.rs**

```rust
use crate::platform::paths;
use std::fs;
use std::path::PathBuf;
use tracing_appender::rolling::RollingFileAppender;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

const MAX_LOG_FILES: usize = 5;
const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024;

pub fn init_logger() {
    let log_dir = paths::get_logs_dir();
    let _ = fs::create_dir_all(&log_dir);

    let file_appender = RollingFileAppender::builder()
        .rotation(tracing_appender::rolling::Rotation::NEVER)
        .filename_prefix("launcher")
        .filename_suffix("log")
        .max_log_files(MAX_LOG_FILES)
        .build(&log_dir)
        .expect("Failed to create file appender");

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let subscriber = fmt::layer()
        .with_writer(non_blocking)
        .with_target(false)
        .with_thread_ids(false)
        .with_ansi(false);

    tracing_subscriber::registry()
        .with(subscriber.with_filter(filter))
        .init();
}

pub fn rotate_logs_if_needed(log_dir: &PathBuf) {
    let mut log_files: Vec<_> = match fs::read_dir(log_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .ends_with(".log")
            })
            .collect(),
        Err(_) => return,
    };

    log_files.sort_by_key(|e| {
        e.metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });

    while log_files.len() > MAX_LOG_FILES {
        if let Some(oldest) = log_files.first() {
            let _ = fs::remove_file(oldest.path());
            log_files.remove(0);
        }
    }
}
```

- [ ] **Step 2: Update platform/mod.rs**

```rust
pub mod paths;
pub mod logger;
```

- [ ] **Step 3: Initialize logger in lib.rs**

Add this at the beginning of the `run()` function in `lib.rs`:

```rust
platform::logger::init_logger();
```

Also add `tracing::info!("BonNext launcher starting");` after the logger init.

- [ ] **Step 4: Add tracing calls in key places**

In `start_game` command, add:
```rust
tracing::info!("Starting game: version={}, java={}", version_id, java_path);
```

In the download section, add:
```rust
tracing::info!("Downloading {} files ({} bytes total)", total_files, total_bytes);
```

In `launch_minecraft` in `process.rs`, add:
```rust
tracing::info!("Minecraft process started with PID {}", pid);
```

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/platform/logger.rs src-tauri/src/platform/mod.rs src-tauri/src/lib.rs src-tauri/src/launch/process.rs
git commit -m "feat: add file-based logging system with rotation"
```

---

## Phase 3: Polish

Phase 3 goal: Settings page, auto Java detection, config persistence, packaging.

### Task 18: Create user config persistence

**Files:**
- Create: `src-tauri/src/config.rs`

- [ ] **Step 1: Write config.rs**

```rust
use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    #[serde(default = "default_java_path")]
    pub java_path: String,
    #[serde(default = "default_max_memory")]
    pub max_memory_mb: u32,
    #[serde(default)]
    pub extra_jvm_args: Vec<String>,
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default)]
    pub launch_behavior: LaunchBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LaunchBehavior {
    Keep,
    Close,
    Minimize,
}

impl Default for LaunchBehavior {
    fn default() -> Self {
        LaunchBehavior::Keep
    }
}

fn default_java_path() -> String {
    "java".to_string()
}

fn default_max_memory() -> u32 {
    4096
}

fn default_window_width() -> u32 {
    854
}

fn default_window_height() -> u32 {
    480
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            java_path: default_java_path(),
            max_memory_mb: default_max_memory(),
            extra_jvm_args: Vec::new(),
            window_width: default_window_width(),
            window_height: default_window_height(),
            launch_behavior: LaunchBehavior::default(),
        }
    }
}

pub fn load_config() -> Result<UserConfig, LauncherError> {
    let path = paths::get_config_path();
    if !path.exists() {
        let default_config = UserConfig::default();
        save_config(&default_config)?;
        return Ok(default_config);
    }
    let json = std::fs::read_to_string(&path)?;
    let config: UserConfig = serde_json::from_str(&json)?;
    Ok(config)
}

pub fn save_config(config: &UserConfig) -> Result<(), LauncherError> {
    let path = paths::get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, json)?;
    Ok(())
}
```

- [ ] **Step 2: Add Tauri commands for config in lib.rs**

Add these commands to lib.rs:

```rust
#[tauri::command]
async fn get_config() -> Result<config::UserConfig, LauncherError> {
    config::load_config()
}

#[tauri::command]
async fn save_config(config: config::UserConfig) -> Result<(), LauncherError> {
    config::save_config(&config)
}
```

Add `mod config;` to module declarations and add the commands to the invoke handler.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/config.rs src-tauri/src/lib.rs
git commit -m "feat: add user config persistence with serde"
```

---

### Task 19: Create SettingsPage

**Files:**
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/pages/SettingsPage.css`

- [ ] **Step 1: Write SettingsPage.tsx**

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./SettingsPage.css";

interface UserConfig {
  java_path: string;
  max_memory_mb: number;
  extra_jvm_args: string[];
  window_width: number;
  window_height: number;
  launch_behavior: string;
}

interface Props {
  onBack: () => void;
  onSave: (config: UserConfig) => void;
}

function SettingsPage({ onBack, onSave }: Props) {
  const [config, setConfig] = useState<UserConfig>({
    java_path: "java",
    max_memory_mb: 4096,
    extra_jvm_args: [],
    window_width: 854,
    window_height: 480,
    launch_behavior: "Keep",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<UserConfig>("get_config")
      .then(setConfig)
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await invoke("save_config", { config });
      onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h2 className="settings-title">设置</h2>
      </header>

      <div className="settings-form">
        <div className="setting-group">
          <label>Java 路径</label>
          <input
            type="text"
            value={config.java_path}
            onChange={(e) => setConfig({ ...config, java_path: e.target.value })}
            placeholder="java 或完整路径"
          />
        </div>

        <div className="setting-group">
          <label>最大内存: {config.max_memory_mb} MB</label>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={config.max_memory_mb}
            onChange={(e) =>
              setConfig({ ...config, max_memory_mb: Number(e.target.value) })
            }
          />
          <div className="range-labels">
            <span>1 GB</span>
            <span>16 GB</span>
          </div>
        </div>

        <div className="setting-group">
          <label>窗口分辨率</label>
          <div className="resolution-inputs">
            <input
              type="number"
              value={config.window_width}
              onChange={(e) =>
                setConfig({ ...config, window_width: Number(e.target.value) })
              }
            />
            <span>×</span>
            <input
              type="number"
              value={config.window_height}
              onChange={(e) =>
                setConfig({ ...config, window_height: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="setting-group">
          <label>启动后行为</label>
          <select
            value={config.launch_behavior}
            onChange={(e) =>
              setConfig({ ...config, launch_behavior: e.target.value })
            }
          >
            <option value="Keep">保持启动器</option>
            <option value="Close">关闭启动器</option>
            <option value="Minimize">最小化到托盘</option>
          </select>
        </div>

        <div className="setting-group">
          <label>JVM 额外参数</label>
          <textarea
            value={config.extra_jvm_args.join("\n")}
            onChange={(e) =>
              setConfig({
                ...config,
                extra_jvm_args: e.target.value
                  .split("\n")
                  .filter((s) => s.trim()),
              })
            }
            placeholder="每行一个参数"
            rows={4}
          />
        </div>

        <button className="save-btn" onClick={handleSave}>
          {saved ? "已保存 ✓" : "保存设置"}
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
```

- [ ] **Step 2: Write SettingsPage.css**

```css
.settings-page {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #fff;
}

.settings-title {
  font-size: 24px;
  font-weight: 600;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 500px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-group label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.setting-group input[type="text"],
.setting-group input[type="number"],
.setting-group select,
.setting-group textarea {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #fff;
  padding: 10px 14px;
  font-size: 15px;
  outline: none;
}

.setting-group input[type="range"] {
  width: 100%;
  accent-color: #3a7bd5;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.resolution-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-inputs input {
  width: 100px;
}

.resolution-inputs span {
  color: rgba(255, 255, 255, 0.4);
}

.setting-group textarea {
  resize: vertical;
  font-family: monospace;
  font-size: 13px;
}

.save-btn {
  background: linear-gradient(135deg, #00d2ff, #3a7bd5);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  padding: 14px 32px;
  cursor: pointer;
  transition: transform 0.15s;
  align-self: flex-start;
}

.save-btn:hover {
  transform: scale(1.03);
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.css
git commit -m "feat: add SettingsPage with Java path, memory, resolution, and JVM args"
```

---

### Task 20: Wire settings into App navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Update App.tsx to support settings view**

```tsx
import { useReducer, useEffect, useState } from "react";
import { appReducer, initialAppState } from "./state/appReducer";
import { useTauri } from "./hooks/useTauri";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { fetchVersions, startGame, checkSession, logout } = useTauri(dispatch);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    checkSession();
    fetchVersions();
  }, [checkSession, fetchVersions]);

  const handleLoginSuccess = (username: string, uuid: string) => {
    dispatch({ type: "SET_AUTH", payload: { username, uuid } });
  };

  const handleConfigSaved = (config: any) => {
    dispatch({ type: "SET_JAVA_PATH", payload: config.java_path });
    dispatch({ type: "SET_MAX_MEMORY", payload: config.max_memory_mb });
    setShowSettings(false);
  };

  if (!state.auth.loggedIn) {
    return (
      <div className="app">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="app">
        <SettingsPage
          onBack={() => setShowSettings(false)}
          onSave={handleConfigSaved}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <HomePage
        state={state}
        dispatch={dispatch}
        onStartGame={startGame}
        onRefreshVersions={fetchVersions}
        onLogout={logout}
        onOpenSettings={() => setShowSettings(true)}
      />
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Update HomePage to accept onOpenSettings**

Update the props interface:

```tsx
interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onStartGame: (versionId: string, javaPath: string, maxMemory: number, username: string, uuid: string) => void;
  onRefreshVersions: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}
```

Update the footer to use `onOpenSettings`:

```tsx
<footer className="home-footer">
  <button className="footer-btn" onClick={onOpenSettings}>
    ⚙ 设置
  </button>
  <button className="footer-btn" onClick={onLogout}>
    登出
  </button>
</footer>
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src/App.tsx src/pages/HomePage.tsx
git commit -m "feat: wire settings page into app navigation"
```

---

### Task 21: Add auto Java detection

**Files:**
- Create: `src-tauri/src/platform/java.rs`

- [ ] **Step 1: Write java.rs**

```rust
use crate::error::LauncherError;
use crate::config::UserConfig;

#[cfg(target_os = "macos")]
pub fn find_java() -> Option<String> {
    use std::process::Command;

    let paths = [
        "/usr/bin/java",
        "/usr/local/bin/java",
        "/opt/homebrew/bin/java",
    ];

    for path in &paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    if let Ok(output) = Command::new("/usr/libexec/java_home").output() {
        if output.status.success() {
            let home = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let java_bin = std::path::Path::new(&home).join("bin").join("java");
            if java_bin.exists() {
                return Some(java_bin.to_string_lossy().to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
pub fn find_java() -> Option<String> {
    let paths = [
        "C:\\Program Files\\Java",
        "C:\\Program Files (x86)\\Java",
    ];

    for base in &paths {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let java_exe = entry.path().join("bin").join("java.exe");
                if java_exe.exists() {
                    return Some(java_exe.to_string_lossy().to_string());
                }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let java_exe = std::path::Path::new(&java_home).join("bin").join("java.exe");
        if java_exe.exists() {
            return Some(java_exe.to_string_lossy().to_string());
        }
    }

    None
}

pub fn validate_java(path: &str) -> Result<(), LauncherError> {
    let output = std::process::Command::new(path)
        .arg("-version")
        .output()
        .map_err(|_| LauncherError::JavaNotFound)?;

    if !output.status.success() {
        return Err(LauncherError::JavaNotFound);
    }

    Ok(())
}

pub fn auto_detect_and_set(config: &mut UserConfig) {
    if !config.java_path.is_empty() && config.java_path != "java" {
        if validate_java(&config.java_path).is_ok() {
            return;
        }
    }

    if let Some(found) = find_java() {
        tracing::info!("Auto-detected Java at: {}", found);
        config.java_path = found;
    }
}
```

- [ ] **Step 2: Update platform/mod.rs**

```rust
pub mod paths;
pub mod logger;
pub mod java;
```

- [ ] **Step 3: Add a Tauri command for auto-detection**

In lib.rs, add:

```rust
#[tauri::command]
async fn auto_detect_java() -> Result<String, LauncherError> {
    match platform::java::find_java() {
        Some(path) => Ok(path),
        None => Err(LauncherError::JavaNotFound),
    }
}
```

Add to invoke_handler.

- [ ] **Step 4: Use auto-detection on startup**

In the `get_config` command, after loading config, auto-detect:

```rust
#[tauri::command]
async fn get_config() -> Result<config::UserConfig, LauncherError> {
    let mut config = config::load_config()?;
    platform::java::auto_detect_and_set(&mut config);
    if config.java_path != "java" {
        let _ = config::save_config(&config);
    }
    Ok(config)
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/xiatian/Desktop/BonNext/src-tauri
cargo check
```

Expected: `Finished` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/src/platform/java.rs src-tauri/src/platform/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add auto Java detection for Windows and macOS"
```

---

### Task 22: Setup Tauri build configuration for distribution

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Update tauri.conf.json for production builds**

Read `src-tauri/tauri.conf.json`, then update these sections:

```json
{
  "productName": "BonNext",
  "version": "0.1.0",
  "identifier": "com.bonnext.launcher",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "BonNext",
        "width": 900,
        "height": 600,
        "minWidth": 700,
        "minHeight": 500,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 2: Generate default icons**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tauri icon --help
```

Follow the icon generation process or keep defaults for now.

- [ ] **Step 3: Test production build**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm tauri build
```

Expected: Build succeeds, producing a `.dmg` on macOS or `.msi`/`.exe` on Windows.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiatian/Desktop/BonNext
git add src-tauri/tauri.conf.json src-tauri/icons/
git commit -m "feat: configure Tauri bundle for distribution"
```

---