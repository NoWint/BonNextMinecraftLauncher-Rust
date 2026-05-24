<div align="center">

<img src="public/bonnext-icon.svg" alt="BonNext" width="120" />

# BonNext

### The Next-Generation Minecraft Java Launcher · Neo-Tokyo Edition

[![Rust](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFE600.svg)](https://v2.tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Win%20%7C%20Mac%20%7C%20Linux-blue.svg)](#)

</div>

> A cyberpunk-inspired, cross-platform Minecraft launcher built with Rust and React. Features Microsoft OAuth, offline mode, multi-instance management, a built-in mod browser (Modrinth), Fabric/Forge support, and a high-performance parallel download engine — all wrapped in a stunning Neo-Tokyo aesthetic.

---

## Features

### Core Experience
- **🔐 Dual Authentication** — Microsoft OAuth 2.0 device-code flow with automatic token refresh, plus offline mode with deterministic UUIDs. Multi-account management with seamless switching.
- **📦 Smart Instance Management** — Create, configure, clone, and delete isolated Minecraft instances. Each instance has its own mods, saves, configs, resource packs, and shader packs — while sharing core libraries via hard links to save disk space. Instance snapshots, import/export, and config sharing via shareable codes.
- **⚡ High-Performance Downloads** — Parallel multi-threaded downloads with exponential backoff retry, SHA1 integrity verification, and automatic mirror failover (Official Mojang CDN → BMCLAPI → MCBBS). Download scheduler with speed limits and priority control.
- **🚀 One-Click Launch** — Automatic Java runtime detection (PATH, JAVA_HOME, macOS `/usr/libexec/java_home`, Windows registry), version dependency resolution with parent inheritance, native library extraction, and JVM argument construction with template expansion. JRE auto-download with multiple sources.
- **🧩 Mod Loader Integration** — First-class Fabric and Forge support. One-click loader installation during instance creation with automatic library resolution.
- **🛒 Dual Mod Browser** — Browse, search, and install mods from both **Modrinth** and **CurseForge** with one click. Filter by Minecraft version and mod loader. Gallery and list view modes.
- **🏪 Marketplace Hub** — Centralized content discovery with banners, categories, trending content, and recently updated items across all content types (mods, resource packs, shader packs, modpacks).
- **🎮 Real-Time Status Tracking** — Full launch state machine (Idle → Checking → Downloading → Validating → Launching → Running → Exited/Crashed/Error) with live progress events streamed from the backend.
- **🔍 NLP-Powered Search** — Natural language search with synonym expansion (including Chinese/English bilingual synonyms) and TF-IDF relevance scoring.
- **📊 Performance Analysis** — Frame time analysis from game logs, launch profiling, GC tuning recommendations, anomaly detection, and mod conflict checking.

### Social & Multiplayer
- **💬 Discord Rich Presence** — Show your current game status on Discord with automatic presence updates.
- **🌐 LAN Discovery** — Automatically discover Minecraft LAN worlds on your local network.
- **👥 Friends System** — Add, manage, and see online status of friends.
- **🔗 P2P File Sharing** — Share files directly with peers on your local network.

### Content & Library
- **📚 Content Library** — Per-instance installed content management with update checking and bulk updates.
- **❤️ Collections** — Save and organize your favorite content across sessions with wishlist functionality.
- **📸 Screenshot Manager** — Browse and manage in-game screenshots per instance.
- **📰 Minecraft News** — Read official Minecraft news articles directly in the launcher.
- **🏆 Achievements** — Unlock achievements as you use the launcher.

### System & Security
- **🖥️ Hardware Profiling** — Automatic hardware detection with performance scoring and memory tuning recommendations.
- **🔋 Battery Awareness** — Detect battery status for laptop-optimized behavior.
- **🛡️ Security Suite** — Credential encryption, JVM args whitelist validation, sandbox mode, file permission checking, audit logging, and security scoring.
- **🌐 Web API** — Local HTTP API for remote control and automation.
- **⌨️ CLI Mode** — Command-line interface for scripting and headless operation.
- **💾 Disk Usage Analytics** — Visual breakdown of disk usage across instances, versions, libraries, and assets.

### Design & UX
- **🌃 Neo-Tokyo Cyberpunk Aesthetic** — Dark theme with neon-yellow accents, geometric clip-path elements, and decorative bounding boxes. Multiple theme options (Dark, Light, OLED).
- **📺 Retro CRT Effects** — SVG noise overlay, scanline filter, and polygon-clipped UI elements for a unique visual identity.
- **✨ Micro-Interactions** — CSS animations, hover transitions, loading skeletons, toast notifications, and keyboard shortcuts throughout.
- **⌨️ Keyboard Shortcuts** — `Ctrl+H` Home, `Ctrl+I` Instances, `Ctrl+M` Mods, `Ctrl+N` New Instance, `Ctrl+V` Versions, `Ctrl+,` Settings.
- **🎨 Dynamic Backgrounds** — Choose from Minimal, Cyberpunk, Starfield, and Matrix background themes.
- **♿ Accessibility** — ARIA labels, keyboard navigation, focus-visible styles, skip-to-content link, and colorblind mode filters.
- **🇨🇳 Full Chinese Localization** — Native Chinese interface with bilingual support.
- **🎯 Mini Mode** — Compact always-on-top mini window for quick game launch while playing.
- **🖥️ Onboarding Wizard** — Guided tour for new users with spotlight overlay.

### Engineering Quality
- **🦀 Rust Backend** — Performance-critical paths in Rust with Tokio async runtime. Zero-cost abstractions, memory safety, and fearless concurrency.
- **⚛️ React 18 + TypeScript** — Type-safe frontend with React Context + useReducer for state management. CSS Modules for scoped styling.
- **🏗️ Tauri v2** — Lightweight desktop framework. 20x smaller than Electron. Native performance, native file dialogs, native window management.
- **🛡️ Error Resilience** — Comprehensive error handling with typed errors (thiserror), React Error Boundaries, and toast notification fallbacks.
- **📊 Structured Logging** — File-based rotating logs with tracing-subscriber. Game stdout/stderr drained to logs via background threads.
- **✅ Tested** — Unit tests on critical paths (config, auth, download verification, launch state transitions, version resolution).

## Quick Start

### Download

Get the latest release for your platform from the [Releases](https://github.com/bonnext/bonnext/releases) page.

| Platform | Package |
|----------|---------|
| Windows  | `.msi` / `.exe` |
| macOS    | `.dmg` (Universal — Intel + Apple Silicon) |
| Linux    | `.AppImage` / `.deb` |

### Build from Source

**Prerequisites:** Rust 1.80+, Node.js 20+, pnpm 9+

```bash
git clone https://github.com/bonnext/bonnext.git
cd bonnext

pnpm install          # Install frontend dependencies
pnpm tauri dev        # Run in development mode
pnpm tauri build      # Production build
```

### Quick Development Check

```bash
# TypeScript type check
npx tsc --noEmit

# Rust compile check (fast, no codegen)
cargo check --manifest-path src-tauri/Cargo.toml

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```

## Architecture

```
BonNext/
├── src/                              # React Frontend
│   ├── api.ts                        # Typed Tauri invoke wrappers
│   ├── App.tsx                       # Root component with routing & providers
│   ├── main.tsx                      # React entry point
│   ├── stores/                       # Global state (React Context + useReducer)
│   │   ├── authStore.tsx             # Auth state & account management
│   │   ├── configStore.tsx           # App configuration persistence
│   │   ├── instanceStore.tsx         # Instance CRUD operations
│   │   └── toastStore.tsx            # Toast notification system
│   ├── pages/                        # Page components
│   │   ├── LoginPage.tsx             # Microsoft OAuth + offline login
│   │   ├── HomePage.tsx              # Dashboard with launch panel & news
│   │   ├── InstancesPage.tsx         # Instance list with search & filters
│   │   ├── NewInstancePage.tsx       # Instance creation wizard
│   │   ├── InstanceDetailPage.tsx    # Instance overview & management
│   │   ├── VersionsPage.tsx          # Version browser & downloader
│   │   ├── ModsPage.tsx              # Modrinth mod browser & installer
│   │   └── SettingsPage.tsx          # Java, memory, game directory config
│   ├── components/                   # Reusable components
│   │   ├── layout/                   # Sidebar, Decorations (Heading, Ticker)
│   │   ├── ui/                       # Button, Inputs, Modal, Tabs, Toast, Skeleton, Status
│   │   └── ErrorBoundary.tsx         # React error boundary with recovery
│   ├── hooks/
│   │   └── useKeyboard.ts           # Global keyboard shortcut hook
│   └── styles/                       # Global CSS & design tokens
│       ├── global.css                # Base styles, scrollbar, overlays
│       └── tokens.css                # CSS custom properties, animations
│
└── src-tauri/                        # Rust Backend
    └── src/
        ├── lib.rs                    # Tauri command registration & app entry
        ├── main.rs                   # Binary entry point
        ├── error.rs                  # Unified error type (thiserror)
        ├── config.rs                 # App configuration (JSON persistence)
        ├── http_client.rs            # HTTP client factory (User-Agent, timeouts)
        ├── auth/                     # Authentication
        │   ├── mod.rs
        │   ├── microsoft.rs          # Microsoft OAuth 2.0 device flow
        │   ├── offline.rs            # Offline mode with v5 UUID
        │   └── token_store.rs        # Account persistence & token refresh
        ├── version/                  # Version management
        │   ├── mod.rs
        │   ├── manifest.rs           # Mojang version manifest API
        │   ├── resolver.rs           # Version JSON parsing & inheritance
        │   └── rules.rs              # OS/feature rule evaluation
        ├── download/                 # Download engine
        │   ├── mod.rs
        │   ├── queue.rs              # Parallel download queue with retry
        │   ├── source.rs             # Mirror source selection & URL transform
        │   └── verifier.rs           # SHA1 integrity verification
        ├── launch/                   # Game launching
        │   ├── mod.rs
        │   ├── args.rs               # JVM argument builder & template resolution
        │   ├── process.rs            # Process spawning with pipe draining
        │   └── state.rs              # Launch state machine
        ├── loader/                   # Mod loaders
        │   ├── mod.rs                # LoaderType enum & dispatcher
        │   ├── fabric.rs             # Fabric loader (meta.fabricmc.net)
        │   └── forge.rs              # Forge loader (maven.minecraftforge.net)
        ├── modrinth.rs               # Modrinth API integration
        ├── instance/                 # Instance management
        │   ├── mod.rs
        │   └── manager.rs            # Instance CRUD & directory structure
        └── platform/                 # Platform abstractions
            ├── mod.rs
            ├── java.rs               # Java detection (multi-strategy)
            ├── logger.rs             # Structured logging (file rotation)
            └── paths.rs              # Cross-platform path management
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Framework | Tauri 2.0 | Cross-platform native windows, IPC, bundling |
| Backend Language | Rust (Edition 2021) | Performance, safety, async with Tokio |
| HTTP Client | reqwest 0.12 + rustls | Mojang API, Modrinth API, file downloads |
| Frontend Framework | React 18 + TypeScript 5.6 | UI with type safety |
| Build Tool | Vite 6 | Fast HMR, optimized production builds |
| Package Manager | pnpm | Efficient, strict dependency management |
| Logging | tracing-subscriber | Structured, file-rotating, async |
| Serialization | serde + serde_json | JSON config, API responses |
| UUID | uuid v1 (v4, v5) | Offline player UUIDs |
| Archival | zip 2 | Native library extraction from JARs |

### Data Flow

```
User Action → React Component → api.ts invoke() → Tauri IPC → Rust Command
                                                                ↓
UI Update ← React State ← listen() event ← app.emit() ← Rust Background Task
```

For downloads: Rust emits `download-progress` events with completed/total counts and current file URL, which the frontend listens to via `api.onDownloadProgress()` for real-time progress bars.

## Roadmap

- [x] Microsoft OAuth 2.0 login
- [x] Offline mode with deterministic UUIDs
- [x] Multi-instance management
- [x] Fabric & Forge loader support
- [x] Parallel download engine with mirrors
- [x] Version dependency auto-resolution
- [x] Modrinth mod browser & one-click install
- [x] CurseForge mod source support
- [x] Keyboard shortcuts
- [x] Toast notification system
- [x] Error boundaries & recovery
- [x] Instance import/export (.mrpack)
- [x] Discord Rich Presence
- [x] LAN discovery
- [x] P2P file sharing
- [x] CLI mode & Web API
- [x] NLP-powered search
- [x] Frame time analysis & performance profiling
- [x] Security suite (encryption, sandbox, audit)
- [x] Accessibility (ARIA, keyboard nav, skip link)
- [ ] Built-in performance profiler (Spark integration)
- [ ] One-click server join
- [ ] Plugin system for extensibility
- [ ] Mobile companion app

## Contributing

We welcome all contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and commit conventions.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure `npx tsc --noEmit` and `cargo check` pass before submitting.

## Acknowledgments

BonNext draws inspiration from the craft of Minecraft launcher design and the following projects:

- [Mojang Studios](https://www.minecraft.net) — Minecraft and the original launcher
- [Tauri](https://tauri.app) — The incredible cross-platform desktop framework
- [Modrinth](https://modrinth.com) — Open-source modding platform
- The Rust and React communities

## License

BonNext is open-source under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by the BonNext team · Neo-Tokyo, 2026</sub>
</div>
