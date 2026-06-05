import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ModpackPlan } from '../ai/types';
import type { WorkflowProgressEvent, WorkflowErrorEvent, WorkflowCompleteEvent, CrashDetectedEvent } from './types';

export interface GenerateModpackPlanRequest {
  theme: string;
  game_version: string;
  loader_type: string;
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_args?: string;
  max_memory_mb?: number;
}

export const workflowApi = {
  generateModpackPlan: (request: GenerateModpackPlanRequest) =>
    invoke<ModpackPlan>('generate_modpack_plan', { request }),

  executeModpackPlan: (plan: ModpackPlan) =>
    invoke<string>('execute_modpack_plan', { plan }),

  executeCrashFix: (instanceId: string, fixPlan: unknown) =>
    invoke<string>('execute_crash_fix', { instanceId, fixPlan }),

  abortWorkflow: (workflowId: string) =>
    invoke<void>('abort_workflow', { workflowId }),

  onWorkflowProgress: (callback: (e: WorkflowProgressEvent) => void) =>
    listen<WorkflowProgressEvent>('workflow-progress', (event) => callback(event.payload)),

  onWorkflowComplete: (callback: (e: WorkflowCompleteEvent) => void) =>
    listen<WorkflowCompleteEvent>('workflow-complete', (event) => callback(event.payload)),

  onWorkflowError: (callback: (e: WorkflowErrorEvent) => void) =>
    listen<WorkflowErrorEvent>('workflow-error', (event) => callback(event.payload)),

  onCrashDetected: (callback: (e: CrashDetectedEvent) => void) =>
    listen<CrashDetectedEvent>('crash-detected', (event) => callback(event.payload)),
};
