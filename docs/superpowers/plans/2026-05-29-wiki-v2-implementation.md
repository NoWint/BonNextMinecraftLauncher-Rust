# BonNext Wiki v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static site generator that turns local Markdown files into a deployable GitHub Pages wiki with Apple-style minimal design, auto light/dark theme, and tree navigation.

**Architecture:** Node.js build script scans `content/` directory, converts Markdown to HTML via `marked`, injects into a template with generated sidebar navigation, outputs static files to `dist/`. Zero runtime dependencies — pure static HTML/CSS/JS.

**Tech Stack:** Node.js (built-in `fs`, `path`), `marked` (Markdown parser), pure CSS (no framework).

---

## File Structure

```
wiki-v2/
├── content/                    # Markdown source files
│   ├── 01-概述/
│   │   ├── 01-项目简介.md
│   │   └── 02-设计理念.md
│   ├── 02-指南/
│   │   ├── 01-快速开始.md
│   │   └── 02-开发环境.md
│   └── 03-开发/
│       ├── 01-架构设计.md
│       └── 02-API文档.md
├── build.js                    # Node.js build script
├── package.json                # Dependencies + build scripts
├── template.html               # HTML page template
├── css/
│   └── style.css               # All styles (light/dark, layout, markdown)
└── dist/                       # Build output (deploy to GitHub Pages)
```

---

### Task 1: Create Directory Structure and package.json

**Files:**

- Create: `wiki-v2/package.json`
- Create: `wiki-v2/content/01-概述/01-项目简介.md`
- Create: `wiki-v2/content/01-概述/02-设计理念.md`
- Create: `wiki-v2/content/02-指南/01-快速开始.md`
- Create: `wiki-v2/content/02-指南/02-开发环境.md`
- Create: `wiki-v2/content/03-开发/01-架构设计.md`
- Create: `wiki-v2/content/03-开发/02-API文档.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "bonnext-wiki",
  "version": "1.0.0",
  "description": "BonNext project wiki - static site generator",
  "scripts": {
    "build": "node build.js",
    "watch": "node build.js --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "marked": "^12.0.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create sample Markdown content files**

`content/01-概述/01-项目简介.md`:

```markdown
# 项目简介

BonNext 是一款基于 **Tauri v2** 构建的跨平台 Minecraft Java Edition 启动器。

## 核心特性

- Microsoft OAuth 2.0 设备流认证
- 并行下载队列，支持重试与 SHA1 校验
- Fabric + Forge 模组加载器安装
- 多实例管理，独立 `.minecraft` 目录
- Modrinth / CurseForge 内容平台集成

## 技术栈

| 层级     | 技术                  |
| -------- | --------------------- |
| 后端     | Rust                  |
| 前端     | React 18 + TypeScript |
| 桌面框架 | Tauri v2              |
```

`content/01-概述/02-设计理念.md`:

```markdown
# 设计理念

BonNext 的设计遵循三个核心原则：

## 高效

- 快速启动，低资源占用
- 并行下载，最大化带宽利用
- 状态机驱动的启动流程

## 美观

- ZZZ 风格的 Neo-Tokyo 赛博朋克美学
- 精心设计的动画与过渡效果
- 一致的设计语言贯穿全应用

## 安全

- 自动 JVM 参数白名单
- 文件权限沙箱
- 审计日志记录
```

`content/02-指南/01-快速开始.md`:

````markdown
# 快速开始

## 环境准备

确保已安装：

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- [pnpm](https://pnpm.io/)

## 安装

```bash
git clone <repo-url>
cd BonNext
pnpm install
```
````

## 开发

```bash
# 前端开发
pnpm dev

# 完整桌面应用
pnpm tauri dev
```

## 构建

```bash
pnpm tauri build
```

````

`content/02-指南/02-开发环境.md`:
```markdown
# 开发环境配置

## IDE 推荐

- [VS Code](https://code.visualstudio.com/) + Tauri 插件
- [RustRover](https://www.jetbrains.com/rust/) (Rust 开发)

## 推荐扩展

| 扩展 | 用途 |
|------|------|
| rust-analyzer | Rust 语言支持 |
| ESLint | JavaScript/TypeScript 代码检查 |
| Prettier | 代码格式化 |
| Tauri | Tauri 项目支持 |

## 调试

```bash
# Rust 端日志
RUST_LOG=debug pnpm tauri dev

# 前端控制台
# 在 Tauri 窗口中按 F12 打开 DevTools
````

````

`content/03-开发/01-架构设计.md`:
```markdown
# 架构设计

## 整体架构

````

用户操作 → React 组件 → api.ts invoke() → Tauri IPC → Rust 命令
↓
UI 更新 ← React 状态 ← listen() 事件 ← app.emit() ← Rust 后台任务

```

## 后端模块

- `auth/` — 微软 OAuth 认证 + 离线模式
- `download/` — 并行下载引擎
- `launch/` — 启动状态机
- `loader/` — 模组加载器安装
- `instance/` — 实例管理
- `version/` — 版本解析

## 前端状态管理

使用 React Context + useReducer：

- `authStore` — 用户认证
- `configStore` — 应用配置
- `instanceStore` — 实例管理
- `downloadStore` — 下载队列
- `themeStore` — 主题切换
```

`content/03-开发/02-API文档.md`:

```markdown
# API 文档

## Tauri Commands

所有后端命令通过 `src/api.ts` 封装为类型化函数。

### 认证相关

| 命令              | 参数                | 返回值          |
| ----------------- | ------------------- | --------------- |
| `login_microsoft` | —                   | `AccountInfo`   |
| `logout`          | `accountId: string` | `boolean`       |
| `get_accounts`    | —                   | `AccountInfo[]` |

### 实例管理

| 命令              | 参数                    | 返回值       |
| ----------------- | ----------------------- | ------------ |
| `create_instance` | `name, version, loader` | `Instance`   |
| `delete_instance` | `id: string`            | `boolean`    |
| `list_instances`  | —                       | `Instance[]` |

### 下载

| 命令                    | 参数                | 返回值          |
| ----------------------- | ------------------- | --------------- |
| `download_version`      | `versionId: string` | `DownloadTask`  |
| `get_download_progress` | —                   | `ProgressEvent` |
```

- [ ] **Step 3: Commit**

```bash
git add wiki-v2/
git commit -m "feat(wiki): add wiki-v2 directory structure and sample content"
```

---

### Task 2: Write the CSS Stylesheet

**Files:**

- Create: `wiki-v2/css/style.css`

- [ ] **Step 1: Write style.css with light/dark themes, layout, and markdown rendering**

```css
/* ========================================
   BonNext Wiki v2 - Stylesheet
   Apple-style minimal design
   Auto light/dark via prefers-color-scheme
   ======================================== */

/* ---- CSS Variables ---- */
:root {
  --sidebar-width: 260px;
  --content-max-width: 740px;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  --radius: 8px;
  --transition: 0.2s ease;

  /* Light mode (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #f0f0f2;
  --bg-hover: #e8e8ed;
  --bg-active: #e0e0e5;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-muted: #86868b;
  --accent: #0071e3;
  --accent-dim: rgba(0, 113, 227, 0.08);
  --accent-hover: #0077ed;
  --border: #d2d2d7;
  --border-light: #e8e8ed;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  --code-bg: #f5f5f7;
  --code-text: #1d1d1f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #000000;
    --bg-secondary: #1d1d1f;
    --bg-tertiary: #2d2d2f;
    --bg-hover: #3a3a3c;
    --bg-active: #48484a;
    --text-primary: #f5f5f7;
    --text-secondary: #a1a1a6;
    --text-muted: #6e6e73;
    --accent: #2997ff;
    --accent-dim: rgba(41, 151, 255, 0.12);
    --accent-hover: #5ac8fa;
    --border: #424245;
    --border-light: #2c2c2e;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    --code-bg: #1d1d1f;
    --code-text: #f5f5f7;
  }
}

/* ---- Reset & Base ---- */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-primary);
  background: var(--bg-primary);
}

/* ---- Layout ---- */
#app {
  display: flex;
  min-height: 100vh;
}

#sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  overflow: hidden;
}

#sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 24px;
}

#sidebar-content::-webkit-scrollbar {
  width: 4px;
}
#sidebar-content::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

#main {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-height: 100vh;
}

#content {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 48px 40px 80px;
}

/* ---- Sidebar Header ---- */
.sidebar-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border-light);
}

.logo {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  text-decoration: none;
  display: block;
}

.logo:hover {
  color: var(--accent);
}

/* ---- Search ---- */
.search-box {
  padding: 12px 16px;
}

.search-box input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}

.search-box input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.search-box input::placeholder {
  color: var(--text-muted);
}

/* ---- Navigation Tree ---- */
.nav-tree {
  padding: 0 8px;
}

.nav-group {
  margin-bottom: 2px;
}

.nav-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition:
    background var(--transition),
    color var(--transition);
  user-select: none;
}

.nav-group-header:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-group-header .chevron {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition);
  font-size: 10px;
}

.nav-group-header .chevron.collapsed {
  transform: rotate(-90deg);
}

.nav-group-children {
  padding-left: 16px;
  overflow: hidden;
  transition: max-height 0.25s ease;
}

.nav-group-children.collapsed {
  max-height: 0;
}

.nav-item {
  display: block;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition:
    background var(--transition),
    color var(--transition);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-dim);
  color: var(--accent);
  font-weight: 500;
}

/* ---- Mobile Toggle ---- */
#sidebar-toggle {
  display: none;
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 200;
  width: 36px;
  height: 36px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-primary);
}

/* ---- Article Content ---- */
.article-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.article-content h1 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.article-content h2 {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 48px;
  margin-bottom: 16px;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

.article-content h3 {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 32px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.article-content h4 {
  font-size: 16px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.article-content p {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.article-content ul,
.article-content ol {
  margin-bottom: 16px;
  padding-left: 24px;
  color: var(--text-secondary);
}

.article-content li {
  margin-bottom: 6px;
}

.article-content li > ul,
.article-content li > ol {
  margin-top: 6px;
  margin-bottom: 6px;
}

/* ---- Links ---- */
.article-content a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}

.article-content a:hover {
  border-bottom-color: var(--accent);
}

/* ---- Code ---- */
.article-content code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  color: var(--code-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.article-content pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
  overflow-x: auto;
}

.article-content pre code {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
}

/* ---- Blockquote ---- */
.article-content blockquote {
  border-left: 3px solid var(--accent);
  padding: 8px 20px;
  margin-bottom: 16px;
  background: var(--accent-dim);
  border-radius: 0 var(--radius) var(--radius) 0;
}

.article-content blockquote p {
  color: var(--text-primary);
  margin-bottom: 0;
}

.article-content blockquote p:last-child {
  margin-bottom: 0;
}

/* ---- Tables ---- */
.article-content table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  font-size: 14px;
}

.article-content th,
.article-content td {
  border: 1px solid var(--border);
  padding: 10px 14px;
  text-align: left;
}

.article-content th {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.article-content td {
  color: var(--text-secondary);
}

.article-content tr:nth-child(even) td {
  background: var(--bg-tertiary);
}

/* ---- HR ---- */
.article-content hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 40px 0;
}

/* ---- Images ---- */
.article-content img {
  max-width: 100%;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* ---- Task Lists ---- */
.article-content input[type='checkbox'] {
  margin-right: 8px;
  accent-color: var(--accent);
}

/* ---- Breadcrumb ---- */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

.breadcrumb a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition);
}

.breadcrumb a:hover {
  color: var(--accent);
}

.breadcrumb .sep {
  color: var(--border);
}

/* ---- Footer ---- */
.page-footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  #sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  #sidebar.open {
    transform: translateX(0);
  }

  #main {
    margin-left: 0;
  }

  #content {
    padding: 64px 20px 40px;
  }

  #sidebar-toggle {
    display: flex;
  }

  .article-content h1 {
    font-size: 26px;
  }

  .article-content h2 {
    font-size: 20px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add wiki-v2/css/style.css
git commit -m "feat(wiki): add Apple-style minimal stylesheet with auto light/dark theme"
```

---

### Task 3: Write the HTML Template

**Files:**

- Create: `wiki-v2/template.html`

- [ ] **Step 1: Write template.html with navigation injection points**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}} — BonNext Wiki</title>
    <meta name="description" content="BonNext project documentation wiki" />
    <link rel="stylesheet" href="{{basePath}}css/style.css" />
  </head>
  <body>
    <div id="app">
      <aside id="sidebar">
        <div class="sidebar-header">
          <a href="{{basePath}}index.html" class="logo">BonNext Wiki</a>
        </div>
        <div class="search-box">
          <input type="text" id="search-input" placeholder="搜索文档..." autocomplete="off" />
        </div>
        <div id="sidebar-content">{{navigation}}</div>
      </aside>

      <main id="main">
        <button id="sidebar-toggle" aria-label="Toggle sidebar">☰</button>
        <div id="content">
          <nav class="breadcrumb">{{breadcrumb}}</nav>
          <article class="article-content">{{content}}</article>
          <footer class="page-footer">
            <p>BonNext Wiki · 最后更新于 {{lastUpdated}}</p>
          </footer>
        </div>
      </main>
    </div>

    <script>
      // Mobile sidebar toggle
      document.getElementById('sidebar-toggle').addEventListener('click', function () {
        document.getElementById('sidebar').classList.toggle('open');
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', function (e) {
        var sidebar = document.getElementById('sidebar');
        var toggle = document.getElementById('sidebar-toggle');
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && e.target !== toggle) {
            sidebar.classList.remove('open');
          }
        }
      });

      // Navigation tree collapse/expand
      document.querySelectorAll('.nav-group-header').forEach(function (header) {
        header.addEventListener('click', function () {
          var children = this.nextElementSibling;
          var chevron = this.querySelector('.chevron');
          if (children) {
            children.classList.toggle('collapsed');
            if (chevron) chevron.classList.toggle('collapsed');
          }
        });
      });

      // Search filter
      document.getElementById('search-input').addEventListener('input', function (e) {
        var query = e.target.value.toLowerCase().trim();
        var items = document.querySelectorAll('.nav-item');
        var groups = document.querySelectorAll('.nav-group');

        if (!query) {
          items.forEach(function (item) {
            item.style.display = '';
          });
          groups.forEach(function (g) {
            g.style.display = '';
          });
          return;
        }

        groups.forEach(function (group) {
          var groupItems = group.querySelectorAll('.nav-item');
          var hasMatch = false;
          groupItems.forEach(function (item) {
            var text = item.textContent.toLowerCase();
            if (text.indexOf(query) !== -1) {
              item.style.display = '';
              hasMatch = true;
            } else {
              item.style.display = 'none';
            }
          });
          group.style.display = hasMatch ? '' : 'none';
        });
      });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add wiki-v2/template.html
git commit -m "feat(wiki): add HTML template with nav injection points and client JS"
```

---

### Task 4: Write the Build Script

**Files:**

- Create: `wiki-v2/build.js`

- [ ] **Step 1: Write build.js that scans content, converts Markdown, generates static pages**

```javascript
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CONTENT_DIR = path.join(__dirname, 'content');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const CSS_SRC = path.join(__dirname, 'css', 'style.css');

// Ensure dist directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Clean dist directory
function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Copy CSS
function copyAssets() {
  const cssDist = path.join(DIST_DIR, 'css');
  ensureDir(cssDist);
  fs.copyFileSync(CSS_SRC, path.join(cssDist, 'style.css'));
}

// Parse content directory into tree structure
function scanContent(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = scanContent(fullPath, relativePath);
      items.push({
        type: 'folder',
        name: entry.name,
        displayName: extractDisplayName(entry.name),
        path: relativePath,
        children: children,
      });
    } else if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const title = extractTitle(content) || extractDisplayName(entry.name);
      items.push({
        type: 'file',
        name: entry.name,
        displayName: title,
        path: relativePath,
        content: content,
        slug: generateSlug(relativePath),
      });
    }
  }

  // Sort by numeric prefix
  items.sort((a, b) => {
    const numA = extractNumber(a.name);
    const numB = extractNumber(b.name);
    if (numA !== null && numB !== null) return numA - numB;
    if (numA !== null) return -1;
    if (numB !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

// Extract display name (remove numeric prefix like "01-")
function extractDisplayName(filename) {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '');
}

// Extract number prefix for sorting
function extractNumber(filename) {
  const match = filename.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

// Extract H1 title from markdown content
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Generate URL slug from relative path
function generateSlug(relativePath) {
  return relativePath.replace(/\.md$/, '.html').replace(/\\/g, '/');
}

// Generate relative base path for a given file depth
function getBasePath(slug) {
  const depth = slug.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : './';
}

// Build navigation HTML
function buildNavigation(tree, currentSlug, level = 0) {
  let html = '';

  for (const item of tree) {
    if (item.type === 'folder') {
      const hasActiveChild = hasActiveDescendant(item, currentSlug);
      const collapsed = level > 0 && !hasActiveChild ? 'collapsed' : '';
      const chevronCollapsed = collapsed ? 'collapsed' : '';

      html += `<div class="nav-group">`;
      html += `<div class="nav-group-header">`;
      html += `<span class="chevron ${chevronCollapsed}">▼</span>`;
      html += `<span>${escapeHtml(item.displayName)}</span>`;
      html += `</div>`;
      html += `<div class="nav-group-children ${collapsed}">`;
      html += buildNavigation(item.children, currentSlug, level + 1);
      html += `</div></div>`;
    } else {
      const isActive = item.slug === currentSlug;
      const basePath = getBasePath(currentSlug);
      html += `<a href="${basePath}${item.slug}" class="nav-item${isActive ? ' active' : ''}">${escapeHtml(item.displayName)}</a>`;
    }
  }

  return html;
}

// Check if any descendant is the active page
function hasActiveDescendant(item, currentSlug) {
  if (item.type === 'file') return item.slug === currentSlug;
  return item.children.some((child) => hasActiveDescendant(child, currentSlug));
}

// Build breadcrumb HTML
function buildBreadcrumb(tree, currentSlug) {
  const path = findPath(tree, currentSlug);
  if (!path || path.length === 0) return '';

  let html = '<a href="./index.html">首页</a>';
  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    html += ' <span class="sep">/</span> ';
    if (i === path.length - 1) {
      html += `<span>${escapeHtml(item.displayName)}</span>`;
    } else {
      const basePath = getBasePath(currentSlug);
      html += `<a href="${basePath}${item.slug}">${escapeHtml(item.displayName)}</a>`;
    }
  }
  return html;
}

// Find path to current slug in tree
function findPath(tree, currentSlug) {
  for (const item of tree) {
    if (item.type === 'file' && item.slug === currentSlug) {
      return [item];
    }
    if (item.type === 'folder') {
      const childPath = findPath(item.children, currentSlug);
      if (childPath) {
        return [item, ...childPath];
      }
    }
  }
  return null;
}

// Escape HTML entities
function escapeHtml(text) {
  const div = { toString: () => text };
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Generate a single page
function generatePage(template, item, tree) {
  const htmlContent = marked.parse(item.content);
  const navigation = buildNavigation(tree, item.slug);
  const breadcrumb = buildBreadcrumb(tree, item.slug);
  const basePath = getBasePath(item.slug);
  const lastUpdated = new Date().toLocaleDateString('zh-CN');

  return template
    .replace(/\{\{title\}\}/g, item.displayName)
    .replace(/\{\{content\}\}/g, htmlContent)
    .replace(/\{\{navigation\}\}/g, navigation)
    .replace(/\{\{breadcrumb\}\}/g, breadcrumb)
    .replace(/\{\{basePath\}\}/g, basePath)
    .replace(/\{\{lastUpdated\}\}/g, lastUpdated);
}

// Generate index page
function generateIndex(template, tree) {
  const firstFile = findFirstFile(tree);
  if (firstFile) {
    return generatePage(template, firstFile, tree);
  }

  // Fallback: simple index
  const navigation = buildNavigation(tree, '');
  return template
    .replace(/\{\{title\}\}/g, '首页')
    .replace(/\{\{content\}\}/g, '<h1>BonNext Wiki</h1><p>欢迎来到 BonNext 项目文档。</p>')
    .replace(/\{\{navigation\}\}/g, navigation)
    .replace(/\{\{breadcrumb\}\}/g, '<span>首页</span>')
    .replace(/\{\{basePath\}\}/g, './')
    .replace(/\{\{lastUpdated\}\}/g, new Date().toLocaleDateString('zh-CN'));
}

// Find first file in tree (for index redirect)
function findFirstFile(tree) {
  for (const item of tree) {
    if (item.type === 'file') return item;
    if (item.type === 'folder') {
      const found = findFirstFile(item.children);
      if (found) return found;
    }
  }
  return null;
}

// Write all pages
function writePages(tree, template) {
  for (const item of tree) {
    if (item.type === 'folder') {
      writePages(item.children, template);
    } else {
      const pageHtml = generatePage(template, item, tree);
      const outputPath = path.join(DIST_DIR, item.slug);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, pageHtml, 'utf-8');
      console.log('Generated:', item.slug);
    }
  }
}

// Main build function
function build() {
  console.log('Building BonNext Wiki...');

  cleanDist();
  copyAssets();

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const tree = scanContent(CONTENT_DIR);

  // Generate all pages
  writePages(tree, template);

  // Generate index.html (redirects to first page)
  const indexHtml = generateIndex(template, tree);
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml, 'utf-8');
  console.log('Generated: index.html');

  console.log('\nBuild complete! Output in dist/');
}

// Watch mode
function watch() {
  build();
  console.log('\nWatching for changes...');

  const watcher = fs.watch(CONTENT_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      console.log(`\n[${new Date().toLocaleTimeString()}] ${eventType}: ${filename}`);
      try {
        build();
      } catch (err) {
        console.error('Build error:', err.message);
      }
    }
  });

  process.on('SIGINT', () => {
    console.log('\nStopping watcher...');
    watcher.close();
    process.exit(0);
  });
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  watch();
} else {
  build();
}
```

- [ ] **Step 2: Install dependencies and test build**

```bash
cd wiki-v2
npm install
node build.js
```

Expected output:

```
Building BonNext Wiki...
Generated: 01-概述/01-项目简介.html
Generated: 01-概述/02-设计理念.html
Generated: 02-指南/01-快速开始.html
Generated: 02-指南/02-开发环境.html
Generated: 03-开发/01-架构设计.html
Generated: 03-开发/02-API文档.html
Generated: index.html

Build complete! Output in dist/
```

- [ ] **Step 3: Verify dist/ output structure**

```bash
ls -la dist/
ls -la dist/01-概述/
```

Expected:

```
dist/
├── index.html
├── css/
│   └── style.css
├── 01-概述/
│   ├── 01-项目简介.html
│   └── 02-设计理念.html
├── 02-指南/
│   ├── 01-快速开始.html
│   └── 02-开发环境.html
└── 03-开发/
    ├── 01-架构设计.html
    └── 02-API文档.html
```

- [ ] **Step 4: Commit**

```bash
git add wiki-v2/build.js wiki-v2/package.json wiki-v2/content/
git commit -m "feat(wiki): add build script and sample content"
```

---

### Task 5: Test and Verify

**Files:**

- Test: `wiki-v2/dist/` (generated output)

- [ ] **Step 1: Serve dist/ locally and verify in browser**

```bash
cd wiki-v2/dist && python3 -m http.server 8082
```

Open http://localhost:8082 in browser and verify:

- [ ] Sidebar shows tree navigation with folders and files
- [ ] Clicking nav items loads correct pages
- [ ] Breadcrumb shows correct path
- [ ] Markdown renders correctly (headings, lists, code blocks, tables)
- [ ] Light/dark theme switches with system preference
- [ ] Mobile sidebar toggle works
- [ ] Search filters navigation items

- [ ] **Step 2: Stop test server**

```bash
# Ctrl+C to stop
```

- [ ] **Step 3: Final commit**

```bash
git add wiki-v2/
git commit -m "feat(wiki): complete wiki-v2 static site generator"
```

---

## Spec Coverage Check

| Spec Requirement   | Task                                                  |
| ------------------ | ----------------------------------------------------- |
| Apple 极简风格     | Task 2 (CSS)                                          |
| 自动浅色/深色主题  | Task 2 (prefers-color-scheme)                         |
| 树形层级导航       | Task 1 (文件夹结构), Task 4 (build.js nav generation) |
| Markdown 渲染      | Task 4 (marked.parse)                                 |
| 本地 Markdown 编辑 | Task 1 (content/ 目录)                                |
| 构建脚本           | Task 4 (build.js)                                     |
| GitHub Pages 部署  | Task 4 (dist/ 纯静态输出)                             |
| 搜索过滤           | Task 3 (template.html client JS)                      |
| 移动端适配         | Task 2 (responsive CSS), Task 3 (sidebar toggle)      |

## Placeholder Scan

- ✅ No TBD/TODO/fill in later
- ✅ All code shown in full
- ✅ All commands with expected output
- ✅ Type consistency verified (slug, basePath, tree structure)
