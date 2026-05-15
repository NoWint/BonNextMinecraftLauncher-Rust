import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./LoginPage.css";

interface Props {
  onLoginSuccess: (username: string, uuid: string) => void;
}

interface AuthPayload {
  username: string;
  uuid: string;
}

function LoginPage({ onLoginSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offlineName, setOfflineName] = useState("");
  const [showOffline, setShowOffline] = useState(false);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<AuthPayload>("microsoft_login");
      onLoginSuccess(result.username, result.uuid);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineLogin = async () => {
    if (!offlineName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await invoke<AuthPayload>("offline_login", {
        username: offlineName.trim(),
      });
      onLoginSuccess(result.username, result.uuid);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">BonNext</h1>
        <p className="login-subtitle">Minecraft 启动器</p>

        {!showOffline ? (
          <>
            <button
              className="login-btn login-btn--ms"
              onClick={handleMicrosoftLogin}
              disabled={loading}
            >
              {loading ? "登录中..." : "Microsoft 账号登录"}
            </button>
            <button
              className="login-link"
              onClick={() => setShowOffline(true)}
            >
              或跳过登录，使用离线模式
            </button>
          </>
        ) : (
          <div className="offline-form">
            <input
              className="offline-input"
              type="text"
              placeholder="输入玩家名"
              value={offlineName}
              onChange={(e) => setOfflineName(e.target.value)}
              maxLength={16}
            />
            <button
              className="login-btn"
              onClick={handleOfflineLogin}
              disabled={loading || !offlineName.trim()}
            >
              {loading ? "登录中..." : "离线模式进入"}
            </button>
            <button
              className="login-link"
              onClick={() => setShowOffline(false)}
            >
              返回
            </button>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;
