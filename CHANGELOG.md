# Changelog

All notable changes to BonNext will be documented in this file.

## [1.0.0] - 2026-06-XX

### Added
- 插件化架构：最小核心 + 插件系统，支持第三方插件安装
- GitHub Releases 自动更新
- 首次使用引导（Quick Start + Detailed Tour）
- 主题系统：dark/light/OLED + 色盲模式 + 动态背景
- 键盘快捷键（Ctrl+K 搜索、Ctrl+H/I/V/N 导航）
- AI 智能搜索
- 崩溃自动诊断与修复建议
- 模组/整合包安装与依赖解析
- 实例快照与迁移
- 安全模块：AES-256-GCM 加密、JVM 参数白名单、审计日志

### Changed
- 版本号从 0.0.6 升级为 1.0.0（首个正式稳定版）
- 主题系统重构，消除三套主题系统冲突
- 插件事件总线支持按 pluginId 追踪和清理

### Fixed
- 插件事件权限模型失效
- PluginFileSystem 完全不可用
- activate() 失败 UI 注入泄漏
- 主题匹配 bug
- DownloadPanel 硬编码英文（i18n 化）
- NewInstancePage 版本加载静默吞错

### Known Limitations
- 无代码签名（macOS/Windows 首次运行有安全警告）
- 社交/P2P 功能未启用（代码存在但 UI 未暴露）
- 支持 960×640 及以上窗口，未适配移动端

## [0.0.6] - 2026-06-19

### Added
- 插件架构审查与修复（35+ 问题修复）

## [0.0.5] - 2026-06-XX

### Fixed
- XSS 漏洞修复（DOMPurify 集成）
- 路由冲突修复

## [0.0.4] - 2026-06-XX

### Added
- 多 Shell 架构（ZZZ/SwiftUI/Editor）

## [0.0.3] - 2026-06-XX

### Added
- Modrinth/CurseForge 市场集成
- 下载管理器

## [0.0.2] - 2026-05-16

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

## [0.0.1] - 2026-05-14

### Added
- Initial Tauri v2 + React 18 + TypeScript project scaffold
- Basic authentication (Microsoft OAuth + offline)
- Login page, settings page, home page
- Config persistence (JSON)
- Java auto-detection
- Basic logging
