import { useState } from "react";
import { AppState, AppAction } from "../state/appReducer";
import "./HomePage.css";

interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onStartGame: (
    versionId: string,
    javaPath: string,
    maxMemory: number,
    username: string,
    uuid: string
  ) => void;
  onRefreshVersions: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onResetState: () => void;
  onDownloadJre: () => Promise<string | null>;
}

function HomePage({
  state,
  dispatch,
  onStartGame,
  onRefreshVersions,
  onLogout,
  onOpenSettings,
  onResetState,
  onDownloadJre,
}: Props) {
  const { versions, selectedVersion, launchState, auth, javaPath, maxMemory, versionsError } =
    state;
  const [downloadingJre, setDownloadingJre] = useState(false);
  const isLaunching =
    launchState.state !== "Idle" &&
    launchState.state !== "Exited" &&
    launchState.state !== "Crashed" &&
    launchState.state !== "Error";

  const getButtonLabel = () => {
    switch (launchState.state) {
      case "Checking":
        return "检查中...";
      case "Downloading": {
        const pct =
          launchState.total_files && launchState.total_files > 0
            ? Math.round(
                (launchState.completed_files! / launchState.total_files) * 100
              )
            : 0;
        return `下载中 ${pct}%`;
      }
      case "Validating":
        return "校验中...";
      case "Launching":
        return "启动中...";
      case "Running":
        return "游戏运行中";
      case "Crashed":
        return "游戏崩溃了";
      case "Error":
        return "启动失败";
      default:
        return "开始游戏";
    }
  };

  const handleLaunch = () => {
    if (isLaunching) return;
    const jp = javaPath || "java";
    const username = auth.loggedIn ? auth.username : "Player";
    onStartGame(
      selectedVersion,
      jp,
      maxMemory,
      username,
      auth.uuid || "00000000-0000-0000-0000-000000000000"
    );
  };

  const handleRetry = () => {
    onResetState();
  };

  const handleDownloadJre = async () => {
    setDownloadingJre(true);
    await onDownloadJre();
    setDownloadingJre(false);
  };

  const releaseVersions = versions.filter((v) => v.version_type === "release");

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-title">BonNext</h1>
        <button
          className="refresh-btn"
          onClick={onRefreshVersions}
          title="刷新版本列表"
        >
          ↻
        </button>
      </header>

      <main className="home-main">
        {auth.loggedIn && (
          <div className="player-info">
            <span className="player-name">{auth.username}</span>
          </div>
        )}

        {releaseVersions.length === 0 && (
          <div className="error-info">
            <p>无法获取版本列表，请检查网络连接</p>
            {versionsError && (
              <pre className="version-error">{versionsError}</pre>
            )}
            <button className="retry-btn" onClick={onRefreshVersions}>
              重试
            </button>
          </div>
        )}

        {releaseVersions.length > 0 && (
          <div className="version-section">
            <label className="version-label">Minecraft 版本</label>
            <select
              className="version-select"
              value={selectedVersion}
              onChange={(e) =>
                dispatch({
                  type: "SET_SELECTED_VERSION",
                  payload: e.target.value,
                })
              }
              disabled={isLaunching}
            >
              {releaseVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {(launchState.state === "Idle" ||
          launchState.state === "Exited" ||
          launchState.state === "Crashed" ||
          launchState.state === "Error") && (
          <button
            className="launch-btn"
            onClick={handleLaunch}
            disabled={!selectedVersion}
          >
            {getButtonLabel()}
          </button>
        )}

        {isLaunching && (
          <button className="launch-btn launch-btn--busy" disabled>
            {getButtonLabel()}
          </button>
        )}

        {launchState.state === "Crashed" && launchState.reason && (
          <div className="crash-info">
            <p>游戏崩溃了 (退出码: {launchState.code})</p>
            <pre className="crash-reason">
              {launchState.reason.slice(0, 500)}
            </pre>
            <button className="retry-btn" onClick={handleRetry}>
              重试
            </button>
          </div>
        )}

        {launchState.state === "Error" && launchState.message && (
          <div className="error-info">
            <p>启动失败: {launchState.message}</p>
            <button className="retry-btn" onClick={handleRetry}>
              重试
            </button>
          </div>
        )}

        {launchState.state === "Downloading" && (
          <div className="download-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width:
                    launchState.total_files && launchState.total_files > 0
                      ? `${(launchState.completed_files! / launchState.total_files) * 100}%`
                      : "0%",
                }}
              />
            </div>
            <p className="progress-text">
              {launchState.completed_files}/{launchState.total_files} 文件
              {launchState.current_file && ` — ${launchState.current_file}`}
            </p>
          </div>
        )}

        {launchState.state === "Running" && (
          <p className="running-text">游戏正在运行中... 享受游戏吧！</p>
        )}

        {launchState.state === "Exited" && (
          <div className="exited-info">
            <p className="exited-text">游戏已退出</p>
            <button className="retry-btn" onClick={handleRetry}>
              返回
            </button>
          </div>
        )}

        {!javaPath && (
          <div className="jre-download-section">
            <p className="jre-hint">未检测到 Java 运行时</p>
            <button
              className="jre-download-btn"
              onClick={handleDownloadJre}
              disabled={downloadingJre}
            >
              {downloadingJre ? "正在下载 Java..." : "自动下载 Java"}
            </button>
          </div>
        )}
      </main>

      <footer className="home-footer">
        <button className="footer-btn" onClick={onOpenSettings}>
          ⚙ 设置
        </button>
        <button className="footer-btn" onClick={onLogout}>
          登出
        </button>
      </footer>
    </div>
  );
}

export default HomePage;
