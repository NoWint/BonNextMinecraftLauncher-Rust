# BonNext: Design and Implementation of a Multi-Shell Cross-Platform Minecraft Launcher

**Project Version:** v0.0.5 (Pre-Release)  
**Report Date:** June 6, 2026  
**Document Type:** Architecture Report and Development White Paper

---

## Abstract

BonNext is a cross-platform desktop launcher for Minecraft Java Edition, employing a hybrid architecture consisting of a Rust-based backend and a React-based frontend, built upon the Tauri v2 framework. The core innovation of this project lies in the proposal of the **Multi-Shell Architecture** — an interface organization paradigm that allows users to switch between fundamentally different interaction models at runtime. Unlike conventional theming systems that merely alter visual properties, the Multi-Shell Architecture enables complete replacement across three dimensions: information architecture, interaction model, and visual language. This document systematically presents the design decisions and implementation status of BonNext from four perspectives: system architecture, feature implementation, development methodology, and competitive analysis.

---

## 1 Introduction

### 1.1 Background

Minecraft Java Edition, as the best-selling video game globally, has sustained a long-standing demand for third-party launchers within its player community. Mainstream launchers (e.g., HMCL, Prism Launcher, CurseForge App) have reached functional maturity; however, systematic deficiencies persist across three dimensions:

1. **Interface Homogeneity**: Existing launchers universally adopt a single fixed interface, preventing users from adjusting interaction paradigms according to personal preference or usage context.
2. **Security Weaknesses**: Implementations based on Java or Electron expose memory safety vulnerabilities and supply chain attack risks.
3. **Absence of Intelligence**: Despite serving as hubs for mod management, launchers have yet to effectively leverage large language model technologies to assist users with complex operations.

### 1.2 Project Positioning

BonNext addresses the aforementioned issues by proposing a launcher solution that integrates multi-shell architecture, Rust-native security, and AI-assisted capabilities. The project adopts Neo-Tokyo cyberpunk aesthetics as its primary visual language while simultaneously providing an alternative interface conforming to Apple's Human Interface Guidelines, aiming to deliver differentiated operational experiences for users across preferences and platforms.

**Target Platforms:** Windows (.msi / .exe), macOS (.dmg, Universal Binary), Linux (.AppImage / .deb)

---

## 2 System Architecture

### 2.1 Overall Architecture

BonNext adopts a layered architecture, divided top-down into five layers: the Presentation Layer, Shell Management Layer, Shared Abstraction Layer, Inter-Process Communication Layer, and Backend Core Layer.

```
┌────────────────────────────────────────────────────┐
│            Presentation Layer                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐          │
│  │ZZZ Shell│  │SwiftUI   │  │ Fluent   │  ···     │
│  │(Neo-    │  │Shell     │  │ Shell    │ (ext.)   │
│  │ Tokyo)  │  │(Apple    │  │(Microsoft│          │
│  │         │  │ HIG)     │  │ Fluent)  │          │
│  └────┬────┘  └────┬─────┘  └────┬─────┘          │
│       └────────┬───┴─────────────┘                 │
│         Shell Registry (lazy-load · runtime swap)  │
│                 │                                   │
│      ┌──────────┴──────────┐                       │
│      │ Shared Abstraction  │                       │
│      │ (API · State · i18n│                       │
│      │  · Utils · Plugins)│                       │
│      └──────────┬──────────┘                       │
├────────────────┼───────────────────────────────────┤
│    Inter-Process Communication (Tauri IPC Bridge)   │
├────────────────┼───────────────────────────────────┤
│      ┌──────────┴──────────┐                       │
│      │ Backend Core (Rust)  │                       │
│      │                      │                       │
│      │  · Authentication    │                       │
│      │  · Version/Instance  │                       │
│      │  · Download Engine   │                       │
│      │  · Launch FSM        │                       │
│      │  · Content Platform  │                       │
│      │  · Security          │                       │
│      │  · Social/Network    │                       │
│      │  · AI Workflow       │                       │
│      └──────────────────────┘                       │
│                                                     │
│        OS / Hardware Abstraction Layer              │
└────────────────────────────────────────────────────┘
```

The core advantage of this layered design is the strict separation of presentation and business logic: the addition or removal of Shells does not affect backend functionality; the Shared Abstraction Layer ensures all Shells reuse the same API invocation and state management logic, preventing inconsistencies in feature implementation.

### 2.2 Frontend Architecture

| Dimension            | Selection                   | Design Rationale                                                            |
| -------------------- | --------------------------- | --------------------------------------------------------------------------- |
| UI Framework         | React 18 + TypeScript 5.6   | Component-based development model with type safety                          |
| Build Tooling        | Vite 6                      | HMR performance during development and optimized production builds          |
| State Management     | React Context + useReducer  | Lightweight approach avoiding additional dependencies and abstraction leaks |
| Styling System       | CSS Modules + Design Tokens | Zero runtime overhead with component-level style isolation                  |
| Internationalization | Built-in i18n framework     | Chinese and English bilingual support                                       |
| Routing              | Hash-based routing          | Compatibility with Tauri's single-page application loading model            |

Frontend state management comprises six core Stores: authentication (authStore), configuration (configStore), instances (instanceStore), notifications (toastStore), theming (themeStore), and downloads (downloadStore). Each Store independently maintains its own state space, injected into the component tree via React Context.

### 2.3 Backend Architecture

| Dimension         | Selection                 | Design Rationale                                                |
| ----------------- | ------------------------- | --------------------------------------------------------------- |
| Language          | Rust (Edition 2021)       | Memory safety, zero-cost abstractions, no GC pauses             |
| Async Runtime     | Tokio                     | Standard async framework in the Rust ecosystem                  |
| Desktop Framework | Tauri v2                  | ~20× size reduction and lower memory usage compared to Electron |
| IPC               | Tauri IPC (~100 commands) | Type-safe command invocation and event emission                 |

The backend is organized into 17+ independent modules by functional domain, including authentication (auth/), downloading (download/), instance management (instance/), launching (launch/), mod loaders (loader/), platform detection (platform/), security (security/), version resolution (version/), social networking (social/), P2P communication (p2p/), messaging (chat/), mod scanning (mod_scanner/), mod directory watching (mod_watcher/), server probing (server_ping/), workflow orchestration (workflow/), and command dispatch (commands/). Each module maintains clear responsibility boundaries, registered uniformly into the Tauri runtime via lib.rs.

### 2.4 Scale Metrics

| Metric                                 | Value |
| -------------------------------------- | ----- |
| Frontend source files (TSX / TS / CSS) | 437+  |
| Backend source files (Rust)            | 126+  |
| Version control commits                | 159   |
| IPC command interfaces                 | ~100  |
| Frontend pages                         | 20+   |
| UI components                          | 50+   |

---

## 3 Feature Implementation

### 3.1 Core Launch Subsystem

The launch process in BonNext follows a strict finite state machine model, covering the complete lifecycle from user authentication to game process management.

| Feature                       | Implementation Description                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft OAuth 2.0           | Device Code Flow-based authentication with automatic token refresh; users are not required to manually enter credentials                                       |
| Yggdrasil External Login      | Compatible with third-party authentication server protocols (e.g., authlib-injector), supporting skin services such as LittleSkin                              |
| Offline Mode                  | Offline sessions based on deterministic v5 UUID generation, ensuring availability without network connectivity                                                 |
| Multi-Account Management      | Multi-account registration, one-click switching, and automatic token renewal                                                                                   |
| Skin & Cape Management        | Microsoft skin upload/deletion, cape equip/hide                                                                                                                |
| Instance Isolation            | Create / configure / clone / delete isolated instances, each with independent mods / saves / configs directories                                               |
| Instance Snapshots            | Copy-on-Write-based state preservation with instant rollback capability                                                                                        |
| Instance Migration            | Compatible with instance format imports from HMCL / MultiMC / Prism Launcher and other mainstream launchers                                                    |
| Modpack Import/Export         | Bidirectional support for .mrpack (Modrinth) and CurseForge formats, including automatic format detection                                                      |
| Parallel Download Engine      | Multi-threaded concurrent downloading with exponential backoff retry, SHA1 real-time verification, and three-tier mirror failover (Official → BMCLAPI → MCBBS) |
| Java Runtime Management       | Cross-platform automatic Java detection (PATH / JAVA_HOME / macOS java_home / Windows Registry) and multi-source automatic download                            |
| Mod Loader Installation       | One-click installation for Fabric, Forge, NeoForge, and Quilt loaders                                                                                          |
| Launch State Machine          | Six-state transition model: Idle → Checking → Downloading → Validating → Launching → Running / Exited / Crashed                                                |
| Crash Diagnosis               | Crash report parsing, intelligent diagnostic suggestions, and real-time crash monitor                                                                          |
| NBT Data Management           | level.dat field read/write, world export and backup                                                                                                            |
| Minecraft Rich Text Rendering | TextComponent rendering engine supporting formatted text in MOTD and logs                                                                                      |

### 3.2 Content Platform Subsystem

BonNext integrates three community content data sources, constructing a unified content discovery and installation pipeline.

| Feature                              | Implementation Description                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Modrinth Integration                 | API v2 access: search, popular rankings, project details, version listings, file downloads        |
| CurseForge Integration               | API v1 access: search, featured content, mod files, download link resolution                      |
| ModPackIndex Integration             | Third-party modpack index: search, categorized browsing                                           |
| Aggregated Search Engine             | NLP-based unified search with Chinese-English synonym expansion and TF-IDF relevance scoring      |
| Marketplace Hub                      | Banner carousel, category navigation, trending content aggregation, recent update tracking        |
| Dependency Resolution & Installation | Automatic dependency graph resolution, installation queue management, real-time progress tracking |
| Collection System                    | Cross-session persistent wishlists with content type filtering                                    |
| Content Library Management           | Instance-level installed content management, version update checking, batch update operations     |
| Mod Scanning Engine                  | Asynchronous JAR file scanning, fingerprint identification, SQLite-based caching database         |
| Mod Directory Watching               | File system event-based real-time monitoring of instance mod directory changes                    |
| Mod Compatibility Analysis           | Dependency integrity checking and conflict detection                                              |
| Mirror Health Monitoring             | Real-time download source availability detection and automatic failover                           |

### 3.3 Social and Networking Subsystem

| Feature                    | Implementation Description                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Discord Rich Presence      | Automatic synchronization of game status to Discord activity display                                              |
| LAN Discovery              | mDNS / Bonjour protocol-based automatic discovery of LAN Minecraft worlds                                         |
| Friend System              | Friend addition / management, online status queries, identity key import/export                                   |
| P2P Encrypted File Sharing | LAN direct transfer based on ed25519 identity verification, x25519 key exchange, and ChaCha20-Poly1305 encryption |
| Instant Messaging          | Message exchange between friends with read/unread status tracking                                                 |
| Server Probing             | Minecraft server Ping, batch probing, SRV record resolution                                                       |
| Server Favorites           | servers.dat format read/write and favorite server management                                                      |
| Terracotta Integration     | Complete lifecycle management for multiplayer proxy services (download / install / start / stop / status query)   |

### 3.4 AI Assistance Subsystem

BonNext integrates an intelligent assistant based on large language models, supporting the completion of complex operations through natural language instructions.

| Feature                     | Implementation Description                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Chat Panel               | OpenAI API-compatible streaming dialogue interface with tool use support                                                                                                    |
| Workflow Engine             | Orchestrated workflows for modpack installation, crash repair, and batch mod installation scenarios                                                                         |
| Modpack Planning            | AI-generated installation plans based on user descriptions (theme, version, mod list, JVM configuration)                                                                    |
| Compatibility Assessment    | AI-driven mod compatibility analysis and risk scoring                                                                                                                       |
| Crash Analysis              | AI-automated crash report parsing, knowledge base matching, and repair solution generation                                                                                  |
| Natural Language Operations | End-to-end mapping from natural language instructions to system operations (e.g., "install a tech-oriented modpack" → auto-create instance → install loader → install mods) |

### 3.5 Security Subsystem

| Feature                           | Implementation Description                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| AES-256-GCM Credential Encryption | HKDF key derivation-based encrypted credential storage with automatic plaintext-to-ciphertext migration |
| Credential Persistence            | Secure storage of encrypted credentials and API key management                                          |
| Security Audit Logging            | Complete recording and queryable retrieval of security events                                           |
| JVM Parameter Whitelisting        | Security validation mechanism for JVM launch parameters                                                 |
| Sandbox Mode                      | Restricted execution environment management                                                             |
| Input Sanitization                | Full-chain user input data cleansing                                                                    |
| Comprehensive Security Score      | Multi-dimensional security posture assessment system                                                    |
| Web API Service                   | Axum-based HTTP API service with Bearer Token authentication                                            |
| Command-Line Interface            | clap-based CLI mode supporting scripting and headless operations                                        |
| Hardware Analysis                 | CPU / GPU / RAM automatic detection and performance scoring                                             |
| Battery Status Awareness          | Notebook battery status detection and power-saving strategy                                             |
| Disk Usage Analysis               | Cross-instance / version / library / resource disk usage visualization                                  |
| Frame Time Analysis               | Game log-based frame time statistics, GC tuning recommendations, and anomaly detection                  |

---

## 4 Multi-Shell Architecture

### 4.1 Design Motivation

Interface customization in traditional desktop applications typically stops at theming systems — replacing visual properties (colors, fonts, spacing) while preserving the information architecture and interaction model unchanged. However, different user groups have fundamentally divergent expectations regarding interaction paradigms: macOS users tend toward intuitive interactions conforming to Apple HIG, while gamers may prefer more immersive interface styles. The Multi-Shell Architecture is proposed to address this need, with the core distinction being:

- **Theming System**: Replaces visual properties on a fixed interaction model (color / font / spacing)
- **Multi-Shell Architecture**: Replaces the complete interaction model and visual language on a fixed business logic layer

Each Shell is an independent interface implementation package with its own page components, interaction patterns, styling systems, and design languages, managed uniformly through the Shell Registry and loaded on demand via React.lazy().

### 4.2 ZZZ Shell (Default)

The ZZZ Shell employs Neo-Tokyo cyberpunk aesthetics as its visual language, drawing design inspiration from the interface style of _Zenless Zone Zero_, constituting BonNext's signature interaction experience.

**Visual Characteristics:**

- Primary palette: #FFE600 fluorescent yellow with dark background in high-contrast combination
- Typography: Bebas Neue (headings) / Inter (body) / DM Mono (data)
- Geometric language: CSS clip-path-based angled corner design applied to all cards and panels
- Texture overlays: SVG noise texture and scanline overlays creating CRT display aesthetics
- Theme variants: Dark / Light / OLED

**Page Composition (12 core pages + 14 settings sub-pages):**

| Page            | Functional Description                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| Home            | Launch dashboard: quick-launch panel, news aggregation, dynamic background                   |
| Store           | Marketplace hub: banner carousel, category navigation, trending content                      |
| Content Detail  | Content details: complete information display for mods / resource packs / shaders / modpacks |
| Instances       | Instance list: search, filtering, grouping                                                   |
| Instance Detail | Instance details: mod / world / log / config / snapshot management                           |
| Library         | Content library: installed content management and update checking                            |
| Mods            | Mod browser: dual-source search, gallery / list views, pagination                            |
| Collections     | Collection management: wishlist content browsing and filtering                               |
| Versions        | Version browser: version retrieval and downloading                                           |
| Settings        | Settings panel: 14 categorized settings pages                                                |
| Download Panel  | Floating download manager (Steam-style interaction paradigm)                                 |

### 4.3 SwiftUI Shell

The SwiftUI Shell conforms to Apple's Human Interface Guidelines, employing a Liquid Glass frosted-glass design language, aiming to provide macOS users with interaction expectations consistent with native system applications.

**Visual Characteristics:**

- Semi-transparent frosted-glass panels with rounded-corner cards
- SF Pro font family
- Refined shadow hierarchies and spring animation curves
- Light / Dark dual themes

**Page Composition (13+ pages):** Covering Home, Instance Management, Instance Detail, Mod Browsing, Content Detail, AI Chat, Collections, Versions, Settings, and more, forming a complete feature set.

### 4.4 Extensible Shells

| Shell        | Status  | Design Language                            |
| ------------ | ------- | ------------------------------------------ |
| Fluent Shell | Planned | Microsoft Fluent Design System             |
| TV Shell     | Planned | Television / large-screen interaction mode |

The Shell system supports dynamic import of custom Shell implementations from external files. Third-party developers can create and distribute independent interface styles. The Registry provides runtime registration/deregistration capabilities; new Shells can be integrated without modifying core code.

---

## 5 Development Process

### 5.1 Iterative History

| Phase   | Date       | Milestone                                                                                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1.0  | 2026.05.14 | Project initialization: Tauri v2 + React 18 project scaffolding, Microsoft OAuth + offline authentication, basic UI framework                                             |
| v0.2.0  | 2026.05.16 | Architecture rewrite: complete backend rewrite, parallel download engine, launch state machine, Fabric/Forge installation, cyberpunk UI system                            |
| Phase 1 | 2026.05    | Feature expansion: authlib-injector integration, crash diagnosis UI, log filters, instance grouping, mirror health monitoring                                             |
| Phase 2 | 2026.05    | Feature deepening: persistent cache layer, P2P networking skeleton, NBT world management, Quilt/NeoForge support, Minecraft rich text rendering                           |
| Phase 3 | 2026.05    | AI integration: AI Agent mode, natural language modpack creation, automated crash analysis, multi-turn tool execution chains                                              |
| Phase 4 | 2026.05    | Social system: friend / chat / feed / recommendation modules, AI panel visual upgrade                                                                                     |
| Phase 5 | 2026.06    | Architecture restructuring: Shell Registry and Shell Store design/implementation, ZZZ/Fluent/SwiftUI/TV four-shell architecture, large-scale frontend code reorganization |
| Phase 6 | 2026.06    | SwiftUI implementation: complete SwiftUI Shell development, 13+ pages, Apple HIG design language implementation                                                           |

### 5.2 Key Architectural Decisions

1. **Tauri v2 over Electron**: Installation package size reduction of approximately 93% (~10MB vs ~150MB), runtime memory usage reduction of approximately 60%, and leveraging the OS-native WebView to avoid the supply chain attack surface introduced by Chromium bundling.
2. **Rust over Node.js backend**: Zero GC pauses ensure real-time responsiveness of download and launch processes; the ownership system provides compile-time memory safety guarantees; zero-cost interoperability with the Tauri runtime.
3. **Multi-Shell Architecture over Theming**: Theming systems only alter visual properties and cannot satisfy the demand for different interaction paradigms; the Multi-Shell Architecture enables complete replacement across information architecture, interaction model, and visual language.
4. **React Context + useReducer over Redux**: At the current project scale, Redux introduces abstraction leaks and boilerplate code with negative returns; Context + useReducer provides sufficient state management capability with lower cognitive burden.
5. **CSS Modules over CSS-in-JS**: Zero runtime overhead, avoiding JavaScript thread participation in style computation; complete native CSS capability retention; compile-time class name hashing provides style isolation guarantees.
6. **Shell Lazy Loading**: React.lazy()-based on-demand loading strategy ensures users only download the code of the currently active Shell, significantly reducing first-screen load time.

### 5.3 Development Metrics

| Metric                         | Value                              |
| ------------------------------ | ---------------------------------- |
| Total version control commits  | 159                                |
| Development period             | ~21 days (2026.05.14 — 2026.06.06) |
| Average daily commit frequency | ~7.6/day                           |
| Frontend source file count     | 437+ (TSX / TS / CSS)              |
| Backend source file count      | 126+ (Rust)                        |
| Backend functional modules     | 17+                                |
| IPC command interfaces         | ~100                               |

---

## 6 Competitive Analysis

| Feature Dimension           | BonNext                              | HMCL                    | Prism Launcher          | CurseForge App        |
| --------------------------- | ------------------------------------ | ----------------------- | ----------------------- | --------------------- |
| Backend Language            | Rust                                 | Java                    | C++ / Qt                | JavaScript (Electron) |
| Installation Size           | ~10 MB                               | ~20 MB                  | ~50 MB                  | ~300 MB               |
| Multi-Shell UI              | Supported                            | Not supported           | Not supported           | Not supported         |
| AI Assistance               | Supported                            | Not supported           | Not supported           | Not supported         |
| Apple HIG Interface         | Supported                            | Not supported           | Not supported           | Not supported         |
| Multi-Source Content        | Modrinth + CurseForge + ModPackIndex | Partial                 | Modrinth + CurseForge   | CurseForge only       |
| Instance Snapshot/Rollback  | Supported                            | Not supported           | Not supported           | Not supported         |
| P2P Encrypted Transfer      | Supported                            | Not supported           | Not supported           | Not supported         |
| Intelligent Crash Diagnosis | Supported                            | Basic                   | Basic                   | Not supported         |
| Cross-Platform              | Windows / macOS / Linux              | Windows / macOS / Linux | Windows / macOS / Linux | Windows / macOS       |

---

## 7 Current Status and Evolution

### 7.1 v0.0.5 Feature Status

**Completed and operational feature domains:**

- Complete launch pipeline (authentication → version selection → download → launch)
- Three-source content platform (Modrinth / CurseForge / ModPackIndex)
- Multi-instance management and bidirectional modpack import/export
- AI assistance system with natural language operations
- Dual Shell implementations (ZZZ Cyberpunk / SwiftUI Apple HIG)
- Social feature framework (friends / chat / server probing)
- Security subsystem (encrypted storage / audit / sandbox)

**Known limitations (ordered by priority):**

1. Light theme text contrast ratios fall below WCAG AA standard (4.5:1), affecting readability and accessibility compliance
2. Incomplete bridging between backend download progress event emission and frontend state consumption
3. Insufficient internationalization translation coverage with hardcoded strings remaining
4. Partial social module features are framework-level implementations pending completion

### 7.2 Evolution Roadmap

Based on a systematic assessment of 120 improvement items (covering user experience, performance, architecture, security, and maintainability dimensions), the highest-priority evolution directions are:

1. **Routing System Unification** — Eliminate conflicts between custom routing and react-router-dom, restoring correct parameter passing and browser navigation
2. **Light Theme Readability Fix** — Elevate text/background contrast ratios to WCAG AA compliance levels
3. **Download Progress Real-time Display** — Complete the bridge between backend event emission and frontend state consumption
4. **Mod Enable/Disable Toggle** — Close the core operational loop of mod management
5. **Async IO Optimization** — Eliminate UI freezing caused by synchronous blocking calls in the backend

---

## 8 Conclusion

BonNext proposes and implements a cross-platform Minecraft launcher solution based on Multi-Shell Architecture. The core contributions of this work are:

1. **Multi-Shell Architecture**: Distinct from traditional theming systems, it enables complete replacement across information architecture, interaction model, and visual language, allowing users to select differentiated operational paradigms based on preference and platform.
2. **Rust-Native Security**: Leveraging Rust's ownership system and the Tauri v2 framework, significant improvements are achieved across three dimensions: installation size, runtime performance, and memory safety.
3. **AI-Assisted Operational Closure**: Integration of large language models into the launcher's operational chain enables natural language instructions to drive instance creation, mod installation, and crash repair in an end-to-end manner.

The project completed the entire implementation from zero to v0.0.5 Pre-Release within a 21-day development cycle, covering eight functional domains — authentication, downloading, launching, instance management, content platform, AI assistance, social networking, and security — with approximately 100 backend command interfaces and 20+ frontend pages. The core launch pipeline is operational in the current version, and both Shell interfaces are available for evaluation. The next phase will focus on experience consistency fixes and feature completion, establishing the foundation for a formal release.
