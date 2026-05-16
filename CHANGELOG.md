# Changelog

All notable changes to BonNext will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Modrinth mod browser with search, filtering, and one-click install
- Keyboard shortcuts (Ctrl+H/I/M/V/N/, for navigation)
- Toast notification system with auto-dismiss
- Error boundary with recovery UI
- Skeleton loading components
- GitHub Actions CI pipeline (Ubuntu, macOS, Windows)
- SECURITY.md, CONTRIBUTING.md, CHANGELOG.md

### Changed
- All pages converted from inline styles to CSS Modules
- SettingsPage checkboxes now functional and config-driven
- File/folder picker dialogs wired in SettingsPage

### Fixed
- `user_type` now dynamically set from account store (not hardcoded "msa")
- `version_type` now resolved from version JSON (not hardcoded "release")
- `--fullscreen` flag properly passed to Minecraft
- Memory validation added (min >= 256MB, max >= min, max <= 64GB)
- Launch state machine transitions now enforced with logging

## [0.2.0] - 2026-05-16

### Added
- Complete application rewrite based on oxide-mc and shard reference projects
- Microsoft OAuth 2.0 device code authentication with token refresh
- Offline mode with deterministic v5 UUIDs
- Multi-instance management with isolated .minecraft directories
- Shared library hard-linking to save disk space
- Fabric and Forge mod loader installation
- Parallel download engine with SHA1 verification
- Automatic Java runtime detection (cross-platform)
- Launch state machine with real-time progress events
- Version dependency resolution with parent inheritance
- OS/feature rule evaluation for conditional libraries
- BMCLAPI and MCBBS download mirror support
- Structured logging with file rotation
- Neo-Tokyo cyberpunk UI design system
- CSS custom properties design tokens
- React Context + useReducer state management

## [0.1.0] - 2026-05-14

### Added
- Initial Tauri v2 + React 18 + TypeScript project scaffold
- Basic authentication (Microsoft OAuth + offline)
- Login page, settings page, home page
- Config persistence (JSON)
- Java auto-detection
- Basic logging
