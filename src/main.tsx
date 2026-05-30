import ReactDOM from 'react-dom/client';
import App from './App';
import { formatError } from './utils/errorMapping';
import './styles/global.css';

window.addEventListener('error', (event) => {
  console.error('[BonNext Global Error]', event.error || event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[BonNext Unhandled Rejection]', event.reason);
});

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML =
    '<div style="color:#FF4444;padding:40px;font-family:monospace">Fatal: #root element not found</div>';
  throw new Error('Root element not found');
}

try {
  ReactDOM.createRoot(root).render(<App />);
} catch (e) {
  const msg = formatError(e);
  const stack = e instanceof Error ? e.stack || '' : '';
  const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  root.innerHTML = `<div style="color:#FF4444;padding:40px;font-family:monospace;background:#0D0D0D;height:100vh">
    <h2>BonNext Failed to Start</h2>
    <pre>${escaped(msg)}\n\n${escaped(stack)}</pre>
  </div>`;
  console.error(e);
}
