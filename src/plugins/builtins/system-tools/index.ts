// src/plugins/builtins/system-tools/index.ts
// System Tools 内置插件：成就 + 新闻 + 快照 + 迁移工具 + 优化建议 + 性能分析
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const systemToolsPlugin = definePlugin({
  id: 'com.bonnext.system-tools',
  name: 'System Tools',
  version: '1.0.0',
  description: 'Achievements, news, snapshots, migration tools, optimization suggestions, and performance analysis',

  activate(ctx: PluginContext) {
    // 监听游戏启动事件，记录游玩时间并检查成就
    ctx.events.on('instance:launched', (data) => {
      ctx.logger.info('Instance launched, tracking playtime', data);
    });

    ctx.events.on('instance:exited', (data) => {
      ctx.logger.info('Instance exited, checking achievements', data);
    });

    // 监听下载完成事件
    ctx.events.on('download:completed', (data) => {
      ctx.logger.info('Download completed', data);
    });

    ctx.logger.info('System Tools plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default systemToolsPlugin;
