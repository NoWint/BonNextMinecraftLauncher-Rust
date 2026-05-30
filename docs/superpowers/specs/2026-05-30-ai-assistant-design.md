# AI 智能助手设计文档

**日期**: 2026-05-30
**状态**: 已批准

## 概述

为 BonNext Minecraft 启动器集成 AI 智能助手功能，允许用户通过右侧抽屉式聊天面板与 AI 进行自然语言交互，AI 解析用户意图后自动执行启动器操作（搜索/安装模组、启动游戏、修改设置等）。

## 架构决策

**选择方案 A：纯前端架构**

- AI API 调用在前端通过 `fetch` 完成
- 指令解析和任务编排在前端
- 执行层复用现有 `api.xxx()` Tauri IPC 命令
- 无需修改 Rust 后端

理由：BonNext 是桌面应用，API 密钥安全性可控；现有架构是"前端驱动 + 后端执行"模式；开发迭代快。

## 模块结构

| 模块     | 文件                                                | 职责                                                |
| -------- | --------------------------------------------------- | --------------------------------------------------- |
| AI Store | `src/stores/aiAssistantStore.tsx`                   | 聊天状态、消息管理、AI API 调用、指令解析、任务执行 |
| AI API   | `src/api/aiAssistant.ts`                            | OpenAI 兼容 API 封装（流式/非流式）                 |
| 指令系统 | `src/ai/commands.ts`                                | 指令定义、解析器、权限分级                          |
| 任务队列 | `src/ai/taskQueue.ts`                               | 任务队列管理、优先级、顺序执行                      |
| 聊天面板 | `src/components/ai/ChatPanel.tsx` + `.module.css`   | 右侧抽屉式聊天 UI                                   |
| 消息组件 | `src/components/ai/ChatMessage.tsx` + `.module.css` | 单条消息渲染（含指令执行卡片）                      |
| AI 设置  | `src/pages/settings/AISection.tsx`                  | AI API 配置界面                                     |

## AI API 调用

### 配置存储

扩展 `AppConfig`，新增 `ai_config` 字段：

```ts
ai_config: {
  api_url: string; // 默认 http://127.0.0.1:7860/v1/chat/completions
  api_key: string; // API 密钥
  model: string; // 模型名称（空则使用 API 默认）
  enabled: boolean; // 是否启用
}
```

### System Prompt

给 AI 一个严格的指令协议，要求在需要执行操作时返回结构化 JSON 指令块。指令格式：

```json
{"command": "指令名", "params": {...}, "risk_level": "low|high"}
```

多条指令使用数组格式。AI 可以在同一条消息中混合普通文字和 JSON 指令块。

### 流式响应

使用 `fetch` + `ReadableStream` 处理 SSE 流式响应，实时更新聊天界面。

## 指令系统

### 指令注册表

```ts
interface AICommand {
  name: string;
  description: string;
  riskLevel: 'low' | 'high';
  paramsSchema: Record<string, ParamDef>;
  execute: (params: any) => Promise<CommandResult>;
}
```

### 内置指令

| 指令            | 风险级别 | 说明         |
| --------------- | -------- | ------------ |
| search_mods     | low      | 搜索模组     |
| get_instances   | low      | 获取实例列表 |
| get_config      | low      | 获取当前配置 |
| search_versions | low      | 搜索版本     |
| install_mod     | high     | 安装模组     |
| launch_game     | high     | 启动游戏     |
| update_settings | high     | 修改设置     |

### 权限分级

- **low**（自动执行）：搜索、查询、获取信息类操作
- **high**（需用户确认）：安装、启动、修改配置类操作

## 任务队列

```ts
interface Task {
  id: string;
  command: string;
  params: any;
  riskLevel: 'low' | 'high';
  status: 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed';
  result?: CommandResult;
  createdAt: number;
}
```

- 顺序执行，高优先级任务可插队
- low 风险任务自动标记为 confirmed
- high 风险任务需用户在 UI 上确认后才标记为 confirmed
- 支持取消待执行任务

## 聊天 UI

### ChatPanel

右侧抽屉面板，宽 360px，通过按钮或快捷键切换。

- 顶部：标题栏 + 关闭按钮 + 设置图标
- 中部：消息列表（滚动区域）
- 底部：输入框 + 发送按钮

### 消息类型

- 用户消息：右对齐，黄色边框
- AI 消息：左对齐，含 Markdown 渲染
- 指令卡片：内嵌在 AI 消息中，显示指令名 + 参数 + 执行状态
  - low 风险：自动执行，显示进度动画
  - high 风险：显示「确认执行」/「取消」按钮

### 视觉风格

遵循 ZZZ 赛博朋克美学：

- 面板背景：`var(--color-panel)` + noise overlay
- 消息气泡：clip-path 角切
- 指令卡片：accent 黄色边框 + 状态指示灯
- 打字动画：AI 响应时的流式打字效果

## 数据流

```
用户输入 → aiAssistantStore.sendMessage()
  → fetch(AI_API, { messages: [...history, userMsg] })
  → 流式接收 AI 响应
  → 解析响应中的 JSON 指令块
  → 渲染 AI 文字 + 指令卡片
  → low 风险 → 自动执行 → api.xxx()
  → high 风险 → 用户确认 → api.xxx()
  → 结果反馈渲染到聊天中
```

## 错误处理

- AI API 不可达：显示连接错误提示 + 重试按钮
- 指令解析失败：AI 消息正常显示，指令部分标记为解析失败
- 执行失败：指令卡片显示错误信息 + 重试按钮
- API Key 无效：提示用户到设置页面配置

## 设置页面

在 SettingsPage 新增 AI Section：

- 启用/禁用 AI 助手
- API URL 输入框
- API Key 输入框（密码类型）
- 模型名称输入框
- 连接测试按钮

## 可扩展性

新增指令只需在 `src/ai/commands.ts` 中注册新的 `AICommand` 对象，无需修改其他模块。System Prompt 中会动态生成可用指令列表。
