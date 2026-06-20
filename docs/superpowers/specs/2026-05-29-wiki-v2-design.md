# BonNext Wiki v2 设计规范

## 概述

BonNext Wiki v2 是一个纯前端静态 Wiki 站点生成器。作者通过本地 Markdown 文件编辑内容，运行构建脚本生成可部署的静态 HTML 文件，最终部署到 GitHub Pages 供他人阅读。

## 设计决策汇总

| 决策项   | 选择                               |
| -------- | ---------------------------------- |
| 视觉风格 | Apple 极简风（干净、留白、精致）   |
| 主题模式 | 跟随系统偏好（浅色/深色自动切换）  |
| 导航结构 | 树形层级（文件夹式，支持多级嵌套） |
| 编辑方式 | 本地 Markdown 文件 + 构建脚本      |
| 部署目标 | GitHub Pages（纯静态文件）         |

## 技术架构

```
wiki-v2/
├── content/              # Markdown 源文件
│   ├── 01-概述/
│   │   ├── 01-项目简介.md
│   │   └── 02-设计理念.md
│   ├── 02-指南/
│   │   ├── 01-快速开始.md
│   │   └── 02-开发环境.md
│   └── 03-开发/
│       ├── 01-架构设计.md
│       └── 02-API文档.md
├── build.js              # Node.js 构建脚本
├── template.html         # HTML 模板
├── css/
│   └── style.css         # 样式文件
└── dist/                 # 构建输出（部署到 GitHub Pages）
    ├── index.html
    ├── css/style.css
    └── ...
```

## 构建流程

1. 扫描 `content/` 目录，按文件夹结构生成导航树
2. 读取每个 `.md` 文件，使用 `marked` 转换为 HTML
3. 将内容注入 `template.html`，生成静态页面
4. 输出到 `dist/` 目录

## 视觉设计规范

### 色彩系统（CSS 变量）

```css
/* 浅色模式 */
--bg-primary: #ffffff;
--bg-secondary: #f5f5f7;
--bg-tertiary: #f0f0f2;
--text-primary: #1d1d1f;
--text-secondary: #6e6e73;
--text-muted: #86868b;
--accent: #0071e3;
--accent-dim: rgba(0, 113, 227, 0.08);
--border: #d2d2d7;

/* 深色模式（prefers-color-scheme: dark） */
--bg-primary: #000000;
--bg-secondary: #1d1d1f;
--bg-tertiary: #2d2d2f;
--text-primary: #f5f5f7;
--text-secondary: #a1a1a6;
--text-muted: #6e6e73;
--accent: #2997ff;
--accent-dim: rgba(41, 151, 255, 0.12);
--border: #424245;
```

### 排版

- **字体**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **标题**: 字重 700，行高 1.2
- **正文**: 字重 400，行高 1.75，字号 16px
- **代码**: `'SF Mono', 'Fira Code', monospace`

### 布局

- **侧边栏**: 260px 宽，固定定位，可折叠
- **内容区**: 最大宽度 740px，居中，左右留白自适应
- **间距**: 使用 8px 网格系统

### 导航树交互

- 文件夹可点击展开/折叠
- 当前页面高亮显示
- 支持无限层级嵌套
- 移动端侧边栏可滑动收起

## Markdown 渲染规范

支持标准 Markdown + GitHub Flavored Markdown：

- 标题、段落、列表、链接、图片
- 代码块（带语法高亮）
- 表格
- 任务列表
- 引用块
- 水平分割线

## 文件命名约定

- 使用 `01-标题.md` 格式控制排序
- 文件夹名称即分类名称
- 支持中文文件名

## 构建脚本功能

- `node build.js` — 完整构建
- `node build.js --watch` — 监听文件变化自动重建
- 构建时自动生成搜索索引（JSON 格式）
- 支持全文搜索（前端实现）

## 部署

`dist/` 目录可直接部署到 GitHub Pages：

1. 设置仓库 GitHub Pages 源为 `gh-pages` 分支
2. 构建后推送 `dist/` 内容到 `gh-pages` 分支
3. 或通过 GitHub Actions 自动部署
