export interface LaunchState {
  state: string;
  total_files?: number;
  completed_files?: number;
  total_bytes?: number;
  downloaded_bytes?: number;
  current_file?: string;
  pid?: number;
  code?: number;
  reason?: string;
  message?: string;
}

export interface VersionEntry {
  id: string;
  version_type: string;
  url: string;
  time: string;
  release_time: string;
}

export interface AppState {
  auth: {
    loggedIn: boolean;
    username: string;
    uuid: string;
  };
  versions: VersionEntry[];
  versionsError: string;
  selectedVersion: string;
  launchState: LaunchState;
  javaPath: string;
  maxMemory: number;
}

export type AppAction =
  | { type: "SET_AUTH"; payload: { username: string; uuid: string } }
  | { type: "LOGOUT" }
  | { type: "SET_VERSIONS"; payload: VersionEntry[] }
  | { type: "SET_VERSIONS_ERROR"; payload: string }
  | { type: "SET_SELECTED_VERSION"; payload: string }
  | { type: "SET_LAUNCH_STATE"; payload: LaunchState }
  | { type: "SET_JAVA_PATH"; payload: string }
  | { type: "SET_MAX_MEMORY"; payload: number };

export const initialAppState: AppState = {
  auth: {
    loggedIn: false,
    username: "",
    uuid: "",
  },
  versions: [],
  versionsError: "",
  selectedVersion: "",
  launchState: { state: "Idle" },
  javaPath: "",
  maxMemory: 4096,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_AUTH":
      return {
        ...state,
        auth: {
          loggedIn: true,
          username: action.payload.username,
          uuid: action.payload.uuid,
        },
      };
    case "LOGOUT":
      return {
        ...state,
        auth: { loggedIn: false, username: "", uuid: "" },
      };
    case "SET_VERSIONS":
      return {
        ...state,
        versions: action.payload,
        versionsError: "",
        selectedVersion:
          state.selectedVersion || action.payload[0]?.id || "",
      };
    case "SET_VERSIONS_ERROR":
      return {
        ...state,
        versions: [],
        versionsError: action.payload,
      };
    case "SET_SELECTED_VERSION":
      return { ...state, selectedVersion: action.payload };
    case "SET_LAUNCH_STATE":
      return { ...state, launchState: action.payload };
    case "SET_JAVA_PATH":
      return { ...state, javaPath: action.payload };
    case "SET_MAX_MEMORY":
      return { ...state, maxMemory: action.payload };
    default:
      return state;
  }
}
