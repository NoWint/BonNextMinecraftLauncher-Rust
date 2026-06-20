// src/plugins/builtins/shell-editor/index.ts
// Shell Editor 插件：可视化 Shell 编辑器
//
// 该插件注册 Shell Editor 作为可用 Shell 和元工具。
// Shell 切换通过设置页的 ShellManagementSection 完成。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const shellEditorPlugin = definePlugin({
  id: 'com.bonnext.shell.editor',
  name: 'Shell Editor',
  version: '1.0.0',
  description: 'Visual shell editor for creating and customizing shells',

  activate(ctx: PluginContext) {
    ctx.logger.info('Shell Editor plugin activated (available as alternative shell)');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default shellEditorPlugin;
