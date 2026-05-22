# Multi-Agent Architecture: 10-Hour Autonomous Development Sprint

## Overview

- **Main window (Orchestrator)**: 1 agent — coordination, integration, review, infrastructure
- **Worker windows**: 4 agents — independent feature streams
- **Duration**: 10 hours continuous, self-paced via `/loop`
- **Conflict avoidance**: Each agent owns a disjoint set of files

## Ground Rules

1. **No file sharing between agents** — each agent has exclusive ownership of their directories/files
2. **Agents commit and push independently** — no merge conflicts by design
3. **Main agent reviews and integrates** — periodic `git pull` to check worker progress
4. **All agents use `/loop` self-pacing** — no idle time
5. **Each agent has its own CLAUDE.md context** — project rules are shared, work scope is exclusive

## Agent Assignments

### Agent 1: Content Marketplace (Modrinth/CurseForge UI)

**Exclusive files:**
- `src/pages/StorePage.tsx`, `src/pages/StorePage.module.css`
- `src/pages/ContentDetailPage.tsx`, `src/pages/ContentDetailPage.module.css`
- `src/pages/ModsPage.tsx`, `src/pages/ModsPage.module.css`
- `src/components/ui/ContentCard.tsx`, `src/components/ui/ContentCard.module.css`
- `src/components/ui/InstallButton.tsx`, `src/components/ui/InstallButton.module.css`
- `src/components/ui/CategoryCard.tsx`, `src/components/ui/CategoryCard.module.css`

**Tasks (10 hours):**
1. Content detail page: screenshot gallery carousel, version selector with compatibility badges
2. Dependency visualization: tree/graph showing what deps a mod needs
3. Advanced filtering: sort by popularity/updated/name, multi-select categories, content type tabs
4. Mod review/rating display from Modrinth API
5. Responsive gallery grid with lazy-loaded images
6. "You might also like" recommendations
7. Version compatibility matrix for mods
8. Changelog viewer for mod versions
9. Smooth image loading with blur-up placeholder
10. Infinite scroll with intersection observer

### Agent 2: Instance Management System

**Exclusive files:**
- `src/pages/InstancesPage.tsx`, `src/pages/InstancesPage.module.css`
- `src/pages/InstanceDetailPage.tsx`, `src/pages/InstanceDetailPage.module.css`
- `src/pages/NewInstancePage.tsx`, `src/pages/NewInstancePage.module.css`
- `src/components/ui/InstanceSelect.tsx`, `src/components/ui/InstanceSelect.module.css`
- `src-tauri/src/instance/*.rs`

**Tasks (10 hours):**
1. Modpack import: parse .mrpack/curseforge zip, auto-create instance with mods
2. Instance export: bundle instance as .mrpack with manifest
3. Instance snapshot/backup: one-click backup and restore
4. World/saves browser: list worlds, show size/date, one-click open in file manager
5. Resource pack manager: list installed resource packs, enable/disable
6. Shader pack manager: list installed shaders, enable/disable
7. Instance migration: move instance to another drive with progress
8. Instance clone with rename and option to copy worlds
9. Instance health check: verify all files present, no corruption
10. Instance notes/journal: free-text notes per instance, persisted

### Agent 3: Launch & Performance System

**Exclusive files:**
- `src/pages/HomePage.tsx`, `src/pages/HomePage.module.css`
- `src/components/ui/GameConsole.tsx`, `src/components/ui/GameConsole.module.css`
- `src/components/ErrorBoundary.tsx`
- `src-tauri/src/launch/*.rs`
- `src-tauri/src/crash_parser.rs`
- `src-tauri/src/platform/java.rs`, `src-tauri/src/platform/java_download.rs`

**Tasks (10 hours):**
1. Auto JRE download: detect required Java version, download Adoptium if missing
2. Crash report analyzer: parse crash logs, detect common issues (OutOfMemory, bad driver, mod conflict)
3. Performance preset system: Low/Medium/High/Ultra with auto-tuned JVM args
4. FPS overlay integration: auto-install Sodium/Iris for performance
5. Launch profile system: save/load named launch configurations
6. Game output search/filter in GameConsole: regex search, error-only filter
7. Memory usage graph: real-time RAM usage during gameplay
8. Auto-restart on crash: configurable max retries with delay
9. Pre-launch checklist: verify Java version, disk space, GPU drivers
10. Launch time benchmark: track and display cold vs warm start times

### Agent 4: Library & Collections System

**Exclusive files:**
- `src/pages/LibraryPage.tsx`, `src/pages/LibraryPage.module.css`
- `src/pages/CollectionsPage.tsx`, `src/pages/CollectionsPage.module.css`
- `src/components/ui/CollectionButton.tsx`, `src/components/ui/CollectionButton.module.css`
- `src/components/ui/DownloadPanel.tsx`, `src/components/ui/DownloadPanel.module.css`
- `src/stores/downloadStore.tsx`
- `src-tauri/src/collections.rs`
- `src-tauri/src/content.rs`

**Tasks (10 hours):**
1. Update checker: compare installed mods against Modrinth/CF latest versions
2. Bulk update: update all outdated mods with one click
3. Collections organization: folders/categories within collections
4. Collection sharing: export collection as shareable code/link
5. Download history: track all downloads with timestamps, ability to re-download
6. Disk usage analyzer: show space used by each content type per instance
7. Auto-cleanup: remove old/unused content versions
8. Content tagging: user-defined tags for organization
9. Smart collections: auto-populated collections (e.g., "recently updated", "not yet played")
10. Download resumption: resume interrupted downloads

### Agent 5 (Main): Infrastructure & Integration

**Exclusive files:**
- `.github/workflows/*.yml`
- `src/i18n/*.ts`
- `src/styles/*.css`
- `src/api.ts`
- `src/App.tsx`
- `src-tauri/src/lib.rs` (command registration only)
- `src-tauri/src/error.rs`
- `src-tauri/Cargo.toml`

**Tasks (10 hours):**
1. CI/CD: release workflow testing, platform matrix, code signing
2. i18n coverage: audit all pages for missing translation keys
3. Accessibility: ARIA labels, keyboard navigation, screen reader support
4. Performance audit: React.memo, useMemo, code splitting, bundle analysis
5. Error handling audit: every catch block must have user-facing fallback
6. Security audit: input validation, CSP headers, dependency audit
7. Testing: add frontend component tests (vitest), expand Rust test coverage
8. Documentation: update README screenshots, API docs, user guide
9. Code review: review agent 1-4 commits for quality and consistency
10. Release preparation: changelog, version bump, release notes

## Worker Agent Prompt Template

Each worker agent should receive this prompt in its own Claude Code window:

---

```
You are a specialist AI developer working on BonNext, a Tauri v2 Minecraft launcher.
You have EXCLUSIVE ownership of the following files (no other agent will touch them):

[LIST OF FILES]

Your task for the next 10 hours:
[TASK LIST]

RULES:
1. Work continuously using /loop for self-pacing
2. Commit and push your work every 30-60 minutes
3. NEVER modify files outside your exclusive list
4. Run `npx tsc --noEmit` after every change; fix errors immediately
5. If you touch Rust files, run `cargo check` and `cargo test` after each change
6. Write high-quality, production-ready code — no placeholders, no TODOs
7. Use existing project patterns: CSS Modules, React Context, thiserror, Tauri commands
8. Add i18n keys for any new user-facing text in BOTH zh-CN.ts and en-US.ts
9. Follow the Neo-Tokyo visual aesthetic: dark theme, #FFE600 accent, clip-path corners

START NOW. Begin by reading your exclusive files to understand the current state.
```

## Progress Tracking

Main agent checks progress every 60 minutes:
```bash
git fetch origin
git log --oneline --all --since="1 hour ago"
```

## File Ownership Map (Quick Reference)

| Module | Agent | Files |
|--------|-------|-------|
| Content Marketplace | Agent 1 | StorePage, ContentDetail, ModsPage, ContentCard, InstallButton, CategoryCard |
| Instance Management | Agent 2 | InstancesPage, InstanceDetail, NewInstance, InstanceSelect, instance/*.rs |
| Launch & Performance | Agent 3 | HomePage, GameConsole, ErrorBoundary, launch/*.rs, crash_parser, java*.rs |
| Library & Collections | Agent 4 | LibraryPage, CollectionsPage, CollectionButton, DownloadPanel, downloadStore, collections.rs, content.rs |
| Infrastructure | Agent 5 | CI/CD, i18n, styles, api.ts, App.tsx, lib.rs, error.rs, docs |
