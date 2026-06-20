# BonNext Launcher Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 BonNext 项目骨架，实现从 Tauri 前端点击按钮到成功启动 Minecraft Java Edition 的完整链路。

**Architecture:** Tauri 2.x 项目，React + TypeScript 前端通过 `invoke`/`listen` 与 Rust 核心引擎通信。Rust 侧分为 platform/version/download/launch 四个模块，状态机管理启动全流程。

**Tech Stack:** Tauri 2.11.1, Rust 1.94, React 18 + TypeScript, Vite, pnpm 10, reqwest, serde, tracing

---

## Task 0: 项目初始化

**Files:**
- Create: 整个项目骨架（通过 `pnpm create tauri-app`）

- [ ] **Step 1: 使用 Tauri CLI 创建项目**

```bash
cd /Users/xiatian/Desktop/BonNext
pnpm create tauri-app@latest BonNext --template react-ts --manager pnpm
```

Expected: 在 `BonNext/` 子目录下生成项目。如果因为当前目录非空需要特殊处理，使用 `--yes` 标志或在临时目录创建后移动。

- [ ] **Step 2: 如果上一步创建了子目录，移动到当前目录**

```bash
# 如果创建在 BonNext/BonNext，则移出来
if [ -d "BonNext/src-tauri" ] && [ -f "BonNext/package.json" ]; then
  cp -r BonNext/* .
  cp -r BonNext/.* . 2>/dev/null || true
  rm -rf BonNext
fi
```

- [ ] **Step 3: 验证项目结构**

```bash
ls src-tauri/Cargo.toml package.json src/App.tsx
```

Expected: 三个文件都存在。

- [ ] **Step 4: 安装前端依赖**

```bash
pnpm install
```

- [ ] **Step 5: 确认 Cargo.toml 中的依赖版本**

读取 `src-tauri/Cargo.toml`，确保 tauri 版本为 2.x：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 6: 首次编译验证**

```bash
cd src-tauri && cargo check
```

Expected: 编译通过，无错误。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "chore: initialize Tauri 2.x + React + TypeScript project"
```

---

## Task 1: 统一错误类型与日志

**Files:**
- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/src/logging.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/C