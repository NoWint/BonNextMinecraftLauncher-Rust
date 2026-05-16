# BonNext 启动器 — UI 设计规格说明书

**日期**: 2026-05-16
**版本**: v0.2.0 (UI Redesign)
**设计方向**: 街头拼贴 × 绝区零美学 · 全能型启动器

---

## 1. 设计理念

### 1.1 核心精神

BonNext 的 UI 不走任何“安全牌”。市面上启动器的视觉语言高度同质化 — 要么是官方启动器的圆角白色面板，要么是 Electron 式的深色卡片。我们选择一条不同的路：

**街头 × 地下 × 海报式排版**。参考绝区零（Zenless Zone Zero）的街头美学 — 粗黑边框、电光黄强调色、扫描线噪点纹理、斜切角几何。让启动器看起来不像“一个工具”，而像“一本地下杂志的封面”。

### 1.2 设计原则

| 原则 | 含义 |
|------|------|
| **反 AI 味** | 不用毛玻璃、不用渐变色、不用常规圆角卡片。视觉语言要有“人做出来”的粗糙感和态度 |
| **强识别度** | 单一高亮色（电光黄），看一眼就能认出是 BonNext |
| **信息密度适中** | 不空旷也不拥挤，噪点纹理和几何装饰填充视觉空白 |
| **功能可见性** | 硬边切割的按钮和标签页，操作意图一清二楚 |
| **海报排版** | 标题用 Bebas Neue 窄体大写，正文用 Inter，技术信息用等宽 — 三层字体体系建立清晰的信息层级 |

### 1.3 参考来源

- 绝区零（Zenless Zone Zero）— 街头美学、扫描线、信号干扰、ON AIR 概念
- 地下独立杂志 — 拼贴排版、不对称布局、粗体大字
- 新粗野主义（Neo-Brutalism）— 粗黑边框、原色冲突、反精致

---

## 2. 视觉语言规范

### 2.1 配色方案

| 角色 | 色值 | 用途 |
|------|------|------|
| **背景黑** | `#0D0D0D` | 全局底色，最深的一层 |
| **面板黑** | `#141414` / `#1A1A1A` | 卡片、输入框、次要面板 |
| **边框灰** | `#1A1A1A` / `#1F1F1F` / `#2A2A2A` | 三级边框，从深到浅 |
| **电光黄** | `#FFE600` | 唯一强调色：按钮、高亮、角标、状态指示 |
| **成功绿** | `#00FF88` | 状态指示：就绪、完成 |
| **错误红** | `#FF4444` | 状态指示：错误、危险操作 |
| **文字白** | `#FFFFFF` | 一级文字（标题、激活态） |
| **文字灰** | `#AAA` / `#888` / `#666` / `#555` | 二到四级文字，从亮到暗 |

**配色纪律**：
- 全界面只用 `#FFE600` 一种彩色，禁止引入其他色相
- `#00FF88` 和 `#FF4444` 仅用于状态指示，不参与装饰
- 所有灰色保持中性，不带色偏

### 2.2 字体系统

| 层级 | 字体 | 用途 | 加载方式 |
|------|------|------|----------|
| **标题** | Bebas Neue | 页面大标题、LOGO、PLAY 按钮、章节标题 | Google Fonts / 打包 |
| **正文** | Inter | 所有 UI 标签、正文、导航、设置项 | Google Fonts / 打包 |
| **技术** | DM Mono | 版本号、路径、JVM 参数、状态码、RAM 数值 | Google Fonts / 打包 |
| **中文** | 系统黑体 | 中文字符回退（苹方 / 微软雅黑） | 系统自带 |

**字体使用规则**：
- Bebas Neue：仅用于全大写短文本，字间距 3-8px，不做正文
- Inter：用 400/600/700/800 四个字重，覆盖 UI 全部场景
- DM Mono：用 400/500 两个字重，版本号、代码块、数值显示
- 中文与英文混排时，中文自动回退系统黑体

### 2.3 组件风格：硬边切割

所有交互组件采用 **clip-path 斜切角** 而非 CSS border-radius：

```
主要按钮：  右上角切掉 10px (多边形 8 顶点)
次要按钮：  右上角切掉 6px
小标签：    右上角切掉 3-4px
图标按钮：  右上角切掉 5px
复选框：    右上角切掉 3px
滑块手柄：  右上角切掉 2px
```

**斜切原则**：
- 只切右上角（保持阅读方向的视觉动势）
- 切角大小与元素尺寸成正比
- 次要元素或只读元素可保留直角（不做斜切）

---

## 3. 布局架构

### 3.1 全局布局：侧栏式

```
┌──────────┬─────────────────────────────────────────┐
│          │                                         │
│   LOGO   │         主内容区                         │
│          │                                         │
│  导航     │   ┌─────────┐  ┌───────────────────┐   │
│  ──────  │   │ 欢迎语    │  │                   │   │
│  主页 ◄  │   │ 用户信息  │  │    ▶ START GAME   │   │
│  实例     │   └─────────┘  │                   │   │
│  Mods    │                 │    1.21.4         │   │
│  资源包   │   ┌─────────┐  │    Fabric 0.16    │   │
│  截图     │   │ 实例列表  │  │                   │   │
│          │   │ · 卡片1  │  │    SYS READY ●    │   │
│  ──────  │   │ · 卡片2  │  └───────────────────┘   │
│  设置     │   │ · 卡片3  │                          │
│          │   └─────────┘  ┌───┬───┬───┐           │
│  用户    │                 │RAM│JDK│RES│           │
│  时长    │   ┌─────────┐  └───┴───┴───┘           │
│          │   │ 消息滚动条│                          │
└──────────┴─────────────────────────────────────────┘
```

- **左侧栏**：固定宽度 190px，Logo + 导航 + 用户信息 + 今日时长
- **主内容区**：剩余宽度，左右分栏（实例列表 1.3 : PLAY 区 0.7）

### 3.2 页面层级

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录页 | `/login` | 微软登录 / 离线模式入口 |
| 主页 | `/` | 实例列表 + PLAY 按钮 + 消息条 |
| 实例管理 | `/instances` | 实例增删改查、导入导出 |
| Mods | `/mods` | 当前实例的 Mod 管理 |
| 资源包 | `/resourcepacks` | 资源包管理 |
| 截图 | `/screenshots` | 游戏截图浏览 |
| 设置 | `/settings` | Java/内存/分辨率/JVM 参数/启动行为 |

### 3.3 导航交互

- 侧栏当前页：背景高亮 `#1A1A1A` + 左侧黄色指示条 `#FFE600` + clip-path 斜切
- 切换页面时主内容区淡入过渡（~150ms）
- 面包屑导航在子页面顶部显示层级路径

---

## 4. 页面详细设计

### 4.1 登录页

- 深黑全屏背景 + 噪点纹理
- 居中：BonNext LOGO（六边形 + BEBAS NEUE 字标）
- 微软登录按钮（黄底黑字，大号 PRIMARY 按钮）
- 离线模式入口（小字灰色链接，位于主按钮下方）
- 登录状态：加载中显示进度动画，失败显示错误提示
- 登录成功自动跳转主页

### 4.2 主页（Dashboard）

**顶部行**：
- 左侧：`WELCOME BACK` 大标题（Bebas Neue 1.8em）+ 用户名 + 实例/时长统计
- 右侧：⚡ NEWS 按钮 + `SYS OK` 状态指示

**左侧实例列表**：
- 章节标签 `INSTANCES · 06` + `+ 新建实例` 按钮（黄底黑字）
- 实例卡片 × N，激活态（当前选中）左上角黄色短线标记
- 卡片内容：图标 + 名称 + 标签 + 描述 + 版本号 + RAM 信息
- 底部滚动消息条（`NEWS` 标签 + 消息轮播）

**右侧 PLAY 区**：
- 大面积 PLAY 区域，上下对角黄色角标
- 内部旋转边框装饰
- 大号 ▶ 符号 + `START GAME`（Bebas Neue 分两行）
- 当前实例信息（版本 / Loader / RAM）
- `SYS READY` 状态指示
- 底部统计三连：RAM / JDK / RES

### 4.3 实例管理页

- 顶栏标签或侧栏高亮切换
- 实例列表（同主页卡片样式）+ 新建 / 导入 / 导出 操作
- 点击实例进入详情：版本信息、Mod 列表、存档管理、启动配置
- 删除操作弹出确认弹窗（危险按钮 + 取消）

### 4.4 设置页

- 分组布局，每组有 `SUB SECTION LABEL` 章节标题
- Java 路径：下拉选择 + 浏览按钮
- 内存分配：滑块（1GB - 系统内存 80%）+ 数值显示
- 分辨率：下拉选择
- JVM 参数：文本框（DM Mono 等宽字体）
- 启动后行为：单选按钮组
- 所有控件遵循硬边切割风格

### 4.5 下载进度

- 以半透明覆盖层出现在主页上方
- 进度条 + 文件名 + `已完成/总数`
- 下载速度显示
- 取消按钮（可中断下载）

---

## 5. 控件库完整参考

完整可交互的控件库位于：
> `.superpowers/brainstorm/11466-1778868082/content/ui-kit.html`

包含以下 7 大类：

| # | 类别 | 子项 |
|---|------|------|
| 01 | **按钮** | PRIMARY（大/中/小）、SECONDARY（默认/黄色边框）、ICON（设置/关闭/更多）、DANGER（删除） |
| 02 | **输入控件** | TEXT（聚焦/默认/占位）、SELECT（版本/Java 选择）、TOGGLE（开关-开/关）、CHECKBOX（勾选/未勾选）、SLIDER（RAM 滑块） |
| 03 | **导航** | SIDEBAR（激活/默认/分组线）、TABS（标签栏 + 内容区）、BREADCRUMB（层级路径） |
| 04 | **卡片** | ACTIVE 实例卡、DEFAULT 实例卡、STATS 统计卡、USER 用户卡 |
| 05 | **状态与徽章** | 状态灯（绿/黄/红）、BADGES（版本/加载器/模组数）、PROGRESS（下载/完成）、ACCOUNT TYPE |
| 06 | **装饰与布局** | HEADING 标题、LABELS 标签、DIVIDER 分割线、ACCENTS 角标、TICKER 消息条 |
| 07 | **弹窗** | 确认删除弹窗、新建实例弹窗 |

### 5.1 按钮规格

| 类型 | 背景 | 边框 | 文字色 | 切角 | 字体 |
|------|------|------|--------|------|------|
| Primary L | `#FFE600` | 无 | `#0D0D0D` | 右上 10px | Bebas Neue |
| Primary M | `#FFE600` | 无 | `#0D0D0D` | 右上 6px | Bebas Neue |
| Primary S | `#FFE600` | 无 | `#0D0D0D` | 右上 4px | Bebas Neue |
| Secondary | 透明 | `#333` 1px | `#999` | 右上 6px | Inter |
| Secondary Highlight | 透明 | `#FFE600` 1px | `#FFE600` | 右上 6px | Inter |
| Icon | `#1A1A1A` | `#1F1F1F` 1px | `#888` | 右上 5px | — |
| Danger | 透明 | `#FF4444` 1px | `#FF4444` | 右上 6px | Inter |

### 5.2 输入控件规格

| 类型 | 背景 | 边框 | 文字 | 切角 | 字体 |
|------|------|------|------|------|------|
| Text Input | `#141414` | `#2A2A2A` 1px | `#FFF` / placeholder `#555` | 右上 5px | Inter |
| Select | `#141414` | `#2A2A2A` 1px | `#FFF` + `▼` | 右上 5px | Inter |
| Toggle ON | `#FFE600` | 无 | — | — | — |
| Toggle OFF | `#2A2A2A` | 无 | — | — | — |
| Checkbox ON | `#FFE600` | 无 | `✓` `#0D0D0D` | 右上 3px | — |
| Checkbox OFF | `#1A1A1A` | `#2A2A2A` 1px | — | 右上 3px | — |
| Slider Track | `#2A2A2A` | 无 | — | — | — |
| Slider Fill | `#FFE600` | 无 | — | — | — |
| Slider Thumb | `#FFE600` | 无 | — | 右上 2px | — |

### 5.3 卡片规格

| 状态 | 背景 | 边框 | 特殊标记 | 图标色 |
|------|------|------|----------|--------|
| Active | `#1A1A1A` | `#2A2A2A` | 左上 2px 黄线 | `#FFE600` |
| Default | `#141414` | `#1C1C1C` | 无 | `#555` |
| Stats | `#141414` | `#1C1C1C` | 无 | — |
| User | `#1A1A1A` | `#2A2A2A` | 无 | — |

---

## 6. 装饰系统

### 6.1 纹理层

整个应用叠加两层全局纹理（`pointer-events: none`）：

| 层 | 效果 | 透明度 | 实现 |
|----|------|--------|------|
| **噪点纹理** | SVG feTurbulence 分形噪点 | 2.5% | CSS background-image + SVG filter |
| **扫描线** | 水平间隔 3px 的细线 | 3% | CSS repeating-linear-gradient |

两层叠加让纯黑底色不再平板，有“信号传输中”的质感。

### 6.2 装饰几何

在内容区背景中放置大型装饰性几何框：
- 1px 边框矩形，旋转 ±8° ~ ±12°
- 颜色：`rgba(255,230,0,0.03)` 或 `rgba(255,255,255,0.02)`
- 位置：角落，部分溢出视口
- 不影响任何交互

PLAY 区域内部有旋转 -2° ~ -3° 的细边框矩形，增加空间层次。

### 6.3 角标装饰

在关键区域（PLAY 按钮、侧栏顶部等）使用黄色三角形角标：
- 位置：右上角和/或左下角
- 实现：`border-left/top: Npx solid transparent; border-top/bottom: Npx solid #FFE600;`
- 尺寸：12-24px，与所在元素大小成正比

### 6.4 分割线

三种级别的分割线：
1. **章节分割**：`height: 1px; background: #1A1A1A;` — 通栏灰色线
2. **高亮分割**：`height: 1px; background: #FFE600; opacity: 0.2;` — 黄色半透明
3. **微分割**：`height: 1px; background: #FFE600; opacity: 0.05;` — 极淡黄色

---

## 7. 状态与反馈

### 7.1 状态指示系统

| 状态 | 颜色 | 形状 | 用途 |
|------|------|------|------|
| 就绪 | `#00FF88` | 菱形 `clip-path: polygon(...)` | SYS READY、实例可用 |
| 处理中 | `#FFE600` | 菱形 | 下载中、加载中 |
| 错误 | `#FF4444` | 菱形 | 崩溃、校验失败 |
| 非活跃 | `#555` | 菱形/圆点 | 离线、未选中 |

### 7.2 进度反馈

- 下载进度：黄色进度条 + 百分比数字（DM Mono）
- 完成状态：绿色进度条 + `DONE` 文字
- 所有进度条高度 4px，背景 `#2A2A2A`

### 7.3 弹窗

弹窗背景 `#141414`，边框 `#2A2A2A`，内边距 20px。
- 标题：Bebas Neue 0.85em
- 正文：Inter 0.6em，`#888`
- 按钮组：右对齐，PRIMARY + SECONDARY 组合

---

## 8. 动效指南（初步）

| 场景 | 动效 | 时长 |
|------|------|------|
| 页面切换 | 主内容区淡入 + 微上移 | ~150ms |
| 按钮 hover | 背景/边框颜色过渡 | ~100ms |
| 实例卡片 hover | 边框从 `#1C1C1C` 过渡到 `#2A2A2A` | ~150ms |
| 弹窗出现 | 淡入 + 微缩放 | ~200ms |
| 进度条 | 宽度过渡 | ~300ms ease-out |
| 消息条 | 文字横向滚动（marquee） | 持续 |

> 注：所有动效应在 `prefers-reduced-motion` 时禁用。

---

## 9. 视觉效果参考文件

设计过程中生成的视觉参考文件位于项目 `.superpowers/brainstorm/` 目录：

| 文件 | 内容 |
|------|------|
| `content/visual-style-v2.html` | 四种风格方向探索（新粗野主义/手工质感/复古系统/拼贴杂志） |
| `content/zzz-inspired.html` | ZZZ 风格融合初稿 |
| `content/color-palettes.html` | 四种强调色对比（黄/粉/青/橙） |
| `content/typography.html` | 四种字体方案对比 |
| `content/components.html` | 组件风格 A vs B 对比 |
| `content/navigation.html` | 四种导航布局对比 |
| **`content/final-v2.html`** | **最终设计效果图（丰富版）** |
| **`content/ui-kit.html`** | **完整控件库（7 大类全部组件）** |

> 以上 HTML 文件可通过视觉伴侣服务器在浏览器中查看（`http://localhost:53758`）。

---

## 10. 实现注意事项

### 10.1 CSS 实现要点

- 所有斜切角使用 `clip-path: polygon(...)`，不使用 `border-radius`
- 噪点和扫描线纹理使用 CSS 伪元素 + `pointer-events: none`
- 装饰几何框使用绝对定位 + `z-index: 0`，不阻塞交互
- 字体通过 `@import` 引入或打包到 `src/assets/fonts/`
- 颜色定义为 CSS 自定义属性（`--color-bg`, `--color-accent` 等）

### 10.2 响应式考虑

BonNext 是桌面应用，窗口有最小尺寸限制：
- 最小窗口：960×640
- 推荐窗口：1200×800
- 侧栏宽度固定 190px，主内容区自适应剩余空间
- PLAY 区域最小宽度 280px

### 10.3 无障碍

- 所有交互元素支持键盘导航（Tab / Enter / Escape）
- 状态指示不只依赖颜色（配合文字标签）
- 弹窗支持 Escape 关闭
- `prefers-reduced-motion` 时禁用动画
- 保持足够的颜色对比度（WCAG AA 级以上）

### 10.4 性能

- 噪点纹理在 `window.requestIdleCallback` 或 `useEffect` 中延迟加载
- 大量实例卡片使用虚拟列表（如超过 20 个）
- 字体文件预加载（`<link rel="preload">`）

---

## 11. 设计决策记录

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| 视觉风格 | 原生MC/现代深色/玻璃/极简 → 粗野/手工/复古/拼贴 | 拼贴杂志 × ZZZ | 反 AI 味，有辨识度 |
| 强调色 | 黄/粉/青/橙 | 电光黄 `#FFE600` | 与黑底对比最强，警示感 |
| 标题字体 | Bebas Neue / Space Grotesk / Noto Sans / Impact | Bebas Neue | 窄体全大写，海报感 |
| 组件事 | 硬边切割 / 锐角切割 | 硬边切割 | 攻击性强，辨识度高 |
| 导航布局 | 仪表盘/侧栏/顶栏标签/底栏标签 | 侧栏式 | 功能多时层级清晰 |
| 启动器定位 | 极简派 / 全能派 | 全能派 | 多实例/Mod管理/资源包 |

---

## 附录 A：最终设计效果图

以下为完整的设计效果图 HTML，展示了侧栏导航 + 硬边切割 + 电光黄 + Bebas Neue 字体体系下的 BonNext 主页全貌。可通过视觉伴侣服务器在浏览器中直接预览。

> 源文件：`.superpowers/brainstorm/11466-1778868082/content/final-v2.html`

```html
<h2>最终设计 v2 — 丰富细节版</h2>
<p class="subtitle">增加了纹理、装饰元素、信息密度，让画面更有"料"</p>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
</style>

<div class="mockup">
  <div class="mockup-header">BonNext — Home 页面（丰富版）</div>
  <div class="mockup-body">
    <div style="background: #0D0D0D; display: flex; min-height: 560px; font-family: 'Inter', sans-serif; position: relative; overflow: hidden;">
      
      <!-- Noise texture overlay -->
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.025; background-image: url('data:image/svg+xml,<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.75\" numOctaves=\"4\" stitchTiles=\"stitch\"/></filter><rect width=\"100%\" height=\"100%\" filter=\"url(%23n)\" opacity=\"1\"/></svg>'); pointer-events: none; z-index: 0;"></div>

      <!-- Scanline overlay -->
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.03; background: repeating-linear-gradient(0deg, transparent, transparent 2px, #FFF 2px, #FFF 3px); pointer-events: none; z-index: 0;"></div>

      <!-- Large decorative geometric shapes -->
      <div style="position: absolute; top: -60px; right: -60px; width: 280px; height: 280px; border: 1px solid rgba(255,230,0,0.03); transform: rotate(12deg); pointer-events: none; z-index: 0;"></div>
      <div style="position: absolute; bottom: -80px; left: 120px; width: 200px; height: 200px; border: 1px solid rgba(255,255,255,0.02); transform: rotate(-8deg); pointer-events: none; z-index: 0;"></div>
      
      <!-- Diagonal accent line -->
      <div style="position: absolute; top: 80px; right: 380px; width: 1px; height: 100px; background: rgba(255,230,0,0.04); transform: rotate(-25deg); pointer-events: none; z-index: 0;"></div>

      <!-- SIDEBAR -->
      <div style="width: 190px; background: #0F0F0F; border-right: 1px solid #1A1A1A; display: flex; flex-direction: column; padding: 20px 0; position: relative; z-index: 1; flex-shrink: 0;">
        
        <!-- Logo area -->
        <div style="display: flex; align-items: center; gap: 8px; padding: 0 16px; margin-bottom: 8px;">
          <div style="width: 28px; height: 28px; background: #FFE600; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); flex-shrink: 0;"></div>
          <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1.1em; color: #FFF; letter-spacing: 3px;">BONNEXT</span>
          <span style="font-size: 0.45em; color: #FFE600; margin-left: 2px; letter-spacing: 3px; font-weight: 700;">v0.1</span>
        </div>

        <!-- Broadcast status bar -->
        <div style="margin: 0 16px 16px; background: #111; border: 1px solid #1A1A1A; padding: 6px 10px; display: flex; align-items: center; gap: 6px;">
          <div style="width: 5px; height: 5px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
          <span style="font-family: 'DM Mono', monospace; font-size: 0.42em; color: #666; letter-spacing: 1px;">SIGNAL · ON AIR</span>
        </div>

        <!-- Nav items -->
        <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 8px;">
          <div style="background: #1A1A1A; padding: 10px 12px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%); position: relative;">
            <div style="position: absolute; left: -8px; top: 50%; transform: translateY(-50%); width: 3px; height: 14px; background: #FFE600;"></div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72em; font-weight: 700; color: #FFF; letter-spacing: 1px;">主页</span>
              <span style="font-family: 'DM Mono', monospace; font-size: 0.55em; color: #FFE600; margin-left: auto;">·</span>
            </div>
          </div>
          <div style="padding: 10px 12px; font-size: 0.72em; font-weight: 600; color: #555; letter-spacing: 1px;">实例管理</div>
          <div style="padding: 10px 12px; font-size: 0.72em; font-weight: 600; color: #555; letter-spacing: 1px;">Mods</div>
          <div style="padding: 10px 12px; font-size: 0.72em; font-weight: 600; color: #555; letter-spacing: 1px;">资源包</div>
          <div style="padding: 10px 12px; font-size: 0.72em; font-weight: 600; color: #555; letter-spacing: 1px;">截图</div>
        </div>

        <div style="flex: 1;"></div>

        <!-- Playtime stats -->
        <div style="margin: 0 16px 12px; padding: 0 4px;">
          <div style="font-size: 0.45em; color: #444; letter-spacing: 2px; margin-bottom: 4px;">TODAY</div>
          <div style="display: flex; align-items: baseline; gap: 4px;">
            <span style="font-family: 'DM Mono', monospace; font-size: 0.9em; color: #FFE600; font-weight: 500;">2.4</span>
            <span style="font-size: 0.5em; color: #555;">小时</span>
          </div>
        </div>

        <!-- Bottom area -->
        <div style="border-top: 1px solid #1A1A1A; padding-top: 10px; margin: 0 8px;">
          <div style="padding: 8px 12px; font-size: 0.68em; font-weight: 600; color: #555; letter-spacing: 1px;">设置</div>
          <div style="padding: 8px 12px; display: flex; align-items: center; gap: 8px; margin-top: 2px;">
            <div style="width: 26px; height: 26px; background: #1A1A1A; display: flex; align-items: center; justify-content: center; font-size: 0.7em;">🧟</div>
            <div>
              <span style="font-size: 0.62em; font-weight: 600; color: #AAA;">Steve_Alex</span>
              <div style="font-size: 0.45em; color: #FFE600; letter-spacing: 1px; font-weight: 700;">MS 正版</div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT -->
      <div style="flex: 1; padding: 24px 28px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
        
        <!-- Top bar -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
          <div>
            <div style="font-family: 'Bebas Neue', sans-serif; font-size: 1.8em; color: #FFF; letter-spacing: 4px; line-height: 1;">WELCOME BACK</div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
              <span style="font-size: 0.6em; color: #FFE600; letter-spacing: 2px; font-weight: 700;">Steve_Alex</span>
              <span style="width: 1px; height: 10px; background: #333;"></span>
              <span style="font-size: 0.55em; color: #555; letter-spacing: 1px; font-weight: 600;">6 个实例</span>
              <span style="width: 1px; height: 10px; background: #333;"></span>
              <span style="font-size: 0.55em; color: #555; letter-spacing: 1px; font-weight: 600;">总计 24.5h</span>
            </div>
          </div>
          
          <!-- Top right actions -->
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
            <div style="display: flex; gap: 6px;">
              <div style="background: #141414; border: 1px solid #1F1F1F; padding: 6px 12px; font-size: 0.55em; color: #FFE600; font-weight: 700; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%);">
                ⚡ NEWS
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 6px; height: 6px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
              <span style="font-family: 'DM Mono', monospace; font-size: 0.42em; color: #555;">SYS OK</span>
            </div>
          </div>
        </div>

        <!-- Main grid: instances list + PLAY area -->
        <div style="flex: 1; display: flex; gap: 18px;">
          
          <!-- Left: Instance list (wider, more content) -->
          <div style="flex: 1.3; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.5em; color: #666; letter-spacing: 3px; font-weight: 700;">INSTANCES</span>
                <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #FFE600;">06</span>
              </div>
              <div style="background: #FFE600; color: #0D0D0D; padding: 5px 12px; font-size: 0.55em; font-weight: 800; letter-spacing: 1px; clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%); cursor: default;">
                + 新建实例
              </div>
            </div>

            <!-- Instance card 1 - active, with richer info -->
            <div style="background: #1A1A1A; border: 1px solid #2A2A2A; padding: 14px 16px; position: relative;">
              <div style="position: absolute; top: -1px; left: -1px; width: 34px; height: 2px; background: #FFE600;"></div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; background: #252525; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #FFE600; font-size: 1em;">⛏</div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700; font-size: 0.78em; color: #FFF;">Vanilla 1.21.4</span>
                    <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #FFE600; background: #252525; padding: 2px 6px; letter-spacing: 1px;">1.21.4</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                    <span style="font-size: 0.55em; color: #666;">纯净生存</span>
                    <span style="width: 3px; height: 3px; background: #444;"></span>
                    <span style="font-size: 0.55em; color: #666;">最后游玩 2h 前</span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="text-align: right;">
                    <div style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #FFE600;">4GB</div>
                    <div style="font-size: 0.4em; color: #555;">RAM</div>
                  </div>
                  <div style="width: 10px; height: 10px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
                </div>
              </div>
            </div>

            <!-- Instance card 2 -->
            <div style="background: #141414; border: 1px solid #1C1C1C; padding: 12px 16px; position: relative;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; background: #1A1A1A; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #555; font-size: 1em;">🧵</div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700; font-size: 0.78em; color: #AAA;">Fabric 1.20.4</span>
                    <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555; background: #1A1A1A; padding: 2px 6px;">1.20.4</span>
                    <span style="font-size: 0.48em; color: #444; background: #1A1A1A; padding: 2px 5px; letter-spacing: 1px;">SODIUM</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                    <span style="font-size: 0.55em; color: #555;">Iris · Lithium</span>
                    <span style="width: 3px; height: 3px; background: #333;"></span>
                    <span style="font-size: 0.55em; color: #555;">3天前</span>
                  </div>
                </div>
                <div style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555;">6GB</div>
              </div>
            </div>

            <!-- Instance card 3 -->
            <div style="background: #141414; border: 1px solid #1C1C1C; padding: 12px 16px; position: relative;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; background: #1A1A1A; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #555; font-size: 1em;">🔥</div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700; font-size: 0.78em; color: #AAA;">Forge 1.19.2</span>
                    <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555; background: #1A1A1A; padding: 2px 6px;">1.19.2</span>
                    <span style="font-size: 0.48em; color: #444; background: #1A1A1A; padding: 2px 5px; letter-spacing: 1px;">120+</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                    <span style="font-size: 0.55em; color: #555;">120+ Mods</span>
                    <span style="width: 3px; height: 3px; background: #333;"></span>
                    <span style="font-size: 0.55em; color: #555;">1周前</span>
                  </div>
                </div>
                <div style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555;">8GB</div>
              </div>
            </div>

            <!-- News ticker -->
            <div style="margin-top: auto; background: #111; border: 1px solid #1A1A1A; padding: 8px 14px; display: flex; align-items: center; gap: 10px;">
              <div style="flex-shrink: 0; padding: 3px 8px; background: #1A1A1A; font-family: 'Bebas Neue', sans-serif; font-size: 0.55em; color: #FFE600; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 100%, 0 100%);">NEWS</div>
              <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                <span style="font-size: 0.55em; color: #888;">Minecraft Live 2026 · 新生物群系预告</span>
                <span style="width: 3px; height: 3px; background: #FFE600; opacity: 0.4;"></span>
                <span style="font-size: 0.55em; color: #666;">Sodium 0.7 发布 · 性能提升 40%</span>
                <span style="width: 3px; height: 3px; background: #FFE600; opacity: 0.4;"></span>
                <span style="font-size: 0.55em; color: #555;">社群服务器活动 · 本周六 20:00</span>
              </div>
            </div>
          </div>

          <!-- Right: PLAY area -->
          <div style="flex: 0.7; display: flex; flex-direction: column; gap: 8px;">
            
            <!-- Big PLAY button -->
            <div style="flex: 1; background: #111; border: 1px solid #2A2A2A; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; cursor: default;">
              <div style="position: absolute; top: -1px; right: -1px; width: 0; height: 0; border-left: 24px solid transparent; border-top: 24px solid #FFE600;"></div>
              <div style="position: absolute; bottom: -1px; left: -1px; width: 0; height: 0; border-right: 24px solid transparent; border-bottom: 24px solid #FFE600;"></div>
              
              <!-- Inner rotated frame -->
              <div style="position: absolute; top: 16px; left: 16px; right: 16px; bottom: 16px; border: 1px solid rgba(255,230,0,0.04); transform: rotate(-2deg); pointer-events: none;"></div>
              
              <!-- Vertical accent line -->
              <div style="position: absolute; left: 24px; top: 30px; bottom: 30px; width: 1px; background: rgba(255,230,0,0.05); pointer-events: none;"></div>
              
              <div style="text-align: center; position: relative; z-index: 1;">
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 3.2em; color: #FFE600; letter-spacing: 6px; line-height: 1;">▶</div>
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 1.5em; color: #FFF; letter-spacing: 8px; margin-top: 4px;">START</div>
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 1.5em; color: #FFF; letter-spacing: 8px;">GAME</div>
                
                <!-- Instance info inside PLAY -->
                <div style="margin-top: 18px; padding: 6px 16px; background: #1A1A1A; display: inline-block;">
                  <div style="font-family: 'DM Mono', monospace; font-size: 0.55em; color: #FFE600;">VANILLA 1.21.4</div>
                  <div style="font-family: 'Inter', sans-serif; font-size: 0.45em; color: #555; margin-top: 2px;">Fabric 0.16.10 · 4GB</div>
                </div>

                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 14px;">
                  <div style="width: 5px; height: 5px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
                  <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555;">SYS READY</span>
                </div>
              </div>
            </div>

            <!-- Quick stats row -->
            <div style="display: flex; gap: 6px;">
              <div style="flex: 1; background: #141414; border: 1px solid #1C1C1C; padding: 12px 8px; text-align: center;">
                <div style="font-family: 'DM Mono', monospace; font-size: 0.7em; color: #FFF;">4GB</div>
                <div style="font-size: 0.42em; color: #555; margin-top: 2px; letter-spacing: 1px;">RAM</div>
              </div>
              <div style="flex: 1; background: #141414; border: 1px solid #1C1C1C; padding: 12px 8px; text-align: center;">
                <div style="font-family: 'DM Mono', monospace; font-size: 0.7em; color: #FFF;">J21</div>
                <div style="font-size: 0.42em; color: #555; margin-top: 2px; letter-spacing: 1px;">JDK</div>
              </div>
              <div style="flex: 1; background: #141414; border: 1px solid #1C1C1C; padding: 12px 8px; text-align: center;">
                <div style="font-family: 'DM Mono', monospace; font-size: 0.7em; color: #FFF;">FHD</div>
                <div style="font-size: 0.42em; color: #555; margin-top: 2px; letter-spacing: 1px;">RES</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 附录 B：完整 UI 控件库

以下为 7 大类全部 UI 控件的完整 HTML 源码，覆盖按钮、输入控件、导航、卡片、状态徽章、装饰布局、弹窗等所有组件。可通过视觉伴侣服务器在浏览器中直接预览。

> 源文件：`.superpowers/brainstorm/11466-1778868082/content/ui-kit.html`

```html
<h2>BonNext UI 控件库 · 完整汇总</h2>
<p class="subtitle">黑底 #0D0D0D · 电光黄 #FFE600 · Bebas Neue + Inter + DM Mono · 硬边切割</p>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
</style>

<div style="background: #0D0D0D; padding: 32px; display: flex; flex-direction: column; gap: 36px; font-family: 'Inter', sans-serif;">

  <!-- ==================== 1. BUTTONS ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">01 · 按钮</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">BUTTONS</span>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 14px;">

      <!-- 主要按钮 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">PRIMARY</span>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div style="background: #FFE600; color: #0D0D0D; padding: 12px 32px; font-weight: 800; font-size: 0.8em; letter-spacing: 3px; clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%); font-family: 'Bebas Neue', sans-serif;">开始游戏</div>
          <div style="background: #FFE600; color: #0D0D0D; padding: 8px 20px; font-weight: 800; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%); font-family: 'Bebas Neue', sans-serif;">保存</div>
          <div style="background: #FFE600; color: #0D0D0D; padding: 5px 14px; font-weight: 800; font-size: 0.55em; letter-spacing: 1px; clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%); font-family: 'Bebas Neue', sans-serif;">+ 新建</div>
        </div>
      </div>

      <!-- 次要按钮 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">SECONDARY</span>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div style="border: 1px solid #333; color: #999; padding: 10px 24px; font-weight: 700; font-size: 0.7em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%);">取消</div>
          <div style="border: 1px solid #FFE600; color: #FFE600; padding: 10px 24px; font-weight: 700; font-size: 0.7em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%);">导出</div>
          <div style="background: #1A1A1A; border: 1px solid #1F1F1F; color: #888; padding: 8px 16px; font-weight: 700; font-size: 0.6em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%);">⚡ NEWS</div>
        </div>
      </div>

      <!-- 图标按钮 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">ICON</span>
        <div style="display: flex; gap: 12px;">
          <div style="width: 36px; height: 36px; background: #1A1A1A; border: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: center; font-size: 0.8em; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); color: #888;">⚙</div>
          <div style="width: 36px; height: 36px; background: #1A1A1A; border: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: center; font-size: 0.8em; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); color: #888;">✕</div>
          <div style="width: 36px; height: 36px; background: #1A1A1A; border: 1px solid #1F1F1F; display: flex; align-items: center; justify-content: center; font-size: 0.8em; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); color: #888;">⋯</div>
        </div>
      </div>

      <!-- 危险按钮 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">DANGER</span>
        <div style="display: flex; gap: 12px;">
          <div style="border: 1px solid #FF4444; color: #FF4444; padding: 8px 20px; font-weight: 700; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%);">删除实例</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 2. INPUTS ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">02 · 输入控件</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">INPUTS</span>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 14px;">

      <!-- 文本输入 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">TEXT</span>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="background: #141414; border: 1px solid #2A2A2A; padding: 10px 14px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); min-width: 240px;">
            <span style="color: #FFF; font-size: 0.7em;">实例名称</span>
            <span style="color: #FFE600; margin-left: 4px; font-family: 'DM Mono', monospace;">▌</span>
          </div>
          <div style="background: #141414; border: 1px solid #1F1F1F; padding: 10px 14px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); min-width: 240px;">
            <span style="color: #555; font-size: 0.7em;">输入 JVM 参数...</span>
          </div>
        </div>
      </div>

      <!-- 下拉选择 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">SELECT</span>
        <div style="display: flex; gap: 12px;">
          <div style="background: #141414; border: 1px solid #2A2A2A; padding: 10px 14px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; gap: 24px; min-width: 160px;">
            <span style="color: #FFF; font-size: 0.7em;">1.21.4</span>
            <span style="color: #555; font-size: 0.7em; margin-left: auto;">▼</span>
          </div>
          <div style="background: #141414; border: 1px solid #2A2A2A; padding: 10px 14px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; gap: 24px; min-width: 160px;">
            <span style="color: #FFF; font-size: 0.7em;">Java 21</span>
            <span style="color: #555; font-size: 0.7em; margin-left: auto;">▼</span>
          </div>
        </div>
      </div>

      <!-- 开关 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">TOGGLE</span>
        <div style="display: flex; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 36px; height: 20px; background: #FFE600; border-radius: 10px; position: relative;">
              <div style="position: absolute; right: 3px; top: 3px; width: 14px; height: 14px; background: #0D0D0D; border-radius: 50%;"></div>
            </div>
            <span style="font-size: 0.65em; color: #FFF;">开启</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 36px; height: 20px; background: #2A2A2A; border-radius: 10px; position: relative;">
              <div style="position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; background: #555; border-radius: 50%;"></div>
            </div>
            <span style="font-size: 0.65em; color: #555;">关闭</span>
          </div>
        </div>
      </div>

      <!-- 复选框 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">CHECKBOX</span>
        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 16px; height: 16px; background: #FFE600; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #0D0D0D; font-size: 0.5em;">✓</div>
            <span style="font-size: 0.65em; color: #FFF;">显示快照版本</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 16px; height: 16px; background: #1A1A1A; border: 1px solid #2A2A2A; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%);"></div>
            <span style="font-size: 0.65em; color: #555;">全屏模式</span>
          </div>
        </div>
      </div>

      <!-- 滑块 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">SLIDER</span>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-family: 'DM Mono', monospace; font-size: 0.65em; color: #FFF;">4 GB</span>
          <div style="width: 160px; height: 4px; background: #2A2A2A; position: relative;">
            <div style="position: absolute; left: 0; top: 0; height: 100%; width: 50%; background: #FFE600;"></div>
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #FFE600; clip-path: polygon(0 0, calc(100% - 2px) 0, 100% 2px, 100% 100%, 0 100%);"></div>
          </div>
          <span style="font-family: 'DM Mono', monospace; font-size: 0.55em; color: #555;">16 GB</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 3. NAVIGATION ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">03 · 导航</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">NAVIGATION</span>
    </div>
    
    <div style="display: flex; gap: 32px;">
      
      <!-- 侧栏导航 -->
      <div style="flex: 1;">
        <div style="font-size: 0.5em; color: #666; letter-spacing: 2px; margin-bottom: 10px;">SIDEBAR</div>
        <div style="background: #0F0F0F; border: 1px solid #1A1A1A; padding: 12px; display: flex; flex-direction: column; gap: 2px;">
          <div style="background: #1A1A1A; padding: 8px 10px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); position: relative;">
            <div style="position: absolute; left: -10px; top: 50%; transform: translateY(-50%); width: 3px; height: 12px; background: #FFE600;"></div>
            <span style="font-size: 0.65em; font-weight: 700; color: #FFF; letter-spacing: 1px;">主页</span>
          </div>
          <div style="padding: 8px 10px; font-size: 0.65em; font-weight: 600; color: #555; letter-spacing: 1px;">实例管理</div>
          <div style="padding: 8px 10px; font-size: 0.65em; font-weight: 600; color: #555; letter-spacing: 1px;">Mods</div>
          <div style="padding: 8px 10px; font-size: 0.65em; font-weight: 600; color: #555; letter-spacing: 1px;">资源包</div>
          <div style="padding: 8px 10px; font-size: 0.65em; font-weight: 600; color: #555; letter-spacing: 1px;">截图</div>
          <div style="border-top: 1px solid #1A1A1A; padding-top: 8px; margin-top: 8px;">
            <div style="padding: 8px 10px; font-size: 0.65em; font-weight: 600; color: #555; letter-spacing: 1px;">设置</div>
          </div>
        </div>
      </div>

      <!-- 标签导航 -->
      <div style="flex: 1;">
        <div style="font-size: 0.5em; color: #666; letter-spacing: 2px; margin-bottom: 10px;">TABS</div>
        <div style="border-bottom: 1px solid #1A1A1A; display: flex; gap: 0;">
          <div style="padding: 8px 18px; font-size: 0.65em; font-weight: 700; color: #FFF; border-bottom: 2px solid #FFE600; margin-bottom: -1px;">主页</div>
          <div style="padding: 8px 18px; font-size: 0.65em; font-weight: 600; color: #555;">实例</div>
          <div style="padding: 8px 18px; font-size: 0.65em; font-weight: 600; color: #555;">Mods</div>
          <div style="padding: 8px 18px; font-size: 0.65em; font-weight: 600; color: #555;">设置</div>
        </div>
        <div style="margin-top: 12px; padding: 16px; background: #1A1A1A; border: 1px solid #1F1F1F;">
          <span style="font-size: 0.6em; color: #555;">标签内容区域</span>
        </div>
      </div>

      <!-- 面包屑 -->
      <div style="flex: 1;">
        <div style="font-size: 0.5em; color: #666; letter-spacing: 2px; margin-bottom: 10px;">BREADCRUMB</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.6em; color: #555; font-weight: 600;">实例管理</span>
          <span style="color: #333; font-size: 0.6em;">/</span>
          <span style="font-size: 0.6em; color: #FFE600; font-weight: 700;">Vanilla 1.21.4</span>
          <span style="color: #333; font-size: 0.6em;">/</span>
          <span style="font-size: 0.6em; color: #FFF; font-weight: 600;">设置</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 4. CARDS ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">04 · 卡片</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">CARDS</span>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 10px;">
      
      <!-- 激活实例卡片 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">ACTIVE</span>
        <div style="flex: 1; background: #1A1A1A; border: 1px solid #2A2A2A; padding: 14px 16px; position: relative;">
          <div style="position: absolute; top: -1px; left: -1px; width: 34px; height: 2px; background: #FFE600;"></div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; background: #252525; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #FFE600; font-size: 1em;">⛏</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.75em; color: #FFF;">Vanilla 1.21.4</div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                <span style="font-size: 0.55em; color: #666;">纯净生存</span>
                <span style="color: #444;">·</span>
                <span style="font-size: 0.55em; color: #666;">2h 前</span>
              </div>
            </div>
            <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #FFE600; background: #252525; padding: 2px 6px;">1.21.4</span>
            <div style="width: 8px; height: 8px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
          </div>
        </div>
      </div>

      <!-- 普通实例卡片 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">DEFAULT</span>
        <div style="flex: 1; background: #141414; border: 1px solid #1C1C1C; padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; background: #1A1A1A; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; color: #555;">🧵</div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; font-size: 0.75em; color: #AAA;">Fabric 1.20.4</span>
                <span style="font-size: 0.45em; color: #444; background: #1A1A1A; padding: 2px 5px;">SODIUM</span>
              </div>
              <div style="font-size: 0.55em; color: #555; margin-top: 2px;">Iris · Lithium · 3天前</div>
            </div>
            <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #555;">1.20.4</span>
          </div>
        </div>
      </div>

      <!-- 信息卡片 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">STATS</span>
        <div style="display: flex; gap: 8px;">
          <div style="background: #141414; border: 1px solid #1C1C1C; padding: 16px 24px; text-align: center;">
            <div style="font-family: 'DM Mono', monospace; font-size: 0.9em; color: #FFF; font-weight: 500;">4GB</div>
            <div style="font-size: 0.45em; color: #555; margin-top: 4px; letter-spacing: 2px;">RAM</div>
          </div>
          <div style="background: #141414; border: 1px solid #1C1C1C; padding: 16px 24px; text-align: center;">
            <div style="font-family: 'DM Mono', monospace; font-size: 0.9em; color: #FFF; font-weight: 500;">J21</div>
            <div style="font-size: 0.45em; color: #555; margin-top: 4px; letter-spacing: 2px;">JDK</div>
          </div>
          <div style="background: #141414; border: 1px solid #1C1C1C; padding: 16px 24px; text-align: center;">
            <div style="font-family: 'DM Mono', monospace; font-size: 0.9em; color: #FFF; font-weight: 500;">FHD</div>
            <div style="font-size: 0.45em; color: #555; margin-top: 4px; letter-spacing: 2px;">RES</div>
          </div>
        </div>
      </div>

      <!-- 用户卡片 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">USER</span>
        <div style="background: #1A1A1A; border: 1px solid #2A2A2A; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
          <div style="width: 30px; height: 30px; background: #252525; display: flex; align-items: center; justify-content: center; font-size: 0.8em;">🧟</div>
          <div>
            <div style="font-weight: 700; font-size: 0.7em; color: #FFF;">Steve_Alex</div>
            <div style="font-size: 0.5em; color: #FFE600; letter-spacing: 1px; font-weight: 700;">MICROSOFT</div>
          </div>
          <div style="margin-left: auto; font-size: 0.6em; color: #555;">▼</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 5. STATUS & INDICATORS ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">05 · 状态与徽章</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">STATUS · BADGES</span>
    </div>
    
    <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
      
      <!-- 状态指示灯 -->
      <div>
        <div style="font-size: 0.45em; color: #555; letter-spacing: 2px; margin-bottom: 8px;">STATUS DOTS</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 6px; height: 6px; background: #00FF88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
            <span style="font-size: 0.6em; color: #FFF;">就绪</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 6px; height: 6px; background: #FFE600; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
            <span style="font-size: 0.6em; color: #FFF;">下载中</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 6px; height: 6px; background: #FF4444; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);"></div>
            <span style="font-size: 0.6em; color: #FFF;">错误</span>
          </div>
        </div>
      </div>

      <!-- 徽章标签 -->
      <div>
        <div style="font-size: 0.45em; color: #555; letter-spacing: 2px; margin-bottom: 8px;">BADGES</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #FFE600; background: #252525; padding: 3px 8px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%);">1.21.4</span>
          <span style="font-family: 'DM Mono', monospace; font-size: 0.5em; color: #888; background: #1A1A1A; padding: 3px 8px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%);">FABRIC</span>
          <span style="font-size: 0.5em; color: #555; background: #1A1A1A; padding: 3px 8px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%);">SODIUM</span>
          <span style="font-size: 0.5em; color: #555; background: #1A1A1A; padding: 3px 8px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%); letter-spacing: 1px;">120+</span>
        </div>
      </div>

      <!-- 进度条 -->
      <div>
        <div style="font-size: 0.45em; color: #555; letter-spacing: 2px; margin-bottom: 8px;">PROGRESS</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 180px; height: 4px; background: #2A2A2A;">
              <div style="width: 65%; height: 100%; background: #FFE600;"></div>
            </div>
            <span style="font-family: 'DM Mono', monospace; font-size: 0.55em; color: #FFE600;">65%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 180px; height: 4px; background: #2A2A2A;">
              <div style="width: 100%; height: 100%; background: #00FF88;"></div>
            </div>
            <span style="font-family: 'DM Mono', monospace; font-size: 0.55em; color: #00FF88;">DONE</span>
          </div>
        </div>
      </div>

      <!-- 账号类型 -->
      <div>
        <div style="font-size: 0.45em; color: #555; letter-spacing: 2px; margin-bottom: 8px;">ACCOUNT TYPE</div>
        <div style="display: flex; gap: 8px;">
          <span style="font-size: 0.55em; color: #FFE600; letter-spacing: 2px; font-weight: 700;">MICROSOFT</span>
          <span style="font-size: 0.55em; color: #555; letter-spacing: 1px; font-weight: 600;">OFFLINE</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 6. LAYOUT ELEMENTS ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">06 · 装饰与布局</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">DECORATION · LAYOUT</span>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 14px;">

      <!-- 章节标题 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">HEADING</span>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 1.6em; color: #FFF; letter-spacing: 4px;">WELCOME BACK</div>
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 1.1em; color: #FFF; letter-spacing: 3px;">INSTANCES</div>
          <div style="font-size: 0.55em; color: #666; letter-spacing: 3px; font-weight: 700;">SUB SECTION LABEL</div>
        </div>
      </div>

      <!-- 标签 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">LABELS</span>
        <div style="display: flex; gap: 16px;">
          <div style="padding: 3px 10px; background: #1A1A1A; font-family: 'Bebas Neue', sans-serif; font-size: 0.6em; color: #FFE600; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 100%, 0 100%);">NEWS</div>
          <div style="padding: 3px 10px; background: #1A1A1A; font-family: 'Bebas Neue', sans-serif; font-size: 0.6em; color: #555; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 100%, 0 100%);">INSTANCES</div>
        </div>
      </div>

      <!-- 分割线 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">DIVIDER</span>
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <div style="height: 1px; background: #FFE600; opacity: 0.2;"></div>
          <div style="height: 1px; background: #1A1A1A;"></div>
          <div style="height: 1px; background: #FFE600; opacity: 0.05;"></div>
        </div>
      </div>

      <!-- 装饰角标 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">ACCENTS</span>
        <div style="display: flex; gap: 16px; align-items: flex-end;">
          <div style="position: relative; width: 60px; height: 60px; background: #1A1A1A; border: 1px solid #2A2A2A;">
            <div style="position: absolute; top: -1px; right: -1px; width: 0; height: 0; border-left: 14px solid transparent; border-top: 14px solid #FFE600;"></div>
          </div>
          <div style="position: relative; width: 60px; height: 60px; background: #1A1A1A; border: 1px solid #2A2A2A;">
            <div style="position: absolute; bottom: -1px; left: -1px; width: 0; height: 0; border-right: 14px solid transparent; border-bottom: 14px solid #FFE600;"></div>
          </div>
          <div style="position: relative; width: 60px; height: 60px; background: #1A1A1A; border: 1px solid #2A2A2A;">
            <div style="position: absolute; top: -1px; left: -1px; width: 14px; height: 2px; background: #FFE600;"></div>
          </div>
          <div style="position: relative; width: 60px; height: 60px; background: #1A1A1A; border: 1px solid #2A2A2A;">
            <div style="position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px solid rgba(255,230,0,0.08); transform: rotate(-3deg);"></div>
          </div>
        </div>
      </div>

      <!-- 滚动消息条 -->
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 0.5em; color: #666; width: 110px; text-align: right; letter-spacing: 2px;">TICKER</span>
        <div style="flex: 1; background: #111; border: 1px solid #1A1A1A; padding: 8px 14px; display: flex; align-items: center; gap: 10px;">
          <div style="flex-shrink: 0; padding: 3px 8px; background: #1A1A1A; font-family: 'Bebas Neue', sans-serif; font-size: 0.55em; color: #FFE600; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 100%, 0 100%);">NEWS</div>
          <span style="font-size: 0.55em; color: #888;">Minecraft Live 2026 · 新生物群系预告</span>
          <span style="color: #333;">·</span>
          <span style="font-size: 0.55em; color: #666;">Sodium 0.7 发布</span>
          <span style="color: #333;">·</span>
          <span style="font-size: 0.55em; color: #555;">社群服务器活动</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background: #1A1A1A;"></div>

  <!-- ==================== 7. DIALOG / MODAL ==================== -->
  <div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
      <div style="width: 3px; height: 16px; background: #FFE600;"></div>
      <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1em; color: #FFF; letter-spacing: 3px;">07 · 弹窗</span>
      <span style="width: 20px; height: 1px; background: #333; margin: 0 6px;"></span>
      <span style="font-size: 0.55em; color: #555; letter-spacing: 2px;">MODAL</span>
    </div>
    
    <div style="display: flex; gap: 20px;">
      <!-- 确认弹窗 -->
      <div style="background: #141414; border: 1px solid #2A2A2A; padding: 20px; min-width: 260px;">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 0.85em; color: #FFF; letter-spacing: 3px; margin-bottom: 12px;">确认删除</div>
        <div style="font-size: 0.6em; color: #888; margin-bottom: 16px; line-height: 1.5;">确定要删除实例 "Forge 1.19.2" 吗？此操作不可撤销。</div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <div style="border: 1px solid #333; color: #999; padding: 8px 20px; font-weight: 700; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%);">取消</div>
          <div style="border: 1px solid #FF4444; color: #FF4444; padding: 8px 20px; font-weight: 700; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%);">删除</div>
        </div>
      </div>

      <!-- 新建实例弹窗 -->
      <div style="background: #141414; border: 1px solid #2A2A2A; padding: 20px; min-width: 280px;">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 0.85em; color: #FFF; letter-spacing: 3px; margin-bottom: 14px;">新建实例</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="background: #0D0D0D; border: 1px solid #2A2A2A; padding: 8px 12px; clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%);">
            <span style="color: #FFF; font-size: 0.65em;">实例名称</span>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #2A2A2A; padding: 8px 12px; clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%); display: flex; justify-content: space-between;">
            <span style="color: #FFF; font-size: 0.65em;">Minecraft 1.21.4</span>
            <span style="color: #555;">▼</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
          <div style="border: 1px solid #333; color: #999; padding: 8px 20px; font-weight: 700; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%);">取消</div>
          <div style="background: #FFE600; color: #0D0D0D; padding: 8px 20px; font-weight: 800; font-size: 0.65em; letter-spacing: 2px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%); font-family: 'Bebas Neue', sans-serif;">创建</div>
        </div>
      </div>
    </div>
  </div>

</div>
```