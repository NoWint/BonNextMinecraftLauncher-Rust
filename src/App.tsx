import { useReducer, useEffect } from "react";
import { appReducer, initialAppState } from "./state/appReducer";
import { useTauri } from "./hooks/useTauri";
import HomePage from "./pages/HomePage";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { fetchVersions, startGame } = useTauri(dispatch);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return (
    <div className="app">
      <HomePage
        state={state}
        dispatch={dispatch}
        onStartGame={startGame}
        onRefreshVersions={fetchVersions}
      />
    </div>
  );
}

export default App;
