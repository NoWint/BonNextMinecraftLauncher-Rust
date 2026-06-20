// src/plugins/builtins/scene-menu/index.ts
// 3D 场景化主菜单插件：SHARP 3DGS 赛博都市天台 + 镜头推移 + 全息面板。
// activate() 挂独立 React root 覆盖首页；deactivate() 卸载恢复。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const sceneMenuPlugin = definePlugin({
  id: 'com.bonnext.scene-menu',
  name: '3D Scene Menu',
  version: '1.0.0',
  description: 'Immersive 3D Neo-Tokyo rooftop main menu powered by SHARP 3DGS',

  activate(_ctx: PluginContext) {
    // Task 8 实现：createRoot 挂载 SceneOverlay
  },

  deactivate() {
    // Task 8 实现：unmount + dispose
  },
});

export { manifest };
export default sceneMenuPlugin;
