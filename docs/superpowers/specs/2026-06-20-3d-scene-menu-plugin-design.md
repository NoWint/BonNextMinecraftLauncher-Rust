# 3D 场景化主菜单插件设计

> 状态：设计已确认，待用户审阅
> 日期：2026-06-20
> 关联：`docs/superpowers/plans/2026-06-20-plugin-system-v2-overhaul.md`（P3-1 ExtensionPoint）

## 1. 概述

### 1.1 目标

构建一个内置插件，将 BonNext 启动器的主界面从静态 2D 仪表盘升级为基于 3D 高斯泼溅（3DGS）的沉浸式 3D 场景主菜单：实时渲染赛博都市天台场景 + 动态镜头推移 + 鼠标视差 + 电影级转场，菜单项为悬浮全息面板。

### 1.2 核心约束

- **必须是插件**，切合现有插件系统（`src/plugins/` 架构）。
- **插件激活时覆盖首页**，**停用时必须完全恢复原样**。
- **不动核心代码**：不修改 `AppShell.tsx` / `HomePage.tsx` / `AppRoutes.tsx` / 插件系统核心。
- **混合升级**：当前以全屏 Overlay Portal 落地（零核心改动）；待 v2 改造 P3-1 ExtensionPoint 落地后，自动升级为 `home:renderer` 贡献点。

### 1.3 非目标（YAGNI）

- 不做音频/环境音/SFX（留作未来）。
- 不做 360° 环绕（SHARP 单图只支持附近视角）。
- 不做 SHARP 运行时推理（Python/PyTorch 不进 Tauri 运行时）。
- 不做第三方插件动态加载（本插件为内置静态注册）。

## 2. 技术背景

### 2.1 SHARP 管线

[apple/ml-sharp](https://github.com/apple/ml-sharp)：单张照片 <1 秒回归出 3DGS 表征（`.ply`），支持实时渲染附近视角 + 度量级相机移动。

**离线管线**（开发者一次性执行）：

1. 选一张有真实深度 cues 的源图（本项目选赛博都市天台夜景）。
2. 跑 `sharp predict -i <image> -o <output.ply>` 生成 3DGS `.ply`。
3. 将 `.ply` 打包进插件 `assets/`。

**运行时管线**（launcher 内）：

1. 插件加载 `.ply` → 浏览器 3DGS 渲染器实时渲染。
2. 相机在 SHARP 安全视角范围内推移 + 视差。
3. 菜单 UI 为 DOM 浮层叠加在 3DGS canvas 上。

### 2.2 现有架构契合点

- **three.js 已可用**：经 `skinview3d` 间接引入 `node_modules/three`。
- **3D 容器模板**：`src/shells/zzz/components/ui/SkinViewer3D.tsx` 提供 `useRef<HTMLCanvasElement>` + 初始化 + dispose 模式。
- **插件系统骨架**：`src/plugins/core/`（PluginManager / PluginContext / definePlugin）就绪，内置插件经 `src/plugins/builtins/index.ts` 静态注册。
- **路由结构**：`src/app/components/AppRoutes.tsx:54-77` 核心路由（`/home` → HomePage）在前，插件路由注入在后，react-router 取首匹配 → 插件无法通过注册 `/home` 覆盖核心首页，故采用 Overlay Portal 方案。

## 3. 架构与插件结构

### 3.1 插件身份

- **id**：`com.bonnext.scene-menu`
- **位置**：`src/plugins/builtins/scene-menu/`（内置插件，静态注册于 `src/plugins/builtins/index.ts`）
- **权限**：`invoke:core:launch`、`invoke:core:instances:read`、`events:listen`、`events:emit`

### 3.2 文件结构

```
src/plugins/builtins/scene-menu/
├── manifest.json              # 声明权限 + 元数据（无 contributes，不走贡献点）
├── index.ts                   # definePlugin: activate 挂载 portal / deactivate 卸载
├── SceneOverlay.tsx           # 顶层 Overlay 组件（createPortal → document.body）
├── SceneRenderer.tsx          # 3DGS canvas 渲染层（@mkkellogg/gaussian-splats-3d）
├── MenuLayer.tsx              # DOM 菜单浮层（4 个全息面板）
├── hooks/
│   ├── useCameraDolly.ts      # 镜头缓推 + 鼠标视差动画
│   ├── useOverlayVisibility.ts # useLocation 判断显隐 + 淡入淡出
│   └── useLaunchLastInstance.ts # 一键启动上次实例
├── assets/
│   ├── scene.ply              # SHARP 离线生成的 3DGS 模型
│   └── scene-fallback.png     # 降级静态图（源图）
└── styles/
    └── overlay.module.css     # Overlay 布局 + 全息面板样式
```

### 3.3 覆盖机制（方案 A：全屏 Overlay Portal）

- `activate(ctx)`：`createPortal(<SceneOverlay ctx={ctx} />, document.body)` 挂载全屏层。
- Overlay 样式：`position: fixed; inset: 0; z-index: 9999`，覆盖侧边栏 + 顶栏 + 首页。
- `deactivate()`：先淡出（300ms）→ 卸载 portal → `viewer.dispose()` → 移除事件监听 → 原样恢复。
- **零核心改动**：不动 AppShell/HomePage/AppRoutes，纯插件侧 React portal。

### 3.4 显隐逻辑（`useOverlayVisibility`）

- 监听 `useLocation()`：路由 = `/home` → overlay 可见；其他路由 → overlay 淡出（不卸载，保留 3DGS 上下文）。
- 菜单项点击 → `useNavigate('/instances' | '/store' | '/settings')` → overlay 淡出 → 目标页带侧边栏显示。
- 侧边栏"主页" → 回 `/home` → overlay 淡入。

**导航模型**：3D 菜单即首页，仅暴露 4 个主入口（启动/实例/商店/设置）。`/home` 时侧边栏被覆盖，用户通过面板进入任一功能区后侧边栏恢复可见，即可访问 versions/collections 等次级路由。即次级导航"先进入一个面板 → 侧边栏出现 → 再跳转"，最多两步。

- 一键启动 → 监听 `launch-state-changed` → `running` 时 overlay 淡出。

## 4. 3DGS 渲染管线

### 4.1 渲染器选型

`@mkkellogg/gaussian-splats-3d`：

- 基于 three.js（与项目现有 three 版本兼容）。
- 原生支持 `.ply` / `.splat` 加载，内置相机控制、splat 裁剪、渐进式加载。
- 浏览器 WebGL2 实时渲染，社区活跃。
- **动态 import 懒加载**，避免进主 bundle（仅本插件使用）。

### 4.2 .ply 加载

- 插件 `assets/scene.ply` 经 Tauri `convertFileSrc()` 转 asset URL。
- `Viewer` 实例 `addSplatScene(url, { progressiveLoad: true })` 渐进式加载（边下边渲）。
- 加载完成前显示 `scene-fallback.png` + 加载进度条；完成后 cross-fade（400ms）到 3DGS 渲染。

### 4.3 相机系统（SHARP 视角约束）

SHARP 单图只能合成**附近视角**，定义安全移动范围（以源图相机为原点）：

- 平移 ±0.3m
- 推进 +0.5m
- 旋转 ±15°

`useCameraDolly` 三层动画：

- **基础层**：相机沿预设路径极缓慢漂移（breathing motion），6 秒一个周期。
- **视差层**：鼠标位置 → 相机微量偏移（lerp 平滑），产生空间感。
- **转场层**：点击菜单项 → 相机 lerp 推进 0.4m + 轻微转向该面板方向，~600ms expo 缓动。

所有移动 clamp 在安全范围内，超出会暴露 SHARP 外推伪影。

### 4.4 性能与资源

- 目标：中端 GPU 60fps；低端 30fps。
- `Viewer` 配置 `splatRenderMode: 'default'`，必要时降 `dynamicDof` / `gpuAcceleratedSort`。
- Overlay 隐藏时（非 `/home` 路由）暂停 `requestAnimationFrame`，降低 GPU 占用。
- 组件卸载 → `viewer.dispose()` 释放 WebGL 上下文 + GPU 内存。
- WebGL 上下文丢失 → 监听 `webglcontextlost` → 降级到静态图。

### 4.5 新增依赖

- `@mkkellogg/gaussian-splats-3d`（运行时，动态 import 懒加载）。

## 5. 场景与镜头设计

### 5.1 场景

赛博都市天台夜景：站在天台边缘俯瞰密集霓虹楼群，黄/青/品红霓虹招牌，雨后湿润反射表面，强深度 cues（近景天台 + 远景楼群），SHARP 最擅长此类场景，完美契合 ZZZ Neo-Tokyo 美学。

### 5.2 菜单面板布局

4 个全息面板，clip-path 切角，backdrop-filter 毛玻璃：

| 面板     | 位置       | 颜色           | 层级   |
| -------- | ---------- | -------------- | ------ |
| 启动游戏 | 左中，较大 | `#FFE600` 黄   | 主面板 |
| 实例     | 中上       | `#00eaff` 青   | 次级   |
| 商店     | 右中       | `#ff00aa` 品红 | 次级   |
| 设置     | 右下，较小 | `#b8a800` 暗黄 | 次级   |

字体：Bebas Neue 标题 + DM Mono 数据，沿用项目设计 token。

### 5.3 镜头规则

- **主菜单状态**：6s 周期 breathing 漂移 + 鼠标视差 ±15°（lerp 平滑）。
- **点击转场**：相机 lerp 推进 0.4m + 转向目标面板，~600ms expo 缓动；目标面板放大展开，其余暗淡 opacity 0.3。再次点击进入目标路由。
- **进入目标路由**：overlay 淡出（300ms），目标页带侧边栏显示；回 `/home` → overlay 淡入。
- **一键启动**：点"启动" → 镜头快速推进 0.5m（400ms）→ 启动上次实例 → `launch-state-changed=running` → overlay 淡出。

## 6. 菜单 UX 与交互

### 6.1 面板交互

- **悬停**：面板发光增强 + 微缩放 1.03 + 相机向该面板方向微移 0.05m（视差引导），~200ms。
- **点击**：进入转场（5.3 节），面板放大 + 其余暗淡。
- **焦点（键盘）**：Tab 在 4 面板间循环，Enter 激活，焦点面板同悬停效果（无障碍）。

### 6.2 入口/出口动画

- 插件 `activate` / 路由到 `/home`：overlay 淡入（opacity 0→1，500ms expo）+ 4 面板 stagger 入场（每个延迟 80ms，clip-path 切角展开）。
- 离开 `/home` / `deactivate`：overlay 淡出 300ms + 面板收回。
- `deactivate` 时先淡出再卸载 portal，避免突兀消失。

### 6.3 一键启动流程（`useLaunchLastInstance`）

1. 点"启动" → 相机快速推进 0.5m（400ms）→ 启动面板显示"正在启动：[实例名]"。
2. 调 `ctx.invoke('launch_game', { instance_id })` 启动上次实例（从 `ctx.invoke('get_instances')` 取 `last_played` 或列表首个）。
3. 监听 `launch-state-changed`：`running` → overlay 淡出；`crashed` → 面板显示错误 + `errorToast`；`downloading` → 面板显示下载进度。
4. 无实例：点"启动" → `useNavigate('/instances/new')`，overlay 淡出。

### 6.4 加载态

- `.ply` 渐进加载：未完成时显示 `scene-fallback.png` + 启动面板位置显示进度条（0–100%）。
- 加载完成 → 淡入 3DGS 渲染（cross-fade 400ms）。

### 6.5 无障碍

- `prefers-reduced-motion: reduce` → 禁用镜头推移/视差，仅静态图 + 面板淡入淡出。
- 面板有 `aria-label`、`role="button"`、`tabIndex`，可纯键盘操作。
- overlay 有 `aria-label="3D 主菜单"`。

## 7. 混合升级路径（P3-1 落地后）

### 7.1 解耦设计

`SceneOverlay` 组件与挂载方式解耦——只接收 `ctx` + `visible`，不关心如何挂载：

```ts
function SceneOverlay({ ctx, visible }: { ctx: PluginContext; visible: boolean }) { ... }
```

### 7.2 迁移逻辑

`activate` 内根据 P3-1 是否可用自动切换：

```ts
activate(ctx) {
  if (typeof ctx.contribute === 'function') {
    // P3-1 已落地：走贡献点
    ctx.contribute('home:renderer', { component: SceneOverlay, priority: 10 });
  } else {
    // 当前：fallback 到 portal
    mountPortal(ctx, SceneOverlay);
  }
}
```

### 7.3 升级后的变化

- AppRoutes 读取 `useExtensions('home:renderer')`，有贡献则渲染插件组件替代 HomePage。
- 插件 `SceneOverlay` 组件本身不变，挂载从 `createPortal` 变成宿主路由内渲染。
- `deactivate` 对应撤销贡献（`ctx.uncontribute`）而非卸载 portal。

### 7.4 过渡期兼容

- P3-1 未落地 → portal 模式，功能完整。
- P3-1 落地 → 自动切换贡献点模式，无需用户操作。
- 两种模式共享同一 `SceneOverlay` 组件 + 同一 hooks，维护成本低。

## 8. 测试与错误处理

### 8.1 错误处理

| 场景                 | 处理                                                            |
| -------------------- | --------------------------------------------------------------- |
| `.ply` 加载失败      | 降级 `scene-fallback.png` + `errorToast`，菜单仍可用            |
| WebGL 不可用         | 同上降级静态图（启动时探测一次）                                |
| WebGL 上下文丢失     | 监听 `webglcontextlost` → `viewer.dispose()` → 降级静态图       |
| `launch_game` 失败   | 启动面板显示错误 + `errorToast`，overlay 保留                   |
| 无实例可启动         | "启动" → `useNavigate('/instances/new')`                        |
| 插件 `activate` 抛错 | PluginManager 已有回滚（撤销 session + 清理注入 + state=error） |
| 相机越界             | `useCameraDolly` 内 clamp 到安全范围，不依赖外部                |

### 8.2 资源安全

- Overlay 隐藏（非 `/home`）→ 暂停 rAF，GPU 闲置。
- 组件卸载 → `viewer.dispose()` 释放 WebGL 上下文 + GPU 内存 + 移除所有事件监听。
- `deactivate` → 先淡出动画再卸载 portal，避免泄漏。

### 8.3 测试策略

- **纯逻辑 hooks 单测**（vitest，若项目未配置则新增）：
  - `useCameraDolly`：相机移动 clamp 在安全范围、breathing 周期正确。
  - `useOverlayVisibility`：路由 `/home` 可见、其他隐藏、淡入淡出状态机。
  - `useLaunchLastInstance`：有实例→启动、无实例→导航、启动失败→错误态。
- **组件测试**：`SceneOverlay` 挂载/卸载无泄漏、降级路径渲染 fallback 图、面板键盘可达。
- **插件生命周期集成**：activate→portal 挂载、deactivate→portal 卸载 + viewer dispose。
- **3DGS 视觉**：WebGL 难以 headless 测试，依赖降级路径单测 + 手动视觉 QA（镜头推移、转场、视差）。
- **手动 QA 清单**：激活/停用可逆性、4 菜单项跳转、一键启动、`prefers-reduced-motion` 降级、低帧率设备。

## 9. 离线 SHARP 生成步骤（开发者参考）

> 不属于插件运行时，仅供生成 `assets/scene.ply` 参考。

1. 克隆 `apple/ml-sharp`，按其 README 配置 Python + PyTorch + GPU（CUDA/MPS）。
2. 准备高分辨率源图（赛博都市天台夜景，建议 1920×1080+，真实深度 cues）。
3. 运行 `sharp predict -i <image> -o scene.ply`。
4. 将 `scene.ply` 放入 `src/plugins/builtins/scene-menu/assets/`。
5. 同步将源图存为 `scene-fallback.png` 作为降级图。

## 10. 开放问题

无。设计已逐节经用户确认。
