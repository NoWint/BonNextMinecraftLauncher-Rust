// src/plugins/builtins/scene-menu/index.tsx
// 3D 场景化主菜单插件：SHARP 3DGS 赛博都市天台 + 镜头推移 + 全息面板。
// activate() 用 ReactDOM.createRoot 挂独立 React root 覆盖首页；
// deactivate() 卸载 root + 移除容器，完全恢复。
import { createRoot, type Root } from 'react-dom/client';
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import { SceneOverlay } from './SceneOverlay';
import manifest from './manifest.json';

const ROOT_ATTR = 'data-scene-menu-root';
let root: Root | null = null;
let container: HTMLDivElement | null = null;

export const sceneMenuPlugin = definePlugin({
  id: 'com.bonnext.scene-menu',
  name: '3D Scene Menu',
  version: '1.0.0',
  description: 'Immersive 3D Neo-Tokyo rooftop main menu powered by SHARP 3DGS',

  activate(ctx: PluginContext) {
    // 幂等：若已存在先卸载
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    container = document.createElement('div');
    container.setAttribute(ROOT_ATTR, '');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<SceneOverlay ctx={ctx} plyUrl="/scene.ply" />);
    ctx.logger.info('3D Scene Menu plugin activated');
  },

  deactivate() {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  },
});

export { manifest };
export default sceneMenuPlugin;
