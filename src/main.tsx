import ReactDOM from 'react-dom/client';
import App from './App';
import { formatError } from './shared/utils/errorMapping';
// 直接 import 各 CSS 文件（而非 @import 串行加载），Vite 会合并为单个 CSS 文件。
import './shells/zzz/styles/tokens.css';
import './shells/zzz/styles/themes.css';
import './shells/zzz/styles/ux-delight.css';
import './shells/zzz/styles/global.css';

window.addEventListener('error', (event) => {
  console.error('[BonNext Global Error]', event.error || event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[BonNext Unhandled Rejection]', event.reason);
});

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML =
    '<div style="color:#FF4444;padding:40px;font-family:\'SF Pro Display\',\'SF Pro\',-apple-system,BlinkMacSystemFont,sans-serif">Fatal: #root element not found</div>';
  throw new Error('Root element not found');
}

try {
  ReactDOM.createRoot(root).render(<App />);
} catch (e) {
  const msg = formatError(e);
  const stack = e instanceof Error ? e.stack || '' : '';
  const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  root.innerHTML = `<div style="color:#FF4444;padding:40px;font-family:'SF Pro Display','SF Pro',-apple-system,BlinkMacSystemFont,sans-serif;background:#0D0D0D;height:100vh">
    <h2>BonNext Failed to Start</h2>
    <pre>${escaped(msg)}\n\n${escaped(stack)}</pre>
  </div>`;
  console.error(e);
}
