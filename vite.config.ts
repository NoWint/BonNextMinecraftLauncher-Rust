import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const host = process.env.TAURI_DEV_HOST;

// 读取 package.json 版本，构建时注入 VITE_APP_VERSION，
// 避免 PluginManager.initAppVersion() 运行时调用 Tauri getVersion() IPC。
const pkgVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
).version;

export default defineConfig(async ({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@bonnext/plugin-sdk': path.resolve(__dirname, 'src/plugin-sdk/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkgVersion),
  },
  // 生产构建：移除 console.log/debug/info 和 debugger，减小 bundle 体积。
  // 开发模式保留所有日志。
  esbuild: mode === 'production' ? {
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info'],
  } : undefined,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // Cross-Origin Isolation：启用 SharedArrayBuffer，3DGS 排序 worker 需要共享内存。
    // Tauri webview 在 dev 模式从 http://localhost:1420 加载，会读取这些头。
    // 使用 credentialless 而非 require-corp：仍启用 crossOriginIsolated，
    // 但不阻止缺少 CORP 头的跨域资源（如 Mojang CDN 图片）。
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // 预打包重依赖：Vite dev 模式按需加载模块，每个 import 是一次 HTTP 请求。
  // 预打包将常用依赖合并为单个 ESM 模块，大幅减少启动期 HTTP 请求数。
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tauri-apps/api',
      'framer-motion',
    ],
  },
  build: {
    // 生产构建使用 esnext target，输出更小的代码（跳过 ES5/ES2015 兼容降级）。
    target: mode === 'production' ? 'esnext' : 'es2020',
    // 生产构建启用 CSS 压缩
    cssMinify: mode === 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-tauri': ['@tauri-apps/api'],
        },
      },
    },
  },
}));
