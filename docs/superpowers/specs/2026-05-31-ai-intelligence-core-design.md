# AI 智能核心增强设计规格

> 日期: 2026-05-31
> 状态: 已确认
> 子项目: AI 智能核心增强（路线图阶段三核心功能）

## 1. 概述

本设计涵盖 BonNext 启动器 AI 智能核心的 4 项增强功能：

1. **AI 自然语言安装** — 用户输入自然语言需求，AI 自动生成整合包方案并安装
2. **AI 整合包生成器** — 主题驱动的整合包自动生成，含 Mod 筛选、依赖解决、兼容性检查
3. **AI Agent 自主执行** — AI 可自主编排多轮工具调用，完成复杂任务
4. **AI 崩溃分析增强** — 自动检测、一键修复、预防性分析、社区知识库

### 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| AI 模型来源 | 纯用户自带模型（OpenAI 兼容 API） | 保持现有架构，零服务器成本 |
| Agent 自主度 | 完全自主 + 轻量确认点 | 最大化便利性，通过安全保障机制补偿 |
| 交互方式 | 聊天 + 结构化预览 | 对话灵活性与可视化确认的平衡 |
| Mod 知识来源 | 实时调用 Modrinth/CF API | 数据始终最新，零维护成本 |
| 架构模式 | 混合架构（前端编排查询 + 后端工作流执行写入） | 最佳关注点分离 |

## 2. 整体架构

### 分层职责

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React + TypeScript)                               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  AI ChatPanel │  │ ModpackPreview│  │ CrashAnalysis│  │
│  │  (对话入口)   │  │ (结构化预览)  │  │  Panel       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │           │
│  ┌──────▼─────────────────▼──────────────────▼───────┐  │
│  │          AI Agent Orchestrator                     │  │
│  │  (工具调用循环、状态管理、多轮编排)                   │  │
│  │                                                    │  │
│  │  ┌─────────────┐  ┌──────────────────────────┐   │  │
│  │  │ Query Tools │  │ Workflow Trigger Tools    │   │  │
│  │  │ (前端直接   │  │ (触发后端工作流，返回     │   │  │
│  │  │  调用 Tauri │  │  workflow_id，通过事件    │   │  │
│  │  │  命令)      │  │  接收进度)               │   │  │
│  │  └─────────────┘  └──────────────────────────┘   │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │ invoke() / listen()         │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│  后端 (Rust)              │                              │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Workflow Engine                            │ │
│  │  (工作流定义、步骤执行、进度推送、错误恢复、回滚)    │ │
│  │                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ ModpackInstall│  │  CrashFix    │               │ │
│  │  │ Workflow      │  │  Workflow    │               │ │
│  │  └──────────────┘  └──────────────┘               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CrashWatcher │  │ ModCompat    │  │ CrashKnowledge│  │
│  │ (日志监听)   │  │ Checker      │  │ Base          │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 核心原则

1. **查询在前端，写入在后端** — AI Agent 在前端编排只读操作（搜索、查询版本、获取配置），写入操作（安装、创建实例、修复）触发后端工作流
2. **工作流是后端的一等公民** — 每个写入操作封装为带进度、回滚、错误恢复的工作流
3. **AI 是编排者，不是执行者** — AI 决定"做什么"，后端工作流决定"怎么做"
4. **事件驱动进度** — 后端通过 Tauri 事件推送工作流进度，前端实时展示

## 3. AI 工具注册表增强

### 工具分类

当前 `src/ai/commands.ts` 有 10 个工具。增强后分为三类：

| 类别 | 工具 | 风险 | 执行方式 |
|------|------|------|---------|
| **Query（查询）** | `search_mods`, `search_versions`, `get_instances`, `get_config`, `get_mod_versions`, `get_mod_details`, `check_mod_conflicts` | 低 | 前端直接 invoke Tauri 命令 |
| **Workflow（工作流触发）** | `generate_modpack_plan`, `execute_modpack_plan`, `analyze_and_fix_crash`, `predict_compatibility` | 高 | 触发后端工作流，返回 workflow_id |
| **System（系统）** | `launch_game`, `update_settings`, `install_loader` | 高 | 触发后端工作流 |

### 新增工具定义

#### `generate_modpack_plan`

```typescript
{
  name: "generate_modpack_plan",
  description: "根据用户需求生成整合包安装方案。AI 完成搜索和筛选后，调用此工具将方案提交后端验证。",
  parameters: {
    type: "object",
    properties: {
      theme: { type: "string", description: "整合包主题" },
      game_version: { type: "string", description: "Minecraft 版本" },
      loader_type: { type: "string", enum: ["fabric", "forge", "neoforge"] },
      mods: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            version_id: { type: "string" },
            source: { type: "string", enum: ["modrinth", "curseforge"] },
            category: { type: "string", enum: ["core", "automation", "decoration", "optimization", "library"] },
            required: { type: "boolean" }
          },
          required: ["slug", "name", "version_id", "source", "category", "required"]
        }
      },
      jvm_args: { type: "string" },
      max_memory_mb: { type: "number" }
    },
    required: ["theme", "game_version", "loader_type", "mods"]
  }
}
```

#### `execute_modpack_plan`

```typescript
{
  name: "execute_modpack_plan",
  description: "执行已验证的整合包安装方案。触发后端工作流，返回 workflow_id 用于跟踪进度。",
  parameters: {
    type: "object",
    properties: {
      plan_id: { type: "string", description: "generate_modpack_plan 返回的方案 ID" }
    },
    required: ["plan_id"]
  }
}
```

#### `analyze_and_fix_crash`

```typescript
{
  name: "analyze_and_fix_crash",
  description: "分析崩溃报告并生成修复方案。如果用户确认，触发后端工作流执行修复。",
  parameters: {
    type: "object",
    properties: {
      instance_id: { type: "string" },
      crash_report_path: { type: "string" },
      auto_fix: { type: "boolean", description: "是否自动执行修复" }
    },
    required: ["instance_id", "crash_report_path"]
  }
}
```

#### `check_mod_conflicts`

```typescript
{
  name: "check_mod_conflicts",
  description: "检查一组 Mod 之间的兼容性。返回冲突、缺失依赖和警告。",
  parameters: {
    type: "object",
    properties: {
      mods: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug: { type: "string" },
            version_id: { type": "string" },
            source: { type: "string", enum: ["modrinth", "curseforge"] }
          },
          required: ["slug", "version_id", "source"]
        }
      },
      game_version: { type: "string" },
      loader_type: { type: "string" }
    },
    required: ["mods", "game_version"]
  }
}
```

### 增强的系统提示词

在现有 `buildSystemPrompt()` 基础上新增 **Modpack 工作流**：

```
## Modpack Generation Workflow

When the user expresses a desire to play a specific type of gameplay (e.g., "我想玩养老种田", "I want a magic adventure"), follow this workflow:

1. **Understand the theme**: Identify the gameplay theme from the user's description. Common themes: farming, tech/automation, magic, adventure/RPG, exploration, survival, decoration/building, PvP/combat.

2. **Search for mods**: Use search_mods to find relevant mods. Search multiple times with different keywords to get comprehensive results. Prioritize:
   - Core mods that define the theme (e.g., Farmer's Delight for farming)
   - Supporting mods that enhance the theme
   - Optimization mods (essential for any pack)
   - Library mods (required dependencies)

3. **Check compatibility**: Use check_mod_conflicts to verify the selected mods work together.

4. **Generate plan**: Call generate_modpack_plan with the complete mod list and configuration.

5. **Present to user**: Show the ModpackPlan in the structured preview. Wait for user confirmation.

6. **Execute**: If confirmed, call execute_modpack_plan to start the backend workflow.

Important rules:
- Always include optimization mods (Sodium, Lithium for Fabric; Embeddium for Forge/NeoForge)
- Always include at least one minimap mod (JourneyMap, Xaero's) unless the theme is hardcore survival
- Check that all mods support the target game version
- Prefer stable releases over beta/alpha versions
- Include required dependencies even if not explicitly requested
- Recommend JVM memory based on mod count: 2GB base + 256MB per 10 mods
```

## 4. 整合包生成流程

### 完整流程

```
用户: "我想玩养老种田"
         │
         ▼
┌─ AI Agent 编排 (前端) ─────────────────────────────┐
│ 1. AI 调用 search_mods("farming cozy")             │
│    → Modrinth/CF API 返回相关 Mod 列表              │
│                                                     │
│ 2. AI 调用 search_mods("create automation")         │
│    → 补充自动化类 Mod                                │
│                                                     │
│ 3. AI 调用 get_mod_versions(selected_mods)          │
│    → 获取每个 Mod 的兼容版本                         │
│                                                     │
│ 4. AI 调用 check_mod_conflicts(selected_mods)       │
│    → 后端检查 Mod 间兼容性                           │
│                                                     │
│ 5. AI 调用 generate_modpack_plan({                  │
│      theme: "养老种田",                              │
│      version: "1.20.1",                             │
│      loader: "fabric",                              │
│      mods: [...],                                   │
│      jvm_args: "..."                                │
│    })                                               │
│    → 后端验证计划可行性，返回 ModpackPlan + plan_id  │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─ 结构化预览界面 (前端) ────────────────────────────┐
│ ModpackPreview 组件展示:                            │
│   - 基本信息 (版本、加载器、大小)                    │
│   - Mod 列表 (可增删、分类标签)                     │
│   - 兼容性警告                                      │
│   - 推荐 JVM 配置                                   │
│   - 一键安装 / 返回修改 按钮                        │
└─────────────────────┬───────────────────────────────┘
                      │ 用户点击"一键安装"
                      ▼
┌─ 后端工作流执行 (Rust) ───────────────────────────┐
│ execute_modpack_plan(plan_id)                      │
│ Step 1: create_instance                            │
│ Step 2: install_loader                             │
│ Step 3: batch_install_mods (并行下载)              │
│ Step 4: apply_jvm_config                           │
│ Step 5: verify_instance                            │
│ 每步通过事件推送进度                                │
└─────────────────────────────────────────────────────┘
```

### ModpackPlan 数据结构

```typescript
interface ModpackPlan {
  plan_id: string;
  theme: string;
  game_version: string;
  loader: {
    type: "fabric" | "forge" | "neoforge";
    version: string;
  };
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: "modrinth" | "curseforge";
    category: "core" | "automation" | "decoration" | "optimization" | "library";
    required: boolean;
    conflict_with?: string[];
  }>;
  jvm_config: {
    max_memory_mb: number;
    min_memory_mb: number;
    jvm_args: string;
  };
  estimated_size_mb: number;
  warnings: Array<{
    type: "conflict" | "outdated" | "beta";
    message: string;
  }>;
}
```

### ModpackPlanRequest 数据结构

```typescript
interface ModpackPlanRequest {
  theme: string;
  game_version: string;
  loader_type: "fabric" | "forge" | "neoforge";
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: "modrinth" | "curseforge";
    category: string;
    required: boolean;
  }>;
  jvm_args?: string;
  max_memory_mb?: number;
}
```

## 5. AI Agent 自主执行

### Agent 执行模型

增强现有 `aiAssistantStore` 的工具调用循环，支持自主多轮编排：

- **最大轮次**: 10（可配置）
- **超时**: 120s 无响应则终止
- **操作限额**: 每个会话最多 20 次写入操作

### 安全保障机制

| 层级 | 机制 | 说明 |
|------|------|------|
| **L1: 操作审计** | `audit.rs` 记录所有 AI 触发的操作 | 每次工具调用记录：谁触发、什么操作、什么参数、什么结果 |
| **L2: 预执行验证** | 后端工作流在执行前验证计划可行性 | `generate_modpack_plan` 返回前检查：磁盘空间、Java 可用、版本兼容 |
| **L3: 工作流回滚** | 每个工作流步骤创建快照 | 安装失败时可以回滚到工作流开始前的状态 |
| **L4: 紧急停止** | `abort_workflow` 命令 | 用户随时可以中止正在执行的工作流 |
| **L5: 操作限额** | 每个会话最多 N 次写入操作 | 防止 AI 陷入无限循环造成破坏 |
| **L6: 沙盒预览** | 结构化预览界面 | 整合包安装仍经过预览界面——这是"确认点" |

### 轻量确认点

虽然选择完全自主模式，整合包安装等大规模写入操作仍需轻量确认点：

```
AI 自主执行搜索、查询、分析...  ← 无需确认
         │
         ▼
    生成 ModpackPlan
         │
         ▼
  ┌─ 轻量确认点 ────────────────────┐
  │ "AI 准备安装 12 个 Mod 到新实例  │
  │  '养老种田'，预计 350MB"         │
  │                                  │
  │  [查看详情]  [直接安装]  [取消]   │
  └──────────────────────────────────┘
         │
         ▼
  后端工作流自主执行...  ← 无需确认
```

## 6. 崩溃分析增强

### 6.1 自动检测崩溃 (CrashWatcher)

**监听目标**:
- `{instance_dir}/.minecraft/crash-reports/` — 新 .txt 文件出现
- `{instance_dir}/.minecraft/logs/latest.log` — "FATAL" 或 "crashed" 关键词
- 游戏进程非正常退出 (exit code ≠ 0)

**实现**: 使用 `notify` crate (跨平台文件系统监听)

**触发后**: `emit("crash:detected", { instance_id, crash_report_path, timestamp, severity })`

**前端**: 自动弹出 CrashAnalysisPanel

### 6.2 一键修复执行 (CrashFixWorkflow)

```
Step 1: parse_crash_report(path)
Step 2: AI 分析原因 (调用 analyze_crash 工具)
Step 3: 生成修复操作列表
  - 删除冲突 Mod
  - 安装缺失依赖
  - 调整 JVM 参数
  - 降级/升级 Mod 版本
Step 4: 创建实例快照 (回滚点)
Step 5: 执行修复操作
Step 6: 验证修复结果
```

### 6.3 预防性分析 (ModCompatChecker)

**触发时机**:
- 用户安装新 Mod 时
- AI 生成整合包方案时
- 用户手动触发"检查兼容性"

**检查维度**:
1. 版本兼容: Mod 是否支持目标 MC 版本
2. 加载器兼容: Mod 是否支持目标 Loader
3. 已知冲突: 查询本地冲突数据库
4. 依赖缺失: Mod 声明的依赖是否已安装
5. 重复功能: 检测功能重叠的 Mod

**数据来源**:
- Modrinth/CF API 的 Mod 元数据
- 本地 crash_knowledge_base.json (累积)
- Mod 的 relation 字段 (依赖关系)

**输出**:

```typescript
interface CompatibilityReport {
  conflicts: Array<{
    mod_a: string;
    mod_b: string;
    reason: string;
    severity: "error" | "warning";
  }>;
  missing_deps: Array<{
    mod: string;
    required_by: string;
  }>;
  warnings: Array<{
    mod: string;
    issue: string;
  }>;
  score: number; // 0-100
}
```

### 6.4 社区崩溃知识库 (CrashKnowledgeBase)

**存储位置**: `{data_dir}/crash_knowledge_base.json`

**数据结构**:

```json
{
  "patterns": [
    {
      "signature": "java.lang.NoSuchMethodError",
      "mod_context": ["create", "flywheel"],
      "cause": "Create 与 Flywheel 版本不匹配",
      "fix": "升级 Flywheel 到 0.6.11+",
      "source": "local",
      "confidence": 0.95,
      "occurrences": 42
    }
  ]
}
```

**知识来源**:
1. 本地积累: 每次崩溃分析后自动记录
2. 社区同步: (未来) 从 BonNext 服务器拉取
3. AI 生成: AI 分析后提取模式

**匹配算法**:
- 异常类型 + Mod 组合 → 签名匹配
- 模糊匹配: 编辑距离 ≤ 2 的异常消息
- 置信度排序: occurrences × confidence

### 崩溃分析面板 UI

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 检测到崩溃 — 养老种田实例                      │
│                                                  │
│ 📋 崩溃摘要                                      │
│   类型: NoSuchMethodError                        │
│   原因: Create 与 Flywheel 版本不匹配             │
│   置信度: 95%                                    │
│                                                  │
│ 🔧 建议修复                                      │
│   1. 升级 Flywheel 0.6.9 → 0.6.11              │
│   2. (备选) 降级 Create 到 0.5.1f               │
│                                                  │
│ 📊 社区数据                                      │
│   此问题已被 42 位玩家遇到                        │
│   修复成功率: 98%                                 │
│                                                  │
│ 💾 已自动创建实例快照 (回滚点)                     │
│                                                  │
│ [查看完整报告]  [一键修复]  [忽略]                 │
└─────────────────────────────────────────────────┘
```

## 7. 后端工作流引擎

### 核心数据结构

```rust
struct WorkflowEngine {
    active_workflows: HashMap<String, WorkflowHandle>,
    app_handle: AppHandle,
}

struct WorkflowHandle {
    id: String,
    workflow_type: WorkflowType,
    status: WorkflowStatus,
    current_step: usize,
    total_steps: usize,
    snapshot_id: Option<String>,
    started_at: Instant,
    cancel_token: CancellationToken,
}

enum WorkflowType {
    ModpackInstall,
    CrashFix,
    BatchModInstall,
}

enum WorkflowStatus {
    Running,
    Paused,
    Completed,
    Failed(WorkflowError),
    Cancelled,
    RollingBack,
}

trait WorkflowStep: Send + Sync {
    fn id(&self) -> &str;
    fn execute(&self, ctx: &WorkflowContext) -> Result<StepResult, WorkflowError>;
    fn rollback(&self, ctx: &WorkflowContext) -> Result<(), WorkflowError>;
}

struct WorkflowContext {
    app_handle: AppHandle,
    plan: serde_json::Value,
    snapshot: Option<InstanceSnapshot>,
}
```

### ModpackInstallWorkflow

| 步骤 | 操作 | 回滚 |
|------|------|------|
| 1. PreFlightCheck | 验证磁盘空间 ≥ estimated_size_mb × 1.5、Java 可用、版本存在、Mod 可下载 | N/A |
| 2. CreateSnapshot | 对目标实例创建快照 | 删除快照 |
| 3. CreateInstance | 创建实例目录结构、写入 instance.json | 删除实例目录 |
| 4. InstallLoader | 下载并安装 Fabric/Forge/NeoForge | 删除 loader 文件 |
| 5. BatchInstallMods | 并行下载所有 Mod（复用 download queue）、SHA1 校验、安装到 mods/ | 删除已安装的 Mod |
| 6. ApplyJvmConfig | 写入推荐的 JVM 参数 | 恢复原始 JVM 配置 |
| 7. VerifyInstance | 检查所有文件存在、loader 正确安装、check_instance_ready | N/A |

**错误处理**:
- 任何步骤失败 → 自动回滚到快照
- 网络错误 → 重试 3 次
- 磁盘空间不足 → 立即失败 + 清理

### CrashFixWorkflow

| 步骤 | 操作 | 回滚 |
|------|------|------|
| 1. ParseCrashReport | 解析崩溃报告，提取异常栈、Mod 列表 | N/A |
| 2. AnalyzeWithAI | 调用 AI analyze_crash + 查询 CrashKnowledgeBase | N/A |
| 3. CreateSnapshot | 创建实例快照 | 删除快照 |
| 4. ExecuteFixes | 按方案执行修复操作 | 恢复快照 |
| 5. VerifyFix | 检查修复后实例完整性 | N/A |

### Tauri 命令接口

```rust
#[tauri::command]
async fn generate_modpack_plan(plan_request: ModpackPlanRequest) -> Result<ModpackPlan, LauncherError>;

#[tauri::command]
async fn execute_modpack_plan(plan: ModpackPlan) -> Result<String, LauncherError>;
// 返回 workflow_id

#[tauri::command]
async fn execute_crash_fix(instance_id: String, fix_plan: FixPlan) -> Result<String, LauncherError>;
// 返回 workflow_id

#[tauri::command]
async fn abort_workflow(workflow_id: String) -> Result<(), LauncherError>;

#[tauri::command]
async fn get_workflow_status(workflow_id: String) -> Result<WorkflowStatusInfo, LauncherError>;

#[tauri::command]
async fn rollback_workflow(workflow_id: String) -> Result<(), LauncherError>;

#[tauri::command]
async fn check_mod_compatibility(mods: Vec<ModRef>, game_version: String, loader_type: Option<String>) -> Result<CompatibilityReport, LauncherError>;

#[tauri::command]
async fn start_crash_watcher(instance_id: String) -> Result<(), LauncherError>;

#[tauri::command]
async fn stop_crash_watcher(instance_id: String) -> Result<(), LauncherError>;
```

### 事件协议

```typescript
// 工作流进度
"workflow:progress" → {
  workflow_id: string;
  step: number;
  total_steps: number;
  step_name: string;
  detail?: string;
}

// 工作流下载进度
"workflow:download_progress" → {
  workflow_id: string;
  current_file: string;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
}

// 工作流完成
"workflow:complete" → {
  workflow_id: string;
  result: "success" | "rolled_back";
  instance_id?: string;
}

// 工作流错误
"workflow:error" → {
  workflow_id: string;
  step: string;
  error: string;
  recoverable: boolean;
  suggestion?: string;
}

// 崩溃检测
"crash:detected" → {
  instance_id: string;
  crash_report_path: string;
  severity: "fatal" | "warning";
  timestamp: string;
}
```

## 8. 新增前端组件

### ModpackPreview 组件

**位置**: `src/components/ai/ModpackPreview.tsx` + `.module.css`

**功能**:
- 展示 ModpackPlan 的结构化预览
- Mod 列表支持增删、分类筛选
- 兼容性警告高亮
- 推荐 JVM 配置展示
- 一键安装 / 返回修改按钮

**Props**:

```typescript
interface ModpackPreviewProps {
  plan: ModpackPlan;
  onInstall: (planId: string) => void;
  onModify: () => void;
  onCancel: () => void;
}
```

### CrashAnalysisPanel 组件

**位置**: `src/components/ai/CrashAnalysisPanel.tsx` + `.module.css`

**功能**:
- 崩溃摘要展示
- AI 分析结果 + 置信度
- 建议修复列表（可多选）
- 社区数据统计
- 一键修复 / 查看完整报告 / 忽略

**Props**:

```typescript
interface CrashAnalysisPanelProps {
  instanceId: string;
  crashReportPath: string;
  severity: "fatal" | "warning";
  onFix: (instanceId: string, fixPlan: FixPlan) => void;
  onDismiss: () => void;
}
```

### WorkflowProgress 组件

**位置**: `src/components/ai/WorkflowProgress.tsx` + `.module.css`

**功能**:
- 工作流步骤进度条
- 当前步骤描述
- 下载进度（嵌套）
- 紧急停止按钮
- 错误展示 + 重试/回滚选项

**Props**:

```typescript
interface WorkflowProgressProps {
  workflowId: string;
  status: WorkflowStatusInfo;
  onAbort: (workflowId: string) => void;
  onRetry: (workflowId: string) => void;
  onRollback: (workflowId: string) => void;
}
```

## 9. 新增 Rust 模块

| 模块 | 位置 | 职责 |
|------|------|------|
| `workflow/mod.rs` | `src-tauri/src/workflow/` | 工作流引擎核心：WorkflowEngine、WorkflowHandle、WorkflowStep trait |
| `workflow/modpack_install.rs` | `src-tauri/src/workflow/` | ModpackInstallWorkflow 实现 |
| `workflow/crash_fix.rs` | `src-tauri/src/workflow/` | CrashFixWorkflow 实现 |
| `workflow/steps.rs` | `src-tauri/src/workflow/` | 通用步骤实现（PreFlightCheck、CreateSnapshot 等） |
| `crash_watcher.rs` | `src-tauri/src/` | CrashWatcher：文件系统监听、崩溃检测 |
| `mod_compat.rs` | `src-tauri/src/` | ModCompatChecker：兼容性检查引擎 |
| `crash_knowledge.rs` | `src-tauri/src/` | CrashKnowledgeBase：崩溃模式存储与匹配 |

## 10. 新增 Rust 依赖

| 依赖 | 用途 |
|------|------|
| `notify` | 跨平台文件系统事件监听（CrashWatcher） |
| `tokio-util` (CancellationToken) | 工作流取消支持 |
| `uuid` | 工作流 ID 生成 |

## 11. 实现优先级

| 优先级 | 功能 | 依赖 |
|--------|------|------|
| P0 | 后端工作流引擎 | 无 |
| P0 | generate_modpack_plan + execute_modpack_plan 命令 | 工作流引擎 |
| P0 | AI 工具注册表增强 (新增 4 个工具) | 无 |
| P1 | ModpackPreview 组件 | generate_modpack_plan |
| P1 | 整合包生成完整流程串联 | P0 + P1 |
| P1 | CrashWatcher | notify crate |
| P2 | CrashFixWorkflow | 工作流引擎 |
| P2 | CrashAnalysisPanel 组件 | CrashWatcher |
| P2 | ModCompatChecker | 无 |
| P2 | check_mod_compatibility 命令 | ModCompatChecker |
| P3 | CrashKnowledgeBase | 无 |
| P3 | 社区崩溃知识库同步 | CrashKnowledgeBase |
| P3 | Agent 操作限额 + 审计增强 | 无 |
