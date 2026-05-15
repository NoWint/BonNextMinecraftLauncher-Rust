use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "state")]
pub enum LaunchState {
    Idle,
    Checking,
    Downloading {
        total_files: u64,
        completed_files: u64,
        total_bytes: u64,
        downloaded_bytes: u64,
        current_file: String,
    },
    Validating,
    Launching,
    Running { pid: u32 },
    Exited { code: i32 },
    Crashed { code: i32, reason: String },
    Error { message: String },
}

impl LaunchState {
    pub fn is_busy(&self) -> bool {
        !matches!(
            self,
            LaunchState::Idle
                | LaunchState::Exited { .. }
                | LaunchState::Crashed { .. }
                | LaunchState::Error { .. }
        )
    }
}
