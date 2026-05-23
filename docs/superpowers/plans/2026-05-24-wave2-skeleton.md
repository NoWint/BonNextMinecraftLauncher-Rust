# Wave 2: 骨架 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立前端测试框架、修复 Token 加密 bug、配置代码质量工具、实现 P2P/CLI/NBT、升级动画系统。

**Architecture:** Token 加密基础设施已存在（crypto.rs + credential_store.rs），只需修复 load() bug。P2P 使用 TCP 直连 + mDNS 发现。CLI 使用 Tauri 内置 CLI 配置。NBT 使用 simdnbt crate。

**Tech Stack:** Vitest, @testing-library/react, ESLint v9, Prettier, husky, lint-staged, simdnbt, mdns-sd

---

## Task 1: 修复 credential_store::load() 加密读取 bug

**Files:**

- Modify: `src-tauri/src/security/credential_store.rs`

当前 bug：`load()` 函数构造了空的 `EncryptedData`（所有字段为空字符串）传给 `decrypt_json`，而不是从文件读取实际的加密数据。需要修复为从 `.enc` 文件读取内容并解析为 `EncryptedData`。

## Task 2: 前端测试框架 (Vitest + Testing Library)

**Files:**

- Create: `vitest.config.ts`
- Create: `src/stores/__tests__/authStore.test.ts`
- Create: `src/stores/__tests__/configStore.test.ts`
- Create: `src/stores/__tests__/instanceStore.test.ts`
- Create: `src/hooks/__tests__/useLoading.test.ts`
- Modify: `package.json` (新增 devDependencies)

## Task 3: ESLint v9 + Prettier + husky + lint-staged

**Files:**

- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json`

## Task 4: NBT 解析器

**Files:**

- Modify: `src-tauri/Cargo.toml` (新增 simdnbt)
- Modify: `src-tauri/src/commands/world.rs` (替换 parse_level_dat_basic stub)

## Task 5: CLI 模式

**Files:**

- Modify: `src-tauri/tauri.conf.json` (添加 cli 配置)
- Modify: `src-tauri/src/commands/cli.rs` (实现真实 CLI 逻辑)

## Task 6: P2P 局域网传输

**Files:**

- Modify: `src-tauri/Cargo.toml` (新增 mdns-sd)
- Modify: `src-tauri/src/commands/network.rs` (实现 scan_p2p_peers + send_file_p2p)

## Task 7: 动画系统升级 + 页面过渡

**Files:**

- Modify: `src/styles/ux-delight.css` (新增 .page-exit 类)
- Modify: `src/App.tsx` (添加页面过渡动画)
- Modify: `package.json` (新增 framer-motion)
