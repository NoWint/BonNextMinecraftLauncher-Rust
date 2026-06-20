# 3D Scene Menu 资产

插件在无 `scene.ply` 时自动降级到 CSS 渐变背景（见 SceneRenderer）。
以下资产为可选增强，生成后放入本目录即可生效。

## scene.ply（3DGS 模型）

用 [apple/ml-sharp](https://github.com/apple/ml-sharp) 从单张源图离线生成：

1. 克隆 ml-sharp，按其 README 配置 Python + PyTorch + GPU（CUDA/MPS）。
2. 准备高分辨率源图（赛博都市天台夜景，1920×1080+，真实深度 cues）。
3. 运行：
   ```bash
   sharp predict -i source.png -o scene.ply
   ```
4. 将 `scene.ply` 放入本目录。
5. 在 `index.tsx` 的 activate 中，将 `plyUrl` 传给 SceneOverlay：
   ```ts
   import scenePlyUrl from './assets/scene.ply?url';
   // ...
   root.render(<SceneOverlay ctx={ctx} plyUrl={scenePlyUrl} />);
   ```

## scene-fallback.png（降级静态图）

源图副本，作为 WebGL 不可用时的降级背景。生成后：

- 在 SceneRenderer 中替换 `.sceneFallback` 的 CSS 渐变为该图（`background-image: url(...)`）。

## 源图方向

赛博都市天台夜景：站在天台边缘俯瞰密集霓虹楼群，黄/青/品红霓虹招牌，
雨后湿润反射，强深度 cues。契合 ZZZ Neo-Tokyo 美学。
