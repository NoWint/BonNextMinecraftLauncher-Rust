// src/plugins/builtins/ai/index.ts
// AI Assistant 内置插件：AI 聊天 + 工作流 + 崩溃分析
//
// AI 助手功能包括智能聊天、modpack 安装工作流自动化、崩溃日志分析。
// UI 组件（ChatPanel、CrashAnalysisPanel、WorkflowProgress）由核心 AppShell 渲染。
// 本插件负责：
// - 监听崩溃事件，自动触发崩溃诊断并广播结果
// - 监听工作流完成事件，刷新 UI 状态
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

interface CrashPayload {
  instanceId?: string;
  crashLogPath?: string;
  crashLogContent?: string;
}

interface WorkflowPayload {
  workflowId?: string;
  status?: string;
  result?: unknown;
}

export const aiPlugin = definePlugin({
  id: 'com.bonnext.ai',
  name: 'AI Assistant',
  version: '1.0.0',
  description: 'AI chat, workflow automation, and crash analysis',

  activate(ctx: PluginContext) {
    // 监听崩溃事件，触发自动分析
    ctx.events.on('instance:crashed', (data) => {
      const payload = (data ?? {}) as CrashPayload;
      ctx.logger.info('Instance crashed, AI will analyze', payload);
      // 优先使用崩溃日志内容；否则使用路径让后端读取
      const invokeArgs = payload.crashLogContent
        ? { content: payload.crashLogContent, instanceId: payload.instanceId }
        : { crashLogPath: payload.crashLogPath, instanceId: payload.instanceId };
      const command = payload.crashLogContent ? 'diagnose_crash_from_content' : 'diagnose_crash';
      ctx
        .invoke<{ summary?: string; cause?: string; fixes?: unknown[] }>(command, invokeArgs)
        .then((diagnosis) => {
          ctx.events.emit('ai:crash-analyzed', {
            instanceId: payload.instanceId,
            diagnosis,
          });
          ctx.logger.info('Crash analysis completed:', diagnosis?.summary);
        })
        .catch((e) => {
          ctx.logger.warn('Crash analysis failed', e);
          ctx.events.emit('ai:crash-analysis-failed', {
            instanceId: payload.instanceId,
            error: e instanceof Error ? e.message : String(e),
          });
        });
    });

    // 监听工作流完成事件，刷新 UI 状态
    ctx.events.on('workflow:completed', (data) => {
      const payload = (data ?? {}) as WorkflowPayload;
      ctx.logger.info('Workflow completed', payload);
      // 广播工作流完成通知，便于 UI 显示 toast
      ctx.events.emit('ai:workflow-notification', {
        workflowId: payload.workflowId,
        status: payload.status ?? 'completed',
        result: payload.result,
      });
    });

    // 监听工作流失败事件
    ctx.events.on('workflow:failed', (data) => {
      const payload = (data ?? {}) as WorkflowPayload;
      ctx.logger.warn('Workflow failed', payload);
      ctx.events.emit('ai:workflow-notification', {
        workflowId: payload.workflowId,
        status: 'failed',
        result: payload.result,
      });
    });

    ctx.logger.info('AI Assistant plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default aiPlugin;
