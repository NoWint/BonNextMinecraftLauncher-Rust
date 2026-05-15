import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppAction, VersionEntry, LaunchState } from "../state/appReducer";

export function useTauri(dispatch: React.Dispatch<AppAction>) {
  const fetchVersions = useCallback(async () => {
    try {
      const versions = await invoke<VersionEntry[]>("get_versions");
      dispatch({ type: "SET_VERSIONS", payload: versions });
    } catch (e) {
      console.error("Failed to fetch versions:", e);
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

  useEffect(() => {
    const unlisten = listen<LaunchState>("launch-state", (event) => {
      dispatch({ type: "SET_LAUNCH_STATE", payload: event.payload });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [dispatch]);

  return { fetchVersions, startGame };
}
