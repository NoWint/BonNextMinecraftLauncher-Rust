import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="color:#FF4444;padding:40px;font-family:monospace">Fatal: #root element not found</div>';
  throw new Error("Root element not found");
}

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (e) {
  root.innerHTML = `<div style="color:#FF4444;padding:40px;font-family:monospace;background:#0D0D0D;height:100vh">
    <h2>BonNext Failed to Start</h2>
    <pre>${e instanceof Error ? e.message + '\n\n' + e.stack : String(e)}</pre>
  </div>`;
  console.error(e);
}
