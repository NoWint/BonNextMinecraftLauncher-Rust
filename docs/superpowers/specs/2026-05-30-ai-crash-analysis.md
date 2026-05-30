# AI Crash Report Analysis

**Date:** 2026-05-30
**Status:** approved

## Goal

Connect the existing Rust crash parser (35+ error patterns, auto-fix recommendations) to the AI assistant as callable tools, enabling natural-language crash analysis with one-click fixes.

## Existing Assets

- `src-tauri/src/crash_parser.rs` — `parse_crash_report()` + `diagnose_crash()` with severity, suggestions, auto-fix actions
- `src-tauri/src/commands/instance.rs:276-283` — `parse_crash_report` and `diagnose_crash` Tauri commands
- `src/ai/commands.ts` — 7 existing AI tool definitions
- `src/ai/api.ts` — OpenAI-compatible API client
- `src/components/ai/ChatMessage.tsx` — CommandCard component for rendering tool results

## Design

### 1. New AI Tool: `analyze_crash`

Added to `src/ai/commands.ts`:

**Input:** `instance_id: string` (the instance to analyze)
**Risk:** low
**Implementation:**

1. Locate crash report file in the instance's `.minecraft/crash-reports/` directory
2. Call the `diagnose_crash` Tauri command
3. Return structured result: error type, description, suggestion, severity, auto_fix_available, auto_fix_action, additional findings

**Output format (for AI consumption):**

```json
{
  "crash_found": true,
  "error_type": "mod_conflict",
  "description": "Create mod conflicts with OptiFine",
  "suggestion": "Remove OptiFine and install Embeddium instead",
  "severity": "high",
  "auto_fix_available": false,
  "additional_findings": ["Mixin apply error in class ..."]
}
```

### 2. New AI Tool: `apply_fix`

**Input:** `instance_id: string`, `fix_action: string`
**Risk:** high (modifies instance configuration)
**Implementation:**

- Maps fix_action to concrete operations:
  - `increase_memory` → update instance config max_memory
  - `increase_metaspace` → add JVM metaspace args
  - `reinstall_loader` → re-run loader installation
  - `redownload_version` → re-download Minecraft version
  - `remove_duplicate_mods` → list and remove duplicate mods

### 3. System Prompt Update

Add to the AI's system prompt:

```
You can analyze Minecraft crash reports. When a user reports a crash or error,
use the analyze_crash tool to diagnose the problem and suggest fixes.
If an auto-fix is available, offer to apply it using the apply_fix tool.
```

### 4. Frontend API Wrapper

Add to `src/api/`:

```typescript
analyzeCrash: (instanceId: string) => invoke<CrashDiagnosis>('diagnose_crash', { instanceId });
```

## Files to Change

| File                                             | Change                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `src/ai/commands.ts`                             | Add `analyze_crash` and `apply_fix` tool definitions                         |
| `src/api/instances.ts` or new `src/api/crash.ts` | Add Tauri command wrappers                                                   |
| `src/stores/aiAssistantStore.tsx`                | Wire new tools into task execution (minimal change — tool system is generic) |

## Verification

1. Launch a broken instance (or create a dummy crash report)
2. Ask AI: "我的游戏崩溃了，帮我分析一下"
3. AI calls `analyze_crash` → returns diagnosis
4. If auto-fix available, AI offers to `apply_fix`
5. Verify fix is applied correctly
