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
}

function HomePage({ state, dispatch, onStartGame, onRefreshVersions }: Props) {
  const { versions, selectedVersion, launchState, auth, javaPath, maxMemory } =
    state;
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
            {versions
              .filter((v) => v.version_type === "release")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
          </select>
        </div>

        <button
          className={`launch-btn ${isLaunching ? "launch-btn--busy" : ""}`}
          onClick={handleLaunch}
          disabled={isLaunching || !selectedVersion}
        >
          {getButtonLabel()}
        </button>

        {launchState.state === "Crashed" && launchState.reason && (
          <div className="crash-info">
            <p>游戏崩溃了 (退出码: {launchState.code})</p>
            <pre className="crash-reason">
              {launchState.reason.slice(0, 500)}
            </pre>
          </div>
        )}

        {launchState.state === "Error" && launchState.message && (
          <div className="error-info">
            <p>错误: {launchState.message}</p>
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
          <p className="exited-text">游戏已退出</p>
        )}
      </main>
    </div>
  );
}

export default HomePage;
