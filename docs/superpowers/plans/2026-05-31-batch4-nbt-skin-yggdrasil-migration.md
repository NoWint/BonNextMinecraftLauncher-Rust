# SCL Feature Integration — Batch 4: NBT + Skin + Yggdrasil + Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance NBT parsing for world info, add skin/cape management, enhance Yggdrasil with preset servers, and add launcher migration support for Prism/GDLauncher/XMCL.

**Architecture:** Enhancements to 4 existing modules, new settings section for skin management, new frontend components.

**Tech Stack:** Rust (fastnbt, reqwest multipart), TypeScript/React, CSS Modules

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/pages/settings/SkinAppearanceSection.tsx` | Skin & cape management UI |
| `src/components/ui/SkinPreview/SkinPreview.tsx` | Canvas-based 2D skin head render |
| `src/components/ui/SkinPreview/SkinPreview.module.css` | Skin preview styles |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/commands/world.rs` | Enhanced NBT parsing |
| `src-tauri/src/auth/yggdrasil.rs` | Preset servers + pluggable parsers |
| `src-tauri/src/auth/skin_server.rs` | Skin upload, cape equip/hide/reset |
| `src-tauri/src/instance/migration.rs` | Prism, GDLauncher, XMCL support |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/pages/settings/index.tsx` | Add SkinAppearanceSection |
| `src/api/auth.ts` | Add skin/cape API methods |

---

### Task 1: NBT Parsing Enhancement

**Files:**
- Modify: `src-tauri/src/commands/world.rs`

- [ ] **Step 1: Add 1.26+ world_gen_settings.dat seed reading**

In the `parse_level_dat_basic` function (or a new helper), add support for reading seed from `world_gen_settings.dat`:

```rust
fn parse_world_gen_settings_seed(data: &[u8]) -> Option<i64> {
    let cursor = std::io::Cursor::new(data);
    let mut nbt: fastnbt::Value = fastnbt::from_reader(cursor).ok()?;
    nbt.pointer("/data/seed")
        .and_then(|v| match v {
            fastnbt::Value::Long(l) => Some(*l),
            fastnbt::Value::String(s) => s.parse().ok(),
            _ => None,
        })
}
```

Add a new function to try reading from `world_gen_settings.dat` when `level.dat` doesn't contain a seed:

```rust
fn get_world_seed(instance_dir: &std::path::Path, world_name: &str) -> Option<i64> {
    let level_dat = instance_dir.join("saves").join(world_name).join("level.dat");
    if let Ok(data) = std::fs::read(&level_dat) {
        let decompressed = try_decompress_gzip(&data);
        let raw = decompressed.as_deref().unwrap_or(&data);
        if let Some(seed) = parse_seed_from_level_dat(raw) {
            return Some(seed);
        }
    }
    let wgs_path = instance_dir.join("saves").join(world_name)
        .join("data").join("minecraft").join("world_gen_settings.dat");
    if let Ok(data) = std::fs::read(&wgs_path) {
        let decompressed = try_decompress_gzip(&data);
        let raw = decompressed.as_deref().unwrap_or(&data);
        return parse_world_gen_settings_seed(raw);
    }
    None
}
```

- [ ] **Step 2: Add game mode and difficulty mapping**

```rust
fn game_mode_name(mode: &fastnbt::Value) -> String {
    match mode {
        fastnbt::Value::Int(0) | fastnbt::Value::String(s) if s == "survival" => "Survival".to_string(),
        fastnbt::Value::Int(1) | fastnbt::Value::String(s) if s == "creative" => "Creative".to_string(),
        fastnbt::Value::Int(2) | fastnbt::Value::String(s) if s == "adventure" => "Adventure".to_string(),
        fastnbt::Value::Int(3) | fastnbt::Value::String(s) if s == "spectator" => "Spectator".to_string(),
        fastnbt::Value::String(s) => s.clone(),
        _ => "Unknown".to_string(),
    }
}

fn difficulty_name(diff: &fastnbt::Value) -> String {
    match diff {
        fastnbt::Value::Int(0) | fastnbt::Value::String(s) if s == "peaceful" => "Peaceful".to_string(),
        fastnbt::Value::Int(1) | fastnbt::Value::String(s) if s == "easy" => "Easy".to_string(),
        fastnbt::Value::Int(2) | fastnbt::Value::String(s) if s == "normal" => "Normal".to_string(),
        fastnbt::Value::Int(3) | fastnbt::Value::String(s) if s == "hard" => "Hard".to_string(),
        fastnbt::Value::String(s) => s.clone(),
        _ => "Unknown".to_string(),
    }
}
```

- [ ] **Step 3: Update WorldInfo struct to include seed, game_mode_name, difficulty_name**

Add fields to the `WorldInfo` return type and populate them in `list_instance_saves`.

- [ ] **Step 4: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/world.rs
git commit -m "feat: enhance NBT parsing with seed, game mode, difficulty for 1.26+"
```

---

### Task 2: Skin & Cape Management (Rust)

**Files:**
- Modify: `src-tauri/src/auth/skin_server.rs`

- [ ] **Step 1: Add Mojang skin management functions**

Add these functions to `skin_server.rs`:

```rust
use reqwest::multipart;

pub async fn upload_skin_mojang(
    access_token: &str,
    file_path: &str,
    variant: &str,
) -> Result<(), LauncherError> {
    let file_data = std::fs::read(file_path)
        .map_err(|e| LauncherError::Io(e))?;
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("skin.png")
        .to_string();
    let client = crate::http_client::build_client()?;
    let part = multipart::Part::bytes(file_data)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| LauncherError::AuthFailed(format!("MIME error: {}", e)))?;
    let form = multipart::Form::new()
        .part("file", part)
        .text("variant", variant.to_string());
    let resp = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .bearer_auth(access_token)
        .multipart(form)
        .send()
        .await
        .map_err(LauncherError::Http)?;
    match resp.status().as_u16() {
        200..=204 => Ok(()),
        400 => Err(LauncherError::AuthFailed("Invalid skin file".to_string())),
        401 => Err(LauncherError::AuthExpired("Token expired".to_string())),
        403 => Err(LauncherError::AuthFailed("Not allowed".to_string())),
        429 => Err(LauncherError::RateLimited { retry_after: None }),
        s => Err(LauncherError::AuthFailed(format!("Upload failed: HTTP {}", s))),
    }
}

pub async fn reset_skin_mojang(access_token: &str) -> Result<(), LauncherError> {
    let client = crate::http_client::build_client()?;
    let resp = client
        .delete("https://api.minecraftservices.com/minecraft/profile/skins/active")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(LauncherError::Http)?;
    if resp.status().is_success() { Ok(()) } else { Err(LauncherError::AuthFailed("Reset skin failed".to_string())) }
}

pub async fn equip_cape_mojang(access_token: &str, cape_id: &str) -> Result<(), LauncherError> {
    let client = crate::http_client::build_client()?;
    let resp = client
        .put("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(access_token)
        .json(&serde_json::json!({ "capeId": cape_id }))
        .send()
        .await
        .map_err(LauncherError::Http)?;
    if resp.status().is_success() { Ok(()) } else { Err(LauncherError::AuthFailed("Equip cape failed".to_string())) }
}

pub async fn hide_cape_mojang(access_token: &str) -> Result<(), LauncherError> {
    let client = crate::http_client::build_client()?;
    let resp = client
        .delete("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(LauncherError::Http)?;
    if resp.status().is_success() { Ok(()) } else { Err(LauncherError::AuthFailed("Hide cape failed".to_string())) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<MojangSkin>,
    pub capes: Vec<MojangCape>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangSkin {
    pub id: String,
    pub state: String,
    pub url: String,
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangCape {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

pub async fn get_mojang_profile(access_token: &str) -> Result<MojangProfile, LauncherError> {
    let client = crate::http_client::build_client()?;
    let resp = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(LauncherError::Http)?;
    resp.json().await.map_err(|e| LauncherError::AuthFailed(format!("Parse profile failed: {}", e)))
}
```

- [ ] **Step 2: Add Tauri commands**

```rust
#[tauri::command]
async fn upload_skin(access_token: String, file_path: String, variant: String) -> Result<(), String> {
    crate::auth::skin_server::upload_skin_mojang(&access_token, &file_path, &variant).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_skin(access_token: String) -> Result<(), String> {
    crate::auth::skin_server::reset_skin_mojang(&access_token).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn equip_cape(access_token: String, cape_id: String) -> Result<(), String> {
    crate::auth::skin_server::equip_cape_mojang(&access_token, &cape_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_cape(access_token: String) -> Result<(), String> {
    crate::auth::skin_server::hide_cape_mojang(&access_token).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_mojang_profile(access_token: String) -> Result<crate::auth::skin_server::MojangProfile, String> {
    crate::auth::skin_server::get_mojang_profile(&access_token).await.map_err(|e| e.to_string())
}
```

Register all in `generate_handler![]`.

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/auth/skin_server.rs src-tauri/src/lib.rs
git commit -m "feat: add Mojang skin upload, cape equip/hide, profile fetch"
```

---

### Task 3: Skin & Cape Frontend (Settings Section)

**Files:**
- Create: `src/pages/settings/SkinAppearanceSection.tsx`
- Create: `src/components/ui/SkinPreview/SkinPreview.tsx`
- Create: `src/components/ui/SkinPreview/SkinPreview.module.css`
- Modify: `src/pages/settings/index.tsx`
- Modify: `src/api/auth.ts`

- [ ] **Step 1: Add skin API methods to auth.ts**

```typescript
export async function uploadSkin(accessToken: string, filePath: string, variant: string): Promise<void> {
  return invoke('upload_skin', { accessToken, filePath, variant });
}

export async function resetSkin(accessToken: string): Promise<void> {
  return invoke('reset_skin', { accessToken });
}

export async function equipCape(accessToken: string, capeId: string): Promise<void> {
  return invoke('equip_cape', { accessToken, capeId });
}

export async function hideCape(accessToken: string): Promise<void> {
  return invoke('hide_cape', { accessToken });
}

export interface MojangProfile {
  id: string;
  name: string;
  skins: { id: string; state: string; url: string; variant: string }[];
  capes: { id: string; state: string; url: string; alias: string }[];
}

export async function getMojangProfile(accessToken: string): Promise<MojangProfile> {
  return invoke<MojangProfile>('get_mojang_profile', { accessToken });
}
```

- [ ] **Step 2: Create SkinPreview component**

Use Canvas API to render the head portion of a Minecraft skin texture:

```tsx
import React, { useRef, useEffect } from 'react';
import styles from './SkinPreview.module.css';

interface Props {
  skinUrl: string | null;
  size?: number;
}

export default function SkinPreview({ skinUrl, size = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!skinUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
    };
    img.src = skinUrl;
  }, [skinUrl, size]);

  return <canvas ref={canvasRef} width={size} height={size} className={styles.canvas} />;
}
```

- [ ] **Step 3: Create SkinAppearanceSection**

Follow the existing `SectionCard` + `SettingRow` pattern:

- Current skin preview using SkinPreview component
- Upload skin button (file picker via Tauri dialog + classic/slim toggle)
- Cape selector dropdown (from profile capes list)
- Reset skin / hide cape buttons

- [ ] **Step 4: Add section to settings/index.tsx**

Import and render `<SkinAppearanceSection addToast={addToast} />`.

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/settings/SkinAppearanceSection.tsx src/components/ui/SkinPreview/ src/pages/settings/index.tsx src/api/auth.ts
git commit -m "feat: add skin & cape management settings section"
```

---

### Task 4: Yggdrasil Preset Servers Enhancement

**Files:**
- Modify: `src-tauri/src/auth/yggdrasil.rs`

- [ ] **Step 1: Add preset server configurations**

Enhance the existing `get_presets()` function to return full server configurations:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilServerPreset {
    pub name: String,
    pub base_url: String,
    pub client_id: Option<String>,
    pub auth_mode: String,
}

pub fn get_server_presets() -> Vec<YggdrasilServerPreset> {
    vec![
        YggdrasilServerPreset {
            name: "LittleSkin".to_string(),
            base_url: "https://littleskin.cn/api/yggdrasil".to_string(),
            client_id: Some("1181".to_string()),
            auth_mode: "oauth2".to_string(),
        },
        YggdrasilServerPreset {
            name: "MUA 联盟".to_string(),
            base_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
            client_id: Some("34".to_string()),
            auth_mode: "oauth2".to_string(),
        },
        YggdrasilServerPreset {
            name: "Ely.by".to_string(),
            base_url: "https://account.ely.by/api/yggdrasil".to_string(),
            client_id: None,
            auth_mode: "password".to_string(),
        },
        YggdrasilServerPreset {
            name: "自定义".to_string(),
            base_url: String::new(),
            client_id: None,
            auth_mode: "password".to_string(),
        },
    ]
}
```

- [ ] **Step 2: Add pluggable profile parser trait**

```rust
pub trait YggdrasilProfileParser: Send + Sync {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError>;
}

pub struct GenericProfileParser;

impl YggdrasilProfileParser for GenericProfileParser {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError> {
        let value: serde_json::Value = serde_json::from_slice(data)
            .map_err(|e| LauncherError::AuthFailed(format!("Parse profiles failed: {}", e)))?;
        let profiles = if let Some(arr) = value["availableProfiles"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if value["id"].is_string() {
            vec![YggdrasilProfile {
                id: value["id"].as_str().unwrap_or_default().to_string(),
                name: value["name"].as_str().unwrap_or_default().to_string(),
            }]
        } else {
            vec![]
        };
        Ok(profiles)
    }
}
```

- [ ] **Step 3: Add Tauri command**

```rust
#[tauri::command]
fn get_yggdrasil_presets() -> Vec<crate::auth::yggdrasil::YggdrasilServerPreset> {
    crate::auth::yggdrasil::get_server_presets()
}
```

Register in `generate_handler![]`.

- [ ] **Step 4: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/auth/yggdrasil.rs src-tauri/src/lib.rs
git commit -m "feat: add Yggdrasil preset servers and pluggable profile parser"
```

---

### Task 5: Launcher Instance Migration Enhancement

**Files:**
- Modify: `src-tauri/src/instance/migration.rs`

- [ ] **Step 1: Add Prism Launcher parser**

Prism uses the same format as MultiMC (`mmc-pack.json` + `instance.cfg`). The existing MultiMC parser should already handle this. Verify and add explicit detection:

```rust
fn detect_prism_launcher() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let candidates = vec![
        home.join(".local/share/PrismLauncher"),
        home.join("Library/Application Support/PrismLauncher"),
    ];
    candidates.into_iter().find(|p| p.join("instances").exists())
}
```

Add `"Prism Launcher"` to the `DetectedLauncher` enum and detection logic.

- [ ] **Step 2: Add GDLauncher parser**

```rust
fn parse_gdlauncher_instance(path: &Path) -> Result<MigrateableInstance, LauncherError> {
    let config_path = path.join("instance.json");
    let data = std::fs::read_to_string(&config_path)
        .map_err(|e| LauncherError::Io(e))?;
    let json: serde_json::Value = serde_json::from_str(&data)
        .map_err(|e| LauncherError::Json(e))?;
    Ok(MigrateableInstance {
        name: json["name"].as_str().unwrap_or("Unknown").to_string(),
        game_version: json["mcVersion"].as_str()
            .or(json["minecraftVersion"].as_str())
            .unwrap_or("unknown")
            .to_string(),
        mod_loader: json["loader"].as_str().unwrap_or("").to_string(),
        mod_loader_version: json["loaderVersion"].as_str().unwrap_or("").to_string(),
        source_path: path.to_path_buf(),
        launcher_type: "GDLauncher".to_string(),
        icon_path: None,
    })
}
```

- [ ] **Step 3: Add XMCL parser**

```rust
fn parse_xmcl_instance(path: &Path) -> Result<MigrateableInstance, LauncherError> {
    let config_path = path.join("instance.json");
    if !config_path.exists() {
        return Err(LauncherError::InvalidConfig("Not an XMCL instance".to_string()));
    }
    let data = std::fs::read_to_string(&config_path)
        .map_err(|e| LauncherError::Io(e))?;
    let json: serde_json::Value = serde_json::from_str(&data)
        .map_err(|e| LauncherError::Json(e))?;
    Ok(MigrateableInstance {
        name: json["name"].as_str().unwrap_or("Unknown").to_string(),
        game_version: json["runtime"]["minecraft"].as_str().unwrap_or("unknown").to_string(),
        mod_loader: json["runtime"]["forge"].as_str()
            .or(json["runtime"]["fabric"].as_str())
            .or(json["runtime"]["quilt"].as_str())
            .unwrap_or("")
            .to_string(),
        mod_loader_version: String::new(),
        source_path: path.to_path_buf(),
        launcher_type: "XMCL".to_string(),
        icon_path: None,
    })
}
```

- [ ] **Step 4: Update detect_installed_launchers and scan_launcher_instances**

Add detection for Prism, GDLauncher, and XMCL directories. Update `scan_launcher_instances` to route to the appropriate parser.

- [ ] **Step 5: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/instance/migration.rs
git commit -m "feat: add Prism, GDLauncher, XMCL migration support"
```

---

### Task 6: Frontend Yggdrasil & Migration UI

**Files:**
- Modify: `src/pages/settings/SkinStationSection.tsx` (enhance Yggdrasil server selector)
- Modify: `src/pages/NewInstancePage/` (add import from other launchers)

- [ ] **Step 1: Enhance SkinStationSection with Yggdrasil presets**

Update the existing SkinStationSection to use the new `get_yggdrasil_presets` API for a dropdown of preset servers instead of hardcoded values.

- [ ] **Step 2: Add import section to NewInstancePage**

Add an "Import from other launcher" section that:
- Calls `detect_installed_launchers` API
- Shows detected launchers with instance counts
- Clicking a launcher shows its instances
- Each instance has an "Import" button

- [ ] **Step 3: Run full check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/SkinStationSection.tsx src/pages/NewInstancePage/
git commit -m "feat: enhance Yggdrasil presets UI and launcher import flow"
```

---

## Self-Review

1. **Spec coverage**: F6 (NBT) ✅, F7 (Skin) ✅, F8 (Yggdrasil) ✅, F10 (Migration) ✅
2. **Placeholder scan**: Task 5 Steps 1-4 have some descriptive steps instead of full code — this is because the existing `migration.rs` is 1059 lines and the exact integration points depend on the current code structure. The implementer should read the existing code and add parsers following the established pattern.
3. **Type consistency**: `YggdrasilServerPreset`, `MojangProfile`, `MojangSkin`, `MojangCape` consistent across Rust and TypeScript
4. **Gap**: The `SkinPreview` component's second `drawImage` call overlays the hat layer — this is correct for Minecraft skin rendering.
