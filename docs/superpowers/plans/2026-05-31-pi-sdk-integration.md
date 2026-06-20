# Pi SDK 集成实施计划

> 日期: 2026-05-31
> 设计规格: docs/superpowers/specs/2026-05-31-pi-sdk-integration-design.md
> 策略: 4 阶段渐进式迁移，Feature Flag 切换

## 文件结构

```
src/ai/
  api.ts                    ← Phase 4 删除
  commands.ts               ← 保留（工具 execute 逻辑复用）
  taskQueue.ts              ← Phase 4 删除
  types.ts                  ← Phase 4 精简
  pi/                       ← Phase 1 新增
    adapter.ts              ← PiEventAdapter
    tools.ts                ← bonnextTools: AICommand[] → AgentTool[]
    session.ts              ← 会话生命周期管理
    config.ts               ← AIConfig → Pi LLM Config 映射
    persistence.ts          ← 会话持久化
    index.ts                ← 统一导出

src/stores/
  aiAssistantStore.tsx      ← Phase 3 重写 sendMessage

src/components/ai/
  ChatPanel.tsx             ← Phase 3 小改
  BranchSwitcher.tsx        ← Phase 3 新增
  ConfirmDialog.tsx         ← Phase 2 新增
  BranchSwitcher.module.css ← Phase 3 新增
  ConfirmDialog.module.css  ← Phase 2 新增
```

## 任务分解

### Task 1: 安装 Pi SDK 依赖

安装 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@sinclair/typebox`。

```bash
pnpm add @earendil-works/pi-ai @earendil-works/pi-agent-core @earendil-works/pi-coding-agent @sinclair/typebox
```

验证: `pnpm install` 成功，`pnpm build` 不报错。

---

### Task 2: 创建 Pi 配置映射 — `src/ai/pi/config.ts`

将 BonNext 的 `AIConfig` 映射为 Pi SDK 的 LLM 配置格式。

```typescript
import type { AIConfig } from '../types';

export function toPiLLMConfig(config: AIConfig) {
  return {
    provider: 'openai-compatible' as const,
    baseUrl: config.api_url.replace(/\/chat\/completions$/, ''),
    apiKey: config.api_key,
    model: config.model || 'default',
  };
}

export { AIConfig as BonnextAIConfig };
```

验证: tsc 通过。

---

### Task 3: 创建 Pi AgentTool 适配 — `src/ai/pi/tools.ts`

将 14 个 `AICommand` 转为 Pi `AgentTool` 格式，复用 `commandRegistry` 的 `execute` 逻辑。

```typescript
import { Type } from '@sinclair/typebox';
import type { AgentTool } from '@earendil-works/pi-coding-agent';
import { commandRegistry } from '../commands';
import type { AICommand } from '../commands';

export const HIGH_RISK_TOOLS = new Set([
  'install_mod', 'launch_game', 'update_settings',
  'create_instance', 'install_loader', 'apply_fix',
  'execute_modpack_plan', 'analyze_and_fix_crash',
]);

function toAgentTool(cmd: AICommand): AgentTool {
  const properties: Record<string, any> = {};
  for (const [key, def] of Object.entries(cmd.paramDefs)) {
    if (def.type === 'number') {
      properties[key] = Type.Number({ description: def.description });
    } else {
      properties[key] = Type.String({
        description: def.description,
        ...(def.enum ? { enum: def.enum } : {}),
      });
    }
  }
  return {
    name: cmd.name,
    description: cmd.description,
    parameters: Type.Object(properties),
    execute: async (args: Record<string, unknown>) => {
      const result = await cmd.execute(args);
      return JSON.stringify(result);
    },
  };
}

export const bonnextTools: AgentTool[] = Object.values(commandRegistry).map(toAgentTool);
```

验证: tsc 通过。

---

### Task 4: 创建 PiEventAdapter — `src/ai/pi/adapter.ts`

将 Pi 的 `AgentSessionEvent` 异步迭代器转换为 BonNext 的 reducer actions。

完整代码见设计规格第 3.2 节。关键点：
- `agent_start` → `SET_LOADING: true`
- `message_update` → `ADD_MESSAGE` / `UPDATE_MESSAGE`
- `tool_execution_start` → `UPDATE_TASK: { status: 'executing' }`
- `tool_execution_end` → `UPDATE_TASK: { status: 'completed'/'failed' }`
- `agent_end` → `SET_LOADING: false`
- `error` → `SET_ERROR` + `SET_LOADING: false`

验证: tsc 通过。

---

### Task 5: 创建会话管理 — `src/ai/pi/session.ts`

封装 Pi `createAgentSession()` 的创建、恢复、销毁生命周期。

```typescript
import { createAgentSession } from '@earendil-works/pi-coding-agent';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { toPiLLMConfig } from './config';
import { bonnextTools, HIGH_RISK_TOOLS } from './tools';
import type { AIConfig } from '../types';
import type { BonnextAIConfig } from './config';

const pendingConfirmations = new Map<string, (approved: boolean) => void>();

export { pendingConfirmations };

let currentSession: AgentSession | null = null;

export async function getOrCreateSession(config: AIConfig): Promise<AgentSession> {
  if (currentSession) return currentSession;

  const piLLMConfig = toPiLLMConfig(config);
  const session = await createAgentSession({
    llm: piLLMConfig,
    tools: bonnextTools,
    systemPrompt: BONNEXT_SYSTEM_PROMPT,
    compaction: {
      enabled: true,
      strategy: 'summary',
      threshold: 0.8,
      compactModel: config.model,
    },
    hooks: {
      beforeToolCall: async (toolName: string, args: Record<string, unknown>) => {
        if (!HIGH_RISK_TOOLS.has(toolName)) return true;
        return new Promise<boolean>((resolve) => {
          const taskId = `confirm_${Date.now()}`;
          pendingConfirmations.set(taskId, resolve);
          window.dispatchEvent(new CustomEvent('ai:confirm-required', {
            detail: { taskId, toolName, args },
          }));
        });
      },
      afterToolCall: async (toolName: string, args: Record<string, unknown>, result: string) => {
        console.log(`[AI Audit] ${toolName}(${JSON.stringify(args).slice(0, 100)}) → ${result.slice(0, 100)}`);
      },
    },
  });

  currentSession = session;
  return session;
}

export async function destroySession(): Promise<void> {
  if (currentSession) {
    await currentSession.close();
    currentSession = null;
  }
}

export function getCurrentSession(): AgentSession | null {
  return currentSession;
}

const BONNEXT_SYSTEM_PROMPT = `You are BonNext AI, a Minecraft launcher agent. Complete tasks autonomously by calling tools.

MODPACK WORKFLOW: search_versions → search_mods (2-4 queries) → check_mod_conflicts → generate_modpack_plan → execute_modpack_plan
SETUP WORKFLOW: search_versions → create_instance → install_loader → search_mods → install_mod
CRASH WORKFLOW: analyze_crash → analyze_and_fix_crash(auto_fix=true)

Rules:
- Always include optimization mods (Sodium/Lithium for Fabric, Embeddium for Forge)
- Prefer Fabric loader for modpacks
- Use instance_id from create_instance for subsequent calls
- Be concise, execute don't describe`;
```

验证: tsc 通过。

---

### Task 6: 创建会话持久化 — `src/ai/pi/persistence.ts`

实现会话快照的保存、加载、列表功能。

```typescript
import { invoke } from '@tauri-apps/api/core';

interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export async function saveSession(sessionId: string, snapshot: unknown): Promise<void> {
  await invoke('save_ai_session', { sessionId, snapshot: JSON.stringify(snapshot) });
}

export async function loadSession(sessionId: string): Promise<unknown | null> {
  const raw = await invoke<string | null>('load_ai_session', { sessionId });
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function listSessions(): Promise<SessionMeta[]> {
  return await invoke<SessionMeta[]>('list_ai_sessions');
}

export async function deleteSession(sessionId: string): Promise<void> {
  await invoke('delete_ai_session', { sessionId });
}
```

验证: tsc 通过。

---

### Task 7: 创建 Pi 模块统一导出 — `src/ai/pi/index.ts`

```typescript
export { PiEventAdapter } from './adapter';
export { bonnextTools, HIGH_RISK_TOOLS } from './tools';
export { getOrCreateSession, destroySession, getCurrentSession, pendingConfirmations } from './session';
export { toPiLLMConfig } from './config';
export { saveSession, loadSession, listSessions, deleteSession } from './persistence';
```

验证: tsc 通过。

---

### Task 8: 创建 ConfirmDialog 组件

新增 `src/components/ai/ConfirmDialog.tsx` + `src/components/ai/ConfirmDialog.module.css`。

功能：
- 监听 `ai:confirm-required` CustomEvent
- 显示工具名、参数摘要、确认/取消按钮
- 确认 → `pendingConfirmations.get(taskId)(true)`
- 取消 → `pendingConfirmations.get(taskId)(false)`
- ZZZ 风格：clip-path 边角、#FFE600 accent、Bebas Neue 标题

验证: tsc 通过，UI 可渲染。

---

### Task 9: 重写 aiAssistantStore — Pi SDK 路径

在 `src/stores/aiAssistantStore.tsx` 中：

1. 新增 Feature Flag: `const USE_PI_SDK = localStorage.getItem('bonnext_ai_pi_sdk') === 'true';`
2. 新增 `sendMessageViaPi` 函数：
   - 调用 `getOrCreateSession(config)` 获取/创建 session
   - dispatch `ADD_MESSAGE` 添加用户消息
   - 调用 `session.sendMessage(text)`
   - 使用 `PiEventAdapter.processEvents(session.events, dispatch)` 处理所有后续事件
3. 修改 `sendMessage`：根据 Feature Flag 选择 `sendMessageViaPi` 或 `sendMessageViaLegacy`
4. 新增 state 字段: `sessionId`, `branches`, `currentBranch`, `tokenUsage`
5. 新增 actions: `SET_SESSION_ID`, `SET_BRANCHES`, `SWITCH_BRANCH`, `UPDATE_TOKEN_USAGE`
6. 新增 `abortSession` 方法：调用 `session.abort()`
7. 保留 crash alert 和 workflow 事件监听逻辑不变

验证: tsc 通过，legacy 路径不受影响。

---

### Task 10: 创建 BranchSwitcher 组件

新增 `src/components/ai/BranchSwitcher.tsx` + `src/components/ai/BranchSwitcher.module.css`。

功能：
- 显示当前会话的分支列表
- 点击切换分支 → `session.rollback()` 或 `session.fork()`
- ZZZ 风格：紧凑横条，clip-path 边角

验证: tsc 通过。

---

### Task 11: 更新 ChatPanel — 集成新组件

修改 `src/components/ai/ChatPanel.tsx`：

1. 导入并渲染 `ConfirmDialog` 和 `BranchSwitcher`
2. 添加 `pendingConfirmation` state，监听 `ai:confirm-required` 事件
3. `BranchSwitcher` 放在聊天面板顶部
4. `ConfirmDialog` 作为浮层弹窗
5. 添加 `abortSession` 按钮替代当前的手动 abort 逻辑

验证: tsc 通过，UI 正常渲染。

---

### Task 12: Rust 后端 — 会话持久化命令

在 `src-tauri/src/commands/` 新增 AI 会话持久化命令：

```rust
// src-tauri/src/commands/ai_session.rs
#[tauri::command]
pub async fn save_ai_session(session_id: String, snapshot: String, app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai_sessions");
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", session_id));
    tokio::fs::write(path, snapshot).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_ai_session(session_id: String, app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai_sessions");
    let path = dir.join(format!("{}.json", session_id));
    if !path.exists() { return Ok(None); }
    let content = tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    Ok(Some(content))
}

#[tauri::command]
pub async fn list_ai_sessions(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai_sessions");
    if !dir.exists() { return Ok(vec![]); }
    let mut entries = tokio::fs::read_dir(&dir).await.map_err(|e| e.to_string())?;
    let mut sessions = vec![];
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let content = tokio::fs::read_to_string(entry.path()).await.map_err(|e| e.to_string())?;
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            sessions.push(val);
        }
    }
    Ok(sessions)
}

#[tauri::command]
pub async fn delete_ai_session(session_id: String, app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai_sessions");
    let path = dir.join(format!("{}.json", session_id));
    if path.exists() {
        tokio::fs::remove_file(path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

修改：
- `src-tauri/src/commands/mod.rs` — 新增 `pub mod ai_session;`
- `src-tauri/src/lib.rs` — 注册 4 个新命令

验证: `cargo check` 通过。

---

### Task 13: 集成测试与 Feature Flag 启用

1. 设置 Feature Flag: `localStorage.setItem('bonnext_ai_pi_sdk', 'true')`
2. 启动 `pnpm tauri dev`
3. 测试场景：
   - 发送简单消息 → Pi SDK 路径响应
   - 搜索 mod → 工具执行 + 事件反馈
   - 高风险工具 → ConfirmDialog 弹出
   - 长对话 → 上下文压缩触发
   - Abort → session.abort() 正常停止
4. 移除 Feature Flag → legacy 路径正常工作
5. `pnpm build` + `cargo check` 全部通过

---

## 执行顺序

```
Task 1 (依赖安装)
  → Task 2 (config) + Task 3 (tools) + Task 6 (persistence) — 可并行
  → Task 4 (adapter) — 依赖 Task 3
  → Task 5 (session) — 依赖 Task 2, 3, 4
  → Task 7 (index) — 依赖 Task 2-6
  → Task 8 (ConfirmDialog) — 依赖 Task 5
  → Task 9 (store 重写) — 依赖 Task 5, 7
  → Task 10 (BranchSwitcher) — 独立
  → Task 11 (ChatPanel 更新) — 依赖 Task 8, 9, 10
  → Task 12 (Rust 后端) — 独立，可与 Task 8-11 并行
  → Task 13 (集成测试) — 依赖所有
```
