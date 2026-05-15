import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppAction, VersionEntry, LaunchState } from "../state/appReducer";

interface AuthPayload {
  username: string;
  uuid: string;
}

interface UserConfig {
  java_path: string;
  max_memory_mb: number;
  extra_jvm_args: string[];
  window_width: number;
  window_height: number;
  launch_behavior: string;
}

export function useTauri(dispatch: React.Dispatch<AppAction>) {
  const fetchVersions = useCallback(async () => {
    try {
      const versions = await invoke<VersionEntry[]>("get_versions");
      dispatch({ type: "SET_VERSIONS", payload: versions });
    } catch (e) {
      console.error("Failed to fetch versions:", e);
      dispatch({ type: "SET_VERSIONS", payload: [] });
    }
  }, [dispatch]);

  const loadConfig = useCallback(async () => {
    try {
      const config = await invoke<UserConfig>("get_config");
      if (config.java_path) {
        dispatch({ type: "SET_JAVA_PATH", payload: config.java_path });
      }
      dispatch({ type: "SET_MAX_MEMORY", payload: config.max_memory_mb });
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }, [dispatch]);

  const startGame = useCallback(
    async (
      versionId: string,
      javaPath: string,
      maxMemory: number,
      username: string,
      uuid: string
    ) => {
      try {
        await invoke("start_game", {
          versionId,
          javaPath,
          maxMemoryMb: maxMemory,
          username,
          uuid,
        });
      } catch (e) {
        console.error("Launch failed:", e);
      }
    },
    []
  );

  const checkSession = useCallback(async () => {
    try {
      const session = await invoke<AuthPayload | null>("check_saved_session");
      if (session) {
        dispatch({
          type: "SET_AUTH",
          payload: { username: session.username, uuid: session.uuid },
        });
      }
    } catch (e) {
      console.error("Failed to check session:", e);
    }
  }, [dispatch]);

  const resetLaunchState = useCallback(async () => {
    try {
      await invoke("reset_launch_state");
      dispatch({ type: "SET_LAUNCH_STATE", payload: { state: "Idle" } });
    } catch (e) {
      console.error("Failed to reset state:", e);
    }
  }, [dispatch]);

  useEffect(() => {
    const unlistenLaunch = listen<LaunchState>("launch-state", (event) => {
      dispatch({ type: "SET_LAUNCH_STATE", payload: event.payload });
    });

    const unlistenAuth = listen<AuthPayload>("auth-state", (event) => {
      dispatch({
        type: "SET_AUTH",
        payload: { username: event.payload.username, uuid: event.payload.uuid },
      });
    });

    return () => {
      unlistenLaunch.then((fn) => fn());
      unlistenAuth.then((fn) => fn());
    };
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
      dispatch({ type: "LOGOUT" });
    } catch (e) {
      console.error("Failed to logout:", e);
    }
  }, [dispatch]);

  const downloadJre = useCallback(async (): Promise<string | null> => {
    try {
      const path = await invoke<string>("download_jre");
      dispatch({ type: "SET_JAVA_PATH", payload: path });
      return path;
    } catch (e) {
      console.error("Failed to download JRE:", e);
      return null;
    }
  }, [dispatch]);

  return { fetchVersions, startGame, checkSession, logout, resetLaunchState, downloadJre, loadConfig };
}
