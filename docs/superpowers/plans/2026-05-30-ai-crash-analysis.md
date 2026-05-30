# AI Crash Report Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect existing Rust crash parser to AI assistant as callable tools for natural-language crash diagnosis with auto-fix.

**Architecture:** Add two new AI tool definitions (`analyze_crash`, `apply_fix`) to the existing command registry. The `analyze_crash` tool calls the existing `diagnose_crash` Tauri command. The `apply_fix` tool maps fix action names to instance config mutations. Update the system prompt so the AI knows about crash analysis.

**Tech Stack:** TypeScript, Tauri IPC, existing crash_parser.rs

---

### Task 1: Add Crash API Wrapper

**Files:**

- Create: `src/api/crash.ts`

Copy the full file:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { CrashDiagnosis, CrashInfo } from './types';

export const crashApi = {
  parseCrashReport: (reportPath: string) => invoke<CrashInfo>('parse_crash_report', { reportPath }),

  diagnoseCrash: (instanceId: string) => invoke<CrashDiagnosis>('diagnose_crash', { instanceId }),
};
```

- [ ] **Step 1: Run type check to verify types**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: No errors (types already exist in types.ts)

- [ ] **Step 2: Commit**

```bash
git add src/api/crash.ts
git commit -m "feat: add crash API wrapper for AI tool integration"
```

---

### Task 2: Add `analyze_crash` and `apply_fix` AI Tools

**Files:**

- Modify: `src/ai/commands.ts`

- [ ] **Step 1: Add import for crash API**

Add at line 2 (after `import { api } from '../api';`):

```typescript
import { crashApi } from '../api/crash';
```

- [ ] **Step 2: Add `analyze_crash` tool definition**

Add to `commandRegistry` object (after `search_versions`):

```typescript
  analyze_crash: {
    name: 'analyze_crash',
    description: 'Analyze a Minecraft crash report for an instance. Returns error type, description, suggestions, severity, and whether an automatic fix is available.',
    riskLevel: 'low',
    paramDefs: {
      instance_id: { type: 'string', description: 'The instance ID to analyze crash reports for', required: true },
    },
    execute: async (params) => {
      try {
        const instanceId = String(params.instance_id || '');
        const diagnosis = await crashApi.diagnoseCrash(instanceId);
        return {
          success: true,
          data: diagnosis,
          message: diagnosis.crash_info?.description
            ? `Crash found: ${diagnosis.crash_info.description}`
            : 'No crash report found for this instance',
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Crash analysis failed' };
      }
    },
  },
```

- [ ] **Step 3: Add `apply_fix` tool definition**

Add after `analyze_crash`:

```typescript
  apply_fix: {
    name: 'apply_fix',
    description: 'Apply an automatic fix for a diagnosed crash. Requires user confirmation. Available actions: increase_memory, increase_metaspace, reinstall_loader, redownload_version, remove_duplicate_mods, check_java, reset_launch_state, relogin.',
    riskLevel: 'high',
    paramDefs: {
      instance_id: { type: 'string', description: 'The instance ID to apply the fix to', required: true },
      fix_action: {
        type: 'string',
        description: 'The fix action to apply',
        required: true,
        enum: ['increase_memory', 'increase_metaspace', 'reinstall_loader', 'redownload_version', 'remove_duplicate_mods', 'check_java', 'reset_launch_state', 'relogin'],
      },
    },
    execute: async (params) => {
      try {
        const instanceId = String(params.instance_id || '');
        const action = String(params.fix_action || '');
        const instances = await api.listInstances();
        const instance = instances.find((i) => i.id === instanceId);
        if (!instance) return { success: false, error: `Instance ${instanceId} not found` };

        switch (action) {
          case 'increase_memory': {
            const currentMax = instance.max_memory || 2048;
            const newMax = Math.min(currentMax * 2, 16384);
            const config = await api.getConfig();
            const configObj = config as unknown as Record<string, unknown>;
            configObj.max_memory = newMax;
            await api.saveConfig(config);
            return { success: true, message: `Increased max memory from ${currentMax}MB to ${newMax}MB` };
          }
          case 'increase_metaspace': {
            const currentJvm = instance.jvm_args || '';
            const newArgs = currentJvm.includes('-XX:MaxMetaspaceSize')
              ? currentJvm.replace(/-XX:MaxMetaspaceSize=\d+m?/i, '-XX:MaxMetaspaceSize=512m')
              : `${currentJvm} -XX:MaxMetaspaceSize=512m`.trim();
            await api.updateInstance({ id: instanceId, jvm_args: newArgs });
            return { success: true, message: 'Increased MaxMetaspaceSize to 512m' };
          }
          case 'reinstall_loader': {
            if (instance.loader_type && instance.loader_version) {
              await api.installLoader(instanceId, instance.loader_type, instance.loader_version);
              return { success: true, message: `Reinstalled ${instance.loader_type} ${instance.loader_version}` };
            }
            return { success: false, error: 'No loader information found for this instance' };
          }
          case 'redownload_version': {
            await api.downloadVersion(instance.version_id, instance.version_url);
            return { success: true, message: `Redownloaded Minecraft ${instance.version_id}` };
          }
          case 'remove_duplicate_mods': {
            const mods = await api.listInstanceMods(instanceId);
            const seen = new Map<string, number>();
            const duplicates: string[] = [];
            for (const mod of mods) {
              const count = seen.get(mod.filename) || 0;
              if (count > 0) duplicates.push(mod.filename);
              seen.set(mod.filename, count + 1);
            }
            if (duplicates.length === 0) return { success: true, message: 'No duplicate mods found' };
            return { success: true, message: `Found ${duplicates.length} duplicate mod(s): ${duplicates.join(', ')}. Please remove duplicates manually from the mods folder.` };
          }
          case 'check_java': {
            const javaList = await api.findAllJava();
            return { success: true, data: javaList, message: `Found ${javaList.length} Java installation(s)` };
          }
          case 'reset_launch_state': {
            await api.resetLaunchState();
            return { success: true, message: 'Launch state reset successfully' };
          }
          case 'relogin': {
            return { success: true, message: 'Please log out and log in again from the settings page to refresh your authentication.' };
          }
          default:
            return { success: false, error: `Unknown fix action: ${action}` };
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Fix application failed' };
      }
    },
  },
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/ai/commands.ts src/api/crash.ts
git commit -m "feat: add analyze_crash and apply_fix AI tools for crash diagnosis"
```

---

### Task 3: Update System Prompt

**Files:**

- Modify: `src/ai/commands.ts`

- [ ] **Step 1: Update `buildSystemPrompt` function**

Replace the `buildSystemPrompt()` function (lines 319-331) with:

```typescript
export function buildSystemPrompt(): string {
  return `You are BonNext AI Assistant, an intelligent helper for a Minecraft launcher. You help users manage their game through natural language.

You have access to tools that can search mods, install mods, launch games, check instances, view/modify settings, search versions, diagnose crashes, and apply fixes. Use these tools when the user asks you to perform actions. All tools execute automatically.

Rules:
1. Always explain what you're doing before and after calling a tool
2. If a user's request is ambiguous (e.g. "install some mods" without specifying which), ask for clarification
3. Respond in the same language as the user's message
4. Be concise and helpful
5. When showing search results, highlight the most relevant items
6. Execute tools promptly based on user intent — don't ask for unnecessary confirmation
7. When a user reports a crash or error, immediately use the analyze_crash tool to diagnose the problem. If an auto-fix is available, explain it clearly and offer to apply it.`;
}
```

- [ ] **Step 2: Verify with build**

Run: `pnpm build 2>&1 | tail -3`
Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add src/ai/commands.ts
git commit -m "feat: update AI system prompt with crash analysis capability"
```

---

### Task 4: End-to-End Verification

- [ ] **Step 1: Start the app**

Run: `pnpm tauri dev`

- [ ] **Step 2: Test the crash analysis flow**

1. Create a test crash report in an instance directory (or use an existing one)
2. Open the AI assistant
3. Type: "我的游戏崩溃了，帮我分析一下"
4. Verify: AI calls `analyze_crash` → shows diagnosis with error type, suggestion, severity
5. If auto-fix available, verify: AI offers to apply the fix
6. Confirm the fix → verify: AI calls `apply_fix` → fix is applied

- [ ] **Step 3: Commit any verification fixes if needed**
