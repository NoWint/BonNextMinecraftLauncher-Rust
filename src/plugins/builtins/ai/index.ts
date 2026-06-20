// src/plugins/builtins/ai/index.ts
// AI Assistant 内置插件：AI 聊天 + 工作流 + 崩溃分析
//
// AI 助手功能包括智能聊天、modpack 安装工作流自动化、崩溃日志分析。
// UI 组件（ChatPanel、CrashAnalysisPanel、WorkflowProgress）由核心 AppShell 渲染。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const aiPlugin = definePlugin({
  id: 'com.bonnext.ai',
  name: 'AI Assistant',
  version: '1.0.0',
  description: 'AI chat, workflow automation, and crash analysis',

  activate(ctx: PluginContext) {
    // 监听崩溃事件，触发自动分析
    ctx.events.on('instance:crashed', (data) => {
      ctx.logger.info('Instance crashed, AI will analyze', data);
    });

    // 监听工作流完成事件
    ctx.events.on('workflow:completed', (data) => {
      ctx.logger.info('Workflow completed', data);
    });

    ctx.logger.info('AI Assistant plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default aiPlugin;
