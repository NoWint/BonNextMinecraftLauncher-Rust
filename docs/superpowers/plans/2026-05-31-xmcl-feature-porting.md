# XMCL Feature Porting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port four features from XMCL (x-minecraft-launcher) into BonNext: TextComponent rendering, Quilt/NeoForge loader support, NBT parser + world management, and WebRTC P2P multiplayer.

**Architecture:** Four independent features implemented in priority order. Each feature is self-contained and produces working, testable software. TextComponent is pure frontend; Quilt/NeoForge and NBT are Rust backend + frontend; WebRTC is full-stack.

**Tech Stack:** Rust (fastnbt, str0m), TypeScript/React, Tauri v2 IPC

**Reference:** XMCL source at `/Users/xiatian/Desktop/xmcl-reference`

---

## Plan 1: TextComponent Rendering

### Task 1.1: Create TextComponent utility module

**Files:**
- Create: `src/utils/textComponent.ts`

- [ ] **Step 1: Create the TextComponent types and color map**

```typescript
export interface TextComponent {
  text: string;
  translate?: string;
  with?: string[];
  extra?: TextComponent[];
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  insertion?: string;
  clickEvent?: { action: string; value: string };
  hoverEvent?: { action: string; value: string | TextComponent };
}

export interface TextStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

export const MC_COLOR_MAP: Record<string, string> = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF',
  reset: '#FFFFFF',
};

const FORMAT_CODES = '0123456789abcdefklmnor';

const CODE_TO_COLOR: Record<string, string> = {
  '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua',
  '4': 'dark_red', '5': 'dark_purple', '6': 'gold', '7': 'gray',
  '8': 'dark_gray', '9': 'blue', 'a': 'green', 'b': 'aqua',
  'c': 'red', 'd': 'light_purple', 'e': 'yellow', 'f': 'white',
};

export function parseFormattedString(str: string): TextComponent {
  const firstCode = str.indexOf('\u00A7');
  if (firstCode === -1) {
    return { text: str };
  }

  const root: TextComponent = { text: str.substring(0, firstCode) };
  let builder = '';
  const style: TextStyle = {
    bold: false, obfuscated: false, strikethrough: false,
    underlined: false, italic: false, color: undefined,
  };

  for (let i = firstCode; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0xA7 && i + 1 < str.length) {
      if (builder.length !== 0) {
        if (!root.extra) root.extra = [];
        root.extra.push({ text: builder, ...style });
        builder = '';
      }
      const formatChar = str.charAt(i + 1).toLowerCase();
      const colorName = CODE_TO_COLOR[formatChar];
      if (colorName) {
        style.color = colorName;
        style.bold = false; style.italic = false;
        style.underlined = false; style.strikethrough = false;
        style.obfuscated = false;
      } else {
        switch (formatChar) {
          case 'k': style.obfuscated = true; break;
          case 'l': style.bold = true; break;
          case 'm': style.strikethrough = true; break;
          case 'n': style.underlined = true; break;
          case 'o': style.italic = true; break;
          case 'r':
            style.bold = false; style.italic = false;
            style.underlined = false; style.strikethrough = false;
            style.obfuscated = false; style.color = undefined;
            break;
        }
      }
      i++;
    } else {
      builder += str[i];
    }
  }
  if (builder.length !== 0) {
    if (!root.extra) root.extra = [];
    root.extra.push({ text: builder, ...style });
  }
  return root;
}

export function toFormattedString(comp: TextComponent): string {
  let result = '';
  const parts = flatComponents(comp);
  for (const part of parts) {
    const text = part.text;
    if (text.length !== 0) {
      if (part.color && MC_COLOR_MAP[part.color]) {
        const idx = Object.keys(CODE_TO_COLOR).find(k => CODE_TO_COLOR[k] === part.color);
        if (idx) result += `\u00A7${idx}`;
      }
      if (part.bold) result += '\u00A7l';
      if (part.italic) result += '\u00A7o';
      if (part.underlined) result += '\u00A7n';
      if (part.strikethrough) result += '\u00A7m';
      if (part.obfuscated) result += '\u00A7k';
      result += text;
      result += '\u00A7r';
    }
  }
  return result;
}

function flatComponents(comp: TextComponent): TextComponent[] {
  const arr: TextComponent[] = [comp];
  if (comp.extra) {
    for (const child of comp.extra) {
      arr.push(...flatComponents(child));
    }
  }
  return arr;
}

export function resolveStyle(comp: TextComponent, parent?: TextStyle): TextStyle {
  return {
    color: comp.color ?? parent?.color,
    bold: comp.bold ?? parent?.bold ?? false,
    italic: comp.italic ?? parent?.italic ?? false,
    underlined: comp.underlined ?? parent?.underlined ?? false,
    strikethrough: comp.strikethrough ?? parent?.strikethrough ?? false,
    obfuscated: comp.obfuscated ?? parent?.obfuscated ?? false,
  };
}

export function styleToCSS(style: TextStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.color && MC_COLOR_MAP[style.color]) {
    css.color = MC_COLOR_MAP[style.color];
  }
  if (style.bold) css.fontWeight = 'bold';
  if (style.italic) css.fontStyle = 'italic';
  const decorations: string[] = [];
  if (style.underlined) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  if (decorations.length > 0) css.textDecoration = decorations.join(' ');
  return css;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/utils/textComponent.ts 2>&1 | head -5`
Expected: No errors

### Task 1.2: Create TextComponentRenderer component

**Files:**
- Create: `src/components/ui/TextComponentRenderer.tsx`
- Create: `src/components/ui/TextComponentRenderer.module.css`

- [ ] **Step 1: Create the CSS module**

```css
.obfuscated {
  animation: obfuscate 0.1s steps(2) infinite;
}

@keyframes obfuscate {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 2: Create the React component**

```tsx
import { type ReactNode, useMemo } from 'react';
import {
  type TextComponent,
  type TextStyle,
  parseFormattedString,
  resolveStyle,
  styleToCSS,
} from '../../utils/textComponent';
import styles from './TextComponentRenderer.module.css';

interface TextComponentRendererProps {
  component: TextComponent | string;
  className?: string;
}

export default function TextComponentRenderer({ component, className }: TextComponentRendererProps) {
  const parsed = useMemo(() => {
    if (typeof component === 'string') {
      if (component.includes('\u00A7')) {
        return parseFormattedString(component);
      }
      return { text: component };
    }
    return component;
  }, [component]);

  const nodes = renderNodes(parsed);
  return <span className={className}>{nodes}</span>;
}

function renderNodes(comp: TextComponent, parentStyle?: TextStyle): ReactNode[] {
  const style = resolveStyle(comp, parentStyle);
  const nodes: ReactNode[] = [];

  if (comp.text) {
    const css = styleToCSS(style);
    const isObfuscated = style.obfuscated;
    nodes.push(
      <span
        key={comp.text.slice(0, 20) + nodes.length}
        style={css}
        className={isObfuscated ? styles.obfuscated : undefined}
      >
        {comp.text}
      </span>
    );
  }

  if (comp.extra) {
    for (let i = 0; i < comp.extra.length; i++) {
      nodes.push(...renderNodes(comp.extra[i], style));
    }
  }

  return nodes;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors related to these files

### Task 1.3: Integrate TextComponentRenderer into ServersPage

**Files:**
- Modify: `src/pages/ServersPage/index.tsx`

- [ ] **Step 1: Replace extractDescription with TextComponentRenderer**

In `src/pages/ServersPage/index.tsx`:

Add import at top:
```typescript
import TextComponentRenderer from '../../components/ui/TextComponentRenderer';
```

Replace the `extractDescription` function (lines 26-34) with:
```typescript
function extractDescription(info: MinecraftServerInfo): string {
  if (!info) return '';
  if (typeof info.description === 'string') return info.description;
  if (info.description?.text) {
    const extras = info.description.extra?.map((e: { text: string; color?: string }) => e.text).join('') || '';
    return info.description.text + extras;
  }
  return '';
}
```

Keep `extractDescription` for the plain text fallback, but change the rendering in `ServerCard`:

Replace line 70 (`{desc && <div className={styles.card__desc}>{desc}</div>}`) with:
```tsx
{info?.description ? (
  <div className={styles.card__desc}>
    <TextComponentRenderer
      component={typeof info.description === 'string'
        ? { text: info.description }
        : info.description as any}
    />
  </div>
) : desc ? (
  <div className={styles.card__desc}>{desc}</div>
) : null}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors

### Task 1.4: Integrate TextComponentRenderer into LogViewer

**Files:**
- Modify: `src/components/ui/LogViewer.tsx`

- [ ] **Step 1: Add TextComponent rendering for log lines**

Add import at top of `LogViewer.tsx`:
```typescript
import TextComponentRenderer from './TextComponentRenderer';
import { parseFormattedString } from '../../utils/textComponent';
```

In the log line rendering section, find where individual log lines are rendered (the `<span>` with `getLevelClass` styling). Replace the text content rendering with:

```tsx
<span className={`${styles.logText} ${levelClass}`}>
  {line.text.includes('\u00A7') ? (
    <TextComponentRenderer component={line.text} />
  ) : (
    line.text
  )}
</span>
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/textComponent.ts src/components/ui/TextComponentRenderer.tsx src/components/ui/TextComponentRenderer.module.css src/pages/ServersPage/index.tsx src/components/ui/LogViewer.tsx
git commit -m "feat: add TextComponent rendering for Minecraft rich text (MOTD + logs)"
```

---

## Plan 2: Quilt / NeoForge Loader Support

### Task 2.1: Extend LoaderType enum and add quilt.rs

**Files:**
- Modify: `src-tauri/src/loader/mod.rs`
- Create: `src-tauri/src/loader/quilt.rs`

- [ ] **Step 1: Extend LoaderType enum in mod.rs**

In `src-tauri/src/loader/mod.rs`, replace the `LoaderType` enum and its impl:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoaderType {
    Fabric,
    Forge,
    Quilt,
    NeoForge,
}

impl LoaderType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "fabric" => Some(LoaderType::Fabric),
            "forge" => Some(LoaderType::Forge),
            "quilt" => Some(LoaderType::Quilt),
            "neoforge" | "neo_forge" => Some(LoaderType::NeoForge),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn name(&self) -> &'static str {
        match self {
            LoaderType::Fabric => "fabric",
            LoaderType::Forge => "forge",
            LoaderType::Quilt => "quilt",
            LoaderType::NeoForge => "neoforge",
        }
    }

    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            LoaderType::Fabric => "Fabric",
            LoaderType::Forge => "Forge",
            LoaderType::Quilt => "Quilt",
            LoaderType::NeoForge => "NeoForge",
        }
    }
}
```

Add `pub mod quilt;` and `pub mod neoforge;` to the module declarations.

Update `fetch_loader_versions` and `install_loader` match arms:

```rust
pub async fn fetch_loader_versions(
    loader_type: &LoaderType,
) -> Result<Vec<String>, LauncherError> {
    match loader_type {
        LoaderType::Fabric => fabric::fetch_versions().await,
        LoaderType::Forge => forge::fetch_versions().await,
        LoaderType::Quilt => quilt::fetch_versions().await,
        LoaderType::NeoForge => neoforge::fetch_versions().await,
    }
}

pub async fn install_loader(
    loader_type: &LoaderType,
    minecraft_version: &VersionDetails,
    loader_version: &str,
    instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    match loader_type {
        LoaderType::Fabric => fabric::install(minecraft_version, loader_version, instance_id).await,
        LoaderType::Forge => forge::install(minecraft_version, loader_version, instance_id).await,
        LoaderType::Quilt => quilt::install(minecraft_version, loader_version, instance_id).await,
        LoaderType::NeoForge => neoforge::install(minecraft_version, loader_version, instance_id).await,
    }
}
```

- [ ] **Step 2: Create quilt.rs**

Create `src-tauri/src/loader/quilt.rs`:

```rust
use serde::Deserialize;

use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const QUILT_META_URL: &str = "https://meta.quiltmc.org/v3";

#[derive(Debug, Deserialize)]
struct QuiltLoaderVersion {
    version: String,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct QuiltLoaderInfo {
    loader: QuiltLoaderDetail,
    #[allow(dead_code)]
    launcherMeta: QuiltLauncherMeta,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QuiltLoaderDetail {
    version: String,
    maven: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QuiltLauncherMeta {
    version: u32,
    #[serde(rename = "mainClass")]
    main_class: Option<serde_json::Value>,
    libraries: Option<serde_json::Value>,
}

pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();
    let versions: Vec<QuiltLoaderVersion> = client
        .get(format!("{}/versions/loader", QUILT_META_URL))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(versions.into_iter().map(|v| v.version).collect())
}

pub async fn install(
    minecraft_version: &VersionDetails,
    loader_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    let profile_url = format!(
        "{}/versions/loader/{}/{}",
        QUILT_META_URL, minecraft_version.id, loader_version
    );
    let profile: serde_json::Value = client
        .get(&profile_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let main_class = profile["launcherMeta"]["mainClass"]["client"]
        .as_str()
        .unwrap_or("org.quiltmc.loader.impl.launch.knot.KnotClient")
        .to_string();

    let mut extra_libraries = Vec::new();
    if let Some(libs) = profile["launcherMeta"]["libraries"]["client"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.quiltmc.net/repository/release/");
            if let Some(artifact) = parse_maven_lib(name, url) {
                extra_libraries.push(artifact);
            }
        }
    }

    if let Some(common_libs) = profile["launcherMeta"]["libraries"]["common"].as_array() {
        for lib in common_libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.quiltmc.net/repository/release/");
            if let Some(artifact) = parse_maven_lib(name, url) {
                if !extra_libraries.iter().any(|a: &LibraryArtifact| a.path == artifact.path) {
                    extra_libraries.push(artifact);
                }
            }
        }
    }

    let version_id = format!("quilt-loader-{}-{}", loader_version, minecraft_version.id);

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args: vec![],
        extra_game_args: vec![],
    })
}

fn parse_maven_lib(name: &str, base_url: &str) -> Option<LibraryArtifact> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { parts[3] } else { "" };

    let base = base_url.trim_end_matches('/');
    let jar_name = if classifier.is_empty() {
        format!("{}-{}.jar", artifact, version)
    } else {
        format!("{}-{}-{}.jar", artifact, version, classifier)
    };

    let path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
    let url = format!("{}/{}", base, path);

    Some(LibraryArtifact {
        path,
        sha1: String::new(),
        size: 0,
        url,
        is_native: false,
    })
}
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

### Task 2.2: Create neoforge.rs

**Files:**
- Create: `src-tauri/src/loader/neoforge.rs`

- [ ] **Step 1: Create neoforge.rs**

Create `src-tauri/src/loader/neoforge.rs`:

```rust
use serde::Deserialize;

use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const NEOFORGE_MAVEN_URL: &str = "https://maven.neoforged.net/releases";

#[derive(Debug, Deserialize)]
struct MavenMetadata {
    #[serde(rename = "versioning")]
    versioning: MavenVersioning,
}

#[derive(Debug, Deserialize)]
struct MavenVersioning {
    #[serde(rename = "versions")]
    versions: MavenVersions,
}

#[derive(Debug, Deserialize)]
struct MavenVersions {
    #[serde(rename = "version")]
    version: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct NeoForgeInstallProfile {
    #[serde(rename = "mainClass")]
    main_class: Option<String>,
    libraries: Option<Vec<NeoForgeLibrary>>,
    #[serde(rename = "arguments")]
    arguments: Option<NeoForgeArguments>,
    version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NeoForgeLibrary {
    name: String,
    downloads: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct NeoForgeArguments {
    game: Option<Vec<serde_json::Value>>,
    jvm: Option<Vec<serde_json::Value>>,
}

pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();
    let url = format!(
        "{}/net/neoforged/neoforge/maven-metadata.xml",
        NEOFORGE_MAVEN_URL
    );
    let text = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let metadata: MavenMetadata = quick_xml::de::from_str(&text)
        .map_err(|e| LauncherError::JsonError(e.to_string()))?;

    let versions: Vec<String> = metadata.versioning.versions.version
        .into_iter()
        .filter(|v| !v.contains("installer"))
        .rev()
        .take(50)
        .collect();

    Ok(versions)
}

pub async fn install(
    minecraft_version: &VersionDetails,
    loader_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    let neoforge_version = if loader_version.contains('-') {
        loader_version.to_string()
    } else {
        format!("{}-{}", minecraft_version.id, loader_version)
    };

    let profile_url = format!(
        "{}/net/neoforged/neoforge/{}/neoforge-{}-client.json",
        NEOFORGE_MAVEN_URL, neoforge_version, neoforge_version
    );

    let profile_result = client
        .get(&profile_url)
        .send()
        .await?;

    if !profile_result.status().is_success() {
        return Err(LauncherError::HttpError(format!(
            "Failed to fetch NeoForge profile: HTTP {} for {}",
            profile_result.status(), profile_url
        )));
    }

    let profile: serde_json::Value = profile_result.json().await?;

    let main_class = profile["mainClass"]
        .as_str()
        .unwrap_or("net.minecraftforge.bootstrap.ForgeBootstrap")
        .to_string();

    let mut extra_libraries = Vec::new();

    if let Some(libs) = profile["libraries"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() {
                continue;
            }

            if let Some(downloads) = lib["downloads"]["artifact"].as_object() {
                let path = downloads["path"].as_str().unwrap_or("").to_string();
                let url = downloads["url"].as_str().unwrap_or("").to_string();
                let sha1 = downloads["sha1"].as_str().unwrap_or("").to_string();
                let size = downloads["size"].as_u64().unwrap_or(0);

                if !path.is_empty() {
                    extra_libraries.push(LibraryArtifact {
                        path,
                        url,
                        sha1,
                        size,
                        is_native: false,
                    });
                    continue;
                }
            }

            let is_neoforge = name.starts_with("net.neoforged");
            let base_url = if is_neoforge {
                format!("{}/", NEOFORGE_MAVEN_URL)
            } else {
                "https://libraries.minecraft.net/".to_string()
            };

            if let Some(artifact) = parse_maven_lib(name, &base_url) {
                extra_libraries.push(artifact);
            }
        }
    }

    let mut extra_game_args = Vec::new();
    if let Some(game_args) = profile["arguments"]["game"].as_array() {
        for arg in game_args {
            if let Some(s) = arg.as_str() {
                extra_game_args.push(s.to_string());
            }
        }
    }
    if extra_game_args.is_empty() {
        extra_game_args.push("--launchTarget".to_string());
        extra_game_args.push("forgeclient".to_string());
    }

    let version_id = format!("neoforge-{}-{}", neoforge_version, minecraft_version.id);

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args: vec![],
        extra_game_args,
    })
}

fn parse_maven_lib(name: &str, base_url: &str) -> Option<LibraryArtifact> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { parts[3] } else { "" };

    let base = base_url.trim_end_matches('/');
    let jar_name = if classifier.is_empty() {
        format!("{}-{}.jar", artifact, version)
    } else {
        format!("{}-{}-{}.jar", artifact, version, classifier)
    };

    let path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
    let url = format!("{}/{}", base, path);

    Some(LibraryArtifact {
        path,
        sha1: String::new(),
        size: 0,
        url,
        is_native: false,
    })
}
```

- [ ] **Step 2: Add quick-xml dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
quick-xml = { version = "0.37", features = ["serialize"] }
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

### Task 2.3: Update frontend for Quilt/NeoForge

**Files:**
- Modify: `src/pages/NewInstancePage.tsx`
- Modify: `src/pages/InstanceDetailPage.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/InstancesPage.tsx`
- Modify: `src/components/ui/InstanceSelect.tsx`
- Modify: `src/components/MiniMode.tsx`

- [ ] **Step 1: Update NewInstancePage loader selector**

In `src/pages/NewInstancePage.tsx`, find the loader type `<select>` element. Add Quilt and NeoForge options:

Find the `<select>` with `value={loaderType}` and add options:
```tsx
<option value="quilt">Quilt</option>
<option value="neoforge">NeoForge</option>
```

- [ ] **Step 2: Update all getLoaderIcon/getLoaderLabel functions**

In `src/pages/InstanceDetailPage.tsx`, update `getLoaderIcon`:
```typescript
case 'quilt': return '\u{1F9F5}';
case 'neoforge': return '\u{2699}';
```

Update `getLoaderLabel`:
```typescript
case 'quilt': return 'Quilt';
case 'neoforge': return 'NeoForge';
```

In `src/pages/HomePage.tsx`, update `getLoaderIcon`:
```typescript
case 'quilt': return 'quilt';
case 'neoforge': return 'neoforge';
```

Update `getLoaderLabel`:
```typescript
case 'quilt': return 'Quilt';
case 'neoforge': return 'NeoForge';
```

In `src/pages/InstancesPage.tsx`, update `getLoaderClass`:
```typescript
function getLoaderClass(loader: string | null): string {
  if (loader === 'fabric') return 'fabric';
  if (loader === 'forge') return 'forge';
  if (loader === 'quilt') return 'quilt';
  if (loader === 'neoforge') return 'neoforge';
  return 'vanilla';
}
```

In `src/components/ui/InstanceSelect.tsx`, update `getLoaderLabel`:
```typescript
case 'quilt': return 'Quilt';
case 'neoforge': return 'NeoForge';
```

Update the icon logic (around line 52):
```typescript
selected?.loader_type === 'quilt'
  ? '\u{1F9F5}'
  : selected?.loader_type === 'neoforge'
  ? '\u{2699}'
  : selected?.loader_type === 'forge'
```

In `src/components/MiniMode.tsx`, update `getLoaderIcon`:
```typescript
case 'quilt': return '\u{1F9F5}';
case 'neoforge': return '\u{2699}';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/loader/ src/pages/ src/components/
git commit -m "feat: add Quilt and NeoForge loader support"
```

---

## Plan 3: NBT Parser + World Management

### Task 3.1: Create world NBT parsing module

**Files:**
- Create: `src-tauri/src/world/nbt.rs`
- Create: `src-tauri/src/world/level.rs`
- Create: `src-tauri/src/world/server_dat.rs`
- Modify: `src-tauri/src/world/mod.rs`

- [ ] **Step 1: Create nbt.rs utility**

```rust
use std::path::Path;
use serde::de::DeserializeOwned;
use crate::error::LauncherError;

pub fn read_gzip_nbt<T: DeserializeOwned>(path: &Path) -> Result<T, LauncherError> {
    let file = std::fs::File::open(path)
        .map_err(|e| LauncherError::IOError(e.to_string()))?;
    let decoder = flate2::read::GzDecoder::new(file);
    let result: T = fastnbt::from_reader(decoder)
        .map_err(|e| LauncherError::JsonError(format!("NBT parse error: {}", e)))?;
    Ok(result)
}
```

- [ ] **Step 2: Create level.rs**

```rust
use std::path::Path;
use serde::Deserialize;
use crate::error::LauncherError;
use super::nbt::read_gzip_nbt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct LevelRoot {
    #[serde(rename = "Data")]
    pub data: LevelData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct LevelData {
    #[serde(rename = "LevelName")]
    pub level_name: String,
    #[serde(rename = "GameType")]
    pub game_type: i32,
    #[serde(rename = "Difficulty")]
    pub difficulty: i32,
    #[serde(rename = "LastPlayed")]
    pub last_played: i64,
    #[serde(rename = "RandomSeed")]
    pub random_seed: i64,
    #[serde(rename = "SpawnX")]
    pub spawn_x: i32,
    #[serde(rename = "SpawnY")]
    pub spawn_y: i32,
    #[serde(rename = "SpawnZ")]
    pub spawn_z: i32,
    #[serde(rename = "Time")]
    pub time: i64,
    #[serde(rename = "DayTime")]
    pub day_time: i64,
    #[serde(rename = "SizeOnDisk")]
    pub size_on_disk: i64,
    #[serde(rename = "hardcore")]
    pub hardcore: i8,
    #[serde(rename = "initialized")]
    pub initialized: i8,
    #[serde(rename = "raining")]
    pub raining: i8,
    #[serde(rename = "thundering")]
    pub thundering: i8,
    #[serde(rename = "allowCommands")]
    pub allow_commands: i8,
    #[serde(rename = "Version")]
    pub version: Option<LevelVersion>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct LevelVersion {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Id")]
    pub id: i32,
    #[serde(rename = "Snapshot")]
    pub snapshot: i8,
}

pub fn read_level_data(save_dir: &Path) -> Result<LevelData, LauncherError> {
    let level_dat = save_dir.join("level.dat");
    if !level_dat.exists() {
        return Err(LauncherError::IOError(format!("level.dat not found: {:?}", level_dat)));
    }
    let root: LevelRoot = read_gzip_nbt(&level_dat)?;
    Ok(root.data)
}
```

- [ ] **Step 3: Create server_dat.rs**

```rust
use std::path::Path;
use serde::Deserialize;
use crate::error::LauncherError;
use super::nbt::read_gzip_nbt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ServersDatRoot {
    #[serde(rename = "servers")]
    pub servers: Vec<ServerEntryNbt>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ServerEntryNbt {
    #[serde(rename = "ip")]
    pub ip: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "icon")]
    pub icon: Option<String>,
    #[serde(rename = "acceptTextures")]
    pub accept_textures: Option<i8>,
}

pub fn read_server_dat(minecraft_dir: &Path) -> Result<Vec<ServerEntryNbt>, LauncherError> {
    let dat_path = minecraft_dir.join("servers.dat");
    if !dat_path.exists() {
        return Ok(vec![]);
    }
    let file = std::fs::File::open(&dat_path)
        .map_err(|e| LauncherError::IOError(e.to_string()))?;
    let root: ServersDatRoot = fastnbt::from_reader(file)
        .map_err(|e| LauncherError::JsonError(format!("NBT parse error: {}", e)))?;
    Ok(root.servers)
}
```

- [ ] **Step 4: Update world/mod.rs**

Add module declarations:
```rust
pub mod nbt;
pub mod level;
pub mod server_dat;
```

- [ ] **Step 5: Add flate2 dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
flate2 = "1"
```

- [ ] **Step 6: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

### Task 3.2: Add world management Tauri commands

**Files:**
- Modify: `src-tauri/src/commands/world.rs`
- Modify: `src-tauri/src/lib.rs` (register new commands)

- [ ] **Step 1: Add new commands to commands/world.rs**

Add these new command functions:

```rust
#[tauri::command]
pub async fn get_instance_saves_detail(instance_id: String) -> Result<Vec<WorldInfo>, String> {
    let config = crate::config::load_config().map_err(|e| e.to_string())?;
    let game_dir = std::path::PathBuf::from(config.game_dir.unwrap_or_default());
    let saves_dir = game_dir.join("instances").join(&instance_id).join(".minecraft").join("saves");

    if !saves_dir.exists() {
        return Ok(vec![]);
    }

    let mut worlds = Vec::new();
    let entries = std::fs::read_dir(&saves_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let path = entry.path();
            match crate::world::level::read_level_data(&path) {
                Ok(data) => {
                    let dir_size = get_dir_size(&path).unwrap_or(0);
                    worlds.push(WorldInfo {
                        dir_name: entry.file_name().to_string_lossy().to_string(),
                        level_name: data.level_name,
                        game_type: data.game_type,
                        difficulty: data.difficulty,
                        last_played: data.last_played,
                        random_seed: data.random_seed,
                        spawn_x: data.spawn_x,
                        spawn_y: data.spawn_y,
                        spawn_z: data.spawn_z,
                        time_played: data.time,
                        size_bytes: dir_size,
                        version_name: data.version.map(|v| v.name).unwrap_or_default(),
                        hardcore: data.hardcore != 0,
                    });
                }
                Err(_) => {
                    worlds.push(WorldInfo {
                        dir_name: entry.file_name().to_string_lossy().to_string(),
                        level_name: entry.file_name().to_string_lossy().to_string(),
                        game_type: 0, difficulty: 0, last_played: 0,
                        random_seed: 0, spawn_x: 0, spawn_y: 0, spawn_z: 0,
                        time_played: 0, size_bytes: 0, version_name: String::new(),
                        hardcore: false,
                    });
                }
            }
        }
    }

    worlds.sort_by(|a, b| b.last_played.cmp(&a.last_played));
    Ok(worlds)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct WorldInfo {
    pub dir_name: String,
    pub level_name: String,
    pub game_type: i32,
    pub difficulty: i32,
    pub last_played: i64,
    pub random_seed: i64,
    pub spawn_x: i32,
    pub spawn_y: i32,
    pub spawn_z: i32,
    pub time_played: i64,
    pub size_bytes: u64,
    pub version_name: String,
    pub hardcore: bool,
}

fn get_dir_size(path: &std::path::Path) -> std::io::Result<u64> {
    let mut size = 0;
    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let meta = entry.metadata()?;
            if meta.is_dir() {
                size += get_dir_size(&entry.path())?;
            } else {
                size += meta.len();
            }
        }
    }
    Ok(size)
}

#[tauri::command]
pub async fn export_world(instance_id: String, save_name: String, output_path: String) -> Result<String, String> {
    let config = crate::config::load_config().map_err(|e| e.to_string())?;
    let game_dir = std::path::PathBuf::from(config.game_dir.unwrap_or_default());
    let save_dir = game_dir.join("instances").join(&instance_id).join(".minecraft").join("saves").join(&save_name);

    if !save_dir.exists() {
        return Err(format!("World directory not found: {}", save_name));
    }

    let output = std::path::PathBuf::from(&output_path);
    let file = std::fs::File::create(&output).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip_dir(&save_dir, &mut zip, options, "")?;

    Ok(output_path)
}

fn zip_dir(
    dir: &std::path::Path,
    zip: &mut zip::ZipWriter<std::fs::File>,
    options: zip::write::SimpleFileOptions,
    prefix: &str,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = if prefix.is_empty() {
            entry.file_name().to_string_lossy().to_string()
        } else {
            format!("{}/{}", prefix, entry.file_name().to_string_lossy())
        };

        if path.is_dir() {
            zip.add_directory(&name, options).map_err(|e| e.to_string())?;
            zip_dir(&path, zip, options, &name)?;
        } else {
            zip.start_file(&name, options).map_err(|e| e.to_string())?;
            let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Add zip dependency to Cargo.toml**

```toml
zip = "2"
```

- [ ] **Step 3: Register new commands in lib.rs**

Add `get_instance_saves_detail` and `export_world` to the `invoke_handler` in `lib.rs`.

- [ ] **Step 4: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

### Task 3.3: Add frontend API and types for world management

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/index.ts`

- [ ] **Step 1: Add WorldInfo type to types.ts**

```typescript
export interface WorldInfo {
  dir_name: string;
  level_name: string;
  game_type: number;
  difficulty: number;
  last_played: number;
  random_seed: number;
  spawn_x: number;
  spawn_y: number;
  spawn_z: number;
  time_played: number;
  size_bytes: number;
  version_name: string;
  hardcore: boolean;
}
```

- [ ] **Step 2: Add API wrappers**

In the appropriate API module, add:
```typescript
export const getInstanceSavesDetail = (instanceId: string) =>
  invoke<WorldInfo[]>('get_instance_saves_detail', { instanceId });

export const exportWorld = (instanceId: string, saveName: string, outputPath: string) =>
  invoke<string>('export_world', { instanceId, saveName, outputPath });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/world/ src-tauri/Cargo.toml src/api/ src-tauri/src/commands/world.rs src-tauri/src/lib.rs
git commit -m "feat: add NBT parser and world management (level.dat, backup)"
```

---

## Plan 4: WebRTC P2P Multiplayer

### Task 4.1: Add str0m dependency and create p2p module skeleton

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/p2p/mod.rs`
- Create: `src-tauri/src/p2p/webrtc.rs`
- Create: `src-tauri/src/p2p/proxy.rs`
- Create: `src-tauri/src/p2p/signaling.rs`
- Create: `src-tauri/src/commands/p2p.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add str0m dependency**

In `src-tauri/Cargo.toml`, add:
```toml
str0m = "0.7"
tokio-util = { version = "0.7", features = ["compat"] }
```

- [ ] **Step 2: Create p2p/mod.rs**

```rust
pub mod webrtc;
pub mod proxy;
pub mod signaling;

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct P2PState {
    pub connections: Vec<PeerConnection>,
    pub signaling: Option<signaling::SignalingClient>,
    pub proxy: Option<proxy::MinecraftProxy>,
}

pub struct PeerConnection {
    pub peer_id: String,
    pub status: PeerStatus,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerStatus {
    Connecting,
    Connected,
    Disconnected,
    Failed,
}

impl P2PState {
    pub fn new() -> Self {
        Self {
            connections: Vec::new(),
            signaling: None,
            proxy: None,
        }
    }
}
```

- [ ] **Step 3: Create p2p/webrtc.rs stub**

```rust
pub struct WebRTCPeer {
    peer_id: String,
}

impl WebRTCPeer {
    pub fn new(peer_id: &str) -> Self {
        Self { peer_id: peer_id.to_string() }
    }
}
```

- [ ] **Step 4: Create p2p/proxy.rs stub**

```rust
pub struct MinecraftProxy {
    pub local_port: u16,
}

impl MinecraftProxy {
    pub async fn start(port: u16) -> Result<Self, crate::error::LauncherError> {
        Ok(Self { local_port: port })
    }

    pub async fn stop(&self) -> Result<(), crate::error::LauncherError> {
        Ok(())
    }
}
```

- [ ] **Step 5: Create p2p/signaling.rs stub**

```rust
pub struct SignalingClient {
    server_url: String,
}

impl SignalingClient {
    pub fn new(server_url: &str) -> Self {
        Self { server_url: server_url.to_string() }
    }

    pub async fn connect(&mut self) -> Result<(), crate::error::LauncherError> {
        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), crate::error::LauncherError> {
        Ok(())
    }
}
```

- [ ] **Step 6: Create commands/p2p.rs**

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::p2p::P2PState;

#[tauri::command]
pub async fn p2p_get_status(
    state: tauri::State<'_, Arc<Mutex<P2PState>>>,
) -> Result<serde_json::Value, String> {
    let p2p = state.lock().await;
    Ok(serde_json::json!({
        "connections": p2p.connections.len(),
        "signaling_connected": p2p.signaling.is_some(),
    }))
}
```

- [ ] **Step 7: Register module and state**

In `src-tauri/src/commands/mod.rs`, add: `pub mod p2p;`

In `src-tauri/src/lib.rs`, add `pub mod p2p;` and register the state and command.

- [ ] **Step 8: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/p2p/ src-tauri/src/commands/p2p.rs src-tauri/Cargo.toml src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add WebRTC P2P multiplayer module skeleton"
```

---

## Final Verification

- [ ] **Run full check**: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`
- [ ] **Run dev build**: `pnpm build` to verify full frontend + backend build
