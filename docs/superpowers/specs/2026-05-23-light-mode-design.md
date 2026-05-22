# BonNext 浅色模式 & 主题切换动画设计

## 概述

为 BonNext 启动器重新设计浅色模式（极简现代风格），实现斜切揭幕主题切换动画，并全局移除粒子背景效果。深色模式和 OLED 模式保持不变。

## 设计决策

| 决策项 | 选择 |
|--------|------|
| 浅色模式美学方向 | 极简现代 — 去噪点/扫描线，保留斜切角+菱形品牌识别 |
| 强调色策略 | 电光黄 #FFE600 保持不变，浅色模式主按钮改为深黑底+黄字 |
| 主题切换动画 | 斜切揭幕 — circle() 从点击位置展开 |
| 粒子背景 | 全局移除（深色/浅色/OLED 均不显示） |
| 深色/OLED 模式 | 完全不动，保留噪点+扫描线氛围层 |

## 一、浅色模式配色体系

### 背景色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--bg-primary` | `#FAFAFA` | 主背景 |
| `--bg-secondary` | `#F0F0F0` | 面板/侧栏 |
| `--bg-card` | `#FFFFFF` | 卡片/弹窗 |

### 文字色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--text-primary` | `#1A1A1A` | 主文字 |
| `--text-secondary` | `#555555` | 次级文字 |
| `--text-muted` | `#888888` | 弱化文字 |
| `--text-dim` | `#BBBBBB` | 更弱文字 |

### 强调色 & 语义色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--accent` | `#FFE600` | 电光黄，保持不变（指示条/标签/高亮/品牌色） |
| `--accent-action` | `#1A1A1A` | 主按钮/选中态背景（浅色模式用深黑替代黄底） |
| `--accent-action-text` | `#FFE600` | 主按钮文字色（配合深黑底） |
| `--success` | `#00AA55` | 成功状态 |
| `--danger` | `#CC2222` | 错误状态 |

### 边框色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--border` | `#E5E5E5` | 默认边框 |
| `--border-mid` | `#D0D0D0` | 中等边框 |
| `--border-hover` | `#B0B0B0` | 悬停边框 |

### 与现有 .theme-light 的关键差异

- `--accent` 保持 `#FFE600` 不变（与现有 `#CCA700` 暗黄不同），确保指示条/标签/高亮等元素保持品牌黄
- 新增 `--accent-action` 变量：深色模式 `#FFE600`（黄底按钮），浅色模式 `#1A1A1A`（深黑底按钮）
- 新增 `--accent-action-text` 变量：深色模式 `#1A1A1A`（黑字），浅色模式 `#FFE600`（黄字）
- 背景从 `#F5F5F5` 改为 `#FAFAFA`（更白更干净）
- 侧栏从 `#E8E8E8` 改为 `#F0F0F0`
- 主按钮从黄底黑字变为深黑底+黄字

## 二、浅色模式组件行为

### 关闭的效果（仅浅色模式）

- 噪点覆盖层 `.noise-overlay` — `display: none`
- 扫描线覆盖层 `.scanline-overlay` — `display: none`

### 保留的元素

- 斜切角 clip-path（所有组件）
- 菱形指示灯（在线/状态）
- Bebas Neue 大标题
- 电光黄指示条/标签
- 呼吸灯动画（状态灯）

### 调整的样式

- 主按钮：背景 `var(--accent-action)` + 文字 `var(--accent-action-text)`（浅色模式为深黑底+黄字）
- 侧栏选中项：背景 `var(--accent-action)` + 黄色左侧指示条
- 卡片：更明显的 box-shadow（`var(--shadow-card)`）
- 滚动条：浅色系
- 文字选中高亮：黄色半透明

### 全局移除

- `ParticleBackground` 组件从 `App.tsx` 渲染树中移除

## 三、斜切揭幕动画

### 技术方案

使用 Web Animations API + `clip-path: circle()` 实现从点击位置向外展开的揭幕效果。

**步骤：**

1. **捕获坐标**：用户点击主题切换按钮时，记录 `click` 的 `(clientX, clientY)`
2. **创建遮罩层**：在 `<html>` 上叠加全屏 `div`，背景为新主题的主背景色，初始 `clip-path: circle(0% at ${x}px ${y}px)`
3. **动画展开**：用 `Element.animate()` 将 `circle` 从 `0%` 展开到覆盖整个视口的最大半径
   - `duration: 500ms`
   - `easing: cubic-bezier(0.16, 1, 0.3, 1)`（ease-out-expo）
   - 最大半径计算：`Math.sqrt(width² + height²)` 取整
4. **切换 & 清理**：动画结束后，切换 `<html>` 的 theme class，移除遮罩层

**为什么用 circle() 而非 polygon()：**
`circle()` 可以用 CSS transition / Web Animations API 做平滑插值，`polygon()` 的顶点变化无法自动插值。揭幕用圆形展开，结束后切换主题时斜切角等品牌元素自然呈现。

### 实现位置

- `themeStore.tsx` — 新增 `switchThemeWithAnimation(newTheme, clickEvent)` 函数
- `SettingsPage.tsx` — 主题切换按钮调用新函数
- `Sidebar` — 如有主题切换入口，同样调用新函数

## 四、硬编码颜色修复

### 问题

项目中存在 235 处硬编码 hex 值（跨 27 个 .module.css 文件），切换到浅色主题时这些值不会变化。

### 修复策略

1. **直接映射**：硬编码值 → 已有的 CSS 变量
   - `#0D0D0D` → `var(--color-bg)`
   - `#FFE600` → `var(--color-accent)`
   - `#FFF` / `#FFFFFF` → `var(--color-text)`

2. **新增变量**：没有对应变量的值 → 在 tokens.css 新增
   - `rgba(255,230,0,0.15)` → `var(--color-accent-15)`
   - `rgba(255,230,0,0.3)` → `var(--color-accent-30)`
   - `rgba(0,0,0,0.5)` → `var(--color-overlay-50)`

3. **主题感知**：浅色模式需不同行为的值 → 在 `.theme-light` 中覆盖

### 需要新增的 CSS 变量

```css
--color-accent-15: rgba(255, 230, 0, 0.15);
--color-accent-30: rgba(255, 230, 0, 0.3);
--color-overlay-50: rgba(0, 0, 0, 0.5);
--color-overlay-80: rgba(0, 0, 0, 0.8);
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.1);
--shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.15);
--selection-bg: rgba(255, 230, 0, 0.3);
--scrollbar-track: transparent;
--scrollbar-thumb: rgba(0, 0, 0, 0.2);
```

### 涉及的文件

所有包含硬编码颜色的 .module.css 文件，包括但不限于：
- Sidebar.module.css
- SettingsPage.module.css
- Modal.module.css
- Button.module.css
- ContentCard.module.css
- HomePage.module.css
- 等 27 个文件

## 五、实施范围

### 样式文件改动

| 文件 | 改动 |
|------|------|
| `tokens.css` | 新增 CSS 变量（阴影、半透明色、滚动条） |
| `themes.css` | 重写 `.theme-light` 配色 + 新增变量覆盖 |
| `global.css` | 浅色模式下关闭噪点/扫描线、浅色滚动条、浅色选中高亮 |
| 27 个 `.module.css` | 硬编码 hex → CSS 变量引用 |

### 组件改动

| 文件 | 改动 |
|------|------|
| `App.tsx` | 移除 `ParticleBackground` 组件 |
| `themeStore.tsx` | 新增 `switchThemeWithAnimation()` 斜切揭幕动画 |
| `SettingsPage.tsx` | 主题切换按钮调用动画函数 |
| `Sidebar` 相关 | 如有主题切换入口，调用动画函数 |

### 不改动

- `.theme-dark` — 完全不动
- `.theme-oled` — 完全不动
- Rust 后端 — 不涉及
- clip-path 体系 — 不变
- 字体体系 — 不变
- 噪点/扫描线在深色/OLED 模式下继续显示
