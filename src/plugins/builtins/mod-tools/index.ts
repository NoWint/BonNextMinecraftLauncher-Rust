// src/plugins/builtins/mod-tools/index.ts
// Mod Tools 内置插件：Mod 扫描 + 监视 + 兼容性检查
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const modToolsPlugin = definePlugin({
  id: 'com.bonnext.mod-tools',
  name: 'Mod Tools',
  version: '1.0.0',
  description: 'Mod scanning, watching, and compatibility checking',

  activate(ctx: PluginContext) {
    // 监听 mod 安装事件
    ctx.events.on('mod:installed', (data) => {
      ctx.logger.info('Mod installed, scanning for conflicts', data);
    });

    // 上下文菜单：mod 相关操作
    ctx.addContextMenuItem({
      id: 'mod-tools-scan',
      label: 'Scan Mod',
      icon: '🔍',
      where: ['mod'],
      action: (context) => {
        ctx.logger.info('Scanning mod', context.data);
      },
    });

    ctx.addContextMenuItem({
      id: 'mod-tools-check-compat',
      label: 'Check Compatibility',
      icon: '✓',
      where: ['instance'],
      action: (context) => {
        ctx.logger.info('Checking mod compatibility', context.data);
      },
    });

    ctx.logger.info('Mod Tools plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default modToolsPlugin;
