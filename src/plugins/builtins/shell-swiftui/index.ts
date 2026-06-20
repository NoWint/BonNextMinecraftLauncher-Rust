// src/plugins/builtins/shell-swiftui/index.ts
// SwiftUI Shell 插件：SwiftUI 风格 Shell
//
// 该插件注册 SwiftUI Shell 作为可用 Shell。
// Shell 切换通过设置页的 ShellManagementSection 完成。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const swiftUIShellPlugin = definePlugin({
  id: 'com.bonnext.shell.swiftui',
  name: 'SwiftUI Shell',
  version: '1.0.0',
  description: 'SwiftUI-style shell with HIG-aligned design',

  activate(ctx: PluginContext) {
    ctx.logger.info('SwiftUI Shell plugin activated (available as alternative shell)');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default swiftUIShellPlugin;
