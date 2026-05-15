import { useReducer, useEffect, useState } from "react";
import { appReducer, initialAppState } from "./state/appReducer";
import { useTauri } from "./hooks/useTauri";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { fetchVersions, startGame, checkSession, logout, resetLaunchState, downloadJre } = useTauri(dispatch);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    checkSession();
    fetchVersions();
  }, [checkSession, fetchVersions]);

  const handleLoginSuccess = (username: string, uuid: string) => {
    dispatch({ type: "SET_AUTH", payload: { username, uuid } });
  };

  const handleConfigSaved = (config: any) => {
    dispatch({ type: "SET_JAVA_PATH", payload: config.java_path });
    dispatch({ type: "SET_MAX_MEMORY", payload: config.max_memory_mb });
    setShowSettings(false);
  };

  if (!state.auth.loggedIn) {
    return (
      <div className="app">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="app">
        <SettingsPage
          onBack={() => setShowSettings(false)}
          onSave={handleConfigSaved}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <HomePage
        state={state}
        dispatch={dispatch}
        onStartGame={startGame}
        onRefreshVersions={fetchVersions}
        onLogout={logout}
        onOpenSettings={() => setShowSettings(true)}
        onResetState={resetLaunchState}
        onDownloadJre={downloadJre}
      />
    </div>
  );
}

export default App;
