use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LaunchState {
    Idle,
    Checking,
    Downloading,
    Validating,
    Launching,
    Running,
    Exited,
    Crashed,
    Error,
}

impl LaunchState {
    pub fn is_busy(self) -> bool {
        !matches!(self, LaunchState::Idle | LaunchState::Exited | LaunchState::Crashed | LaunchState::Error)
    }

    pub fn can_transition_to(self, next: LaunchState) -> bool {
        match self {
            LaunchState::Idle => matches!(next, LaunchState::Checking),
            LaunchState::Checking => matches!(next, LaunchState::Downloading | LaunchState::Launching | LaunchState::Error),
            LaunchState::Downloading => matches!(next, LaunchState::Validating | LaunchState::Error),
            LaunchState::Validating => matches!(next, LaunchState::Launching | LaunchState::Error),
            LaunchState::Launching => matches!(next, LaunchState::Running | LaunchState::Crashed | LaunchState::Error),
            LaunchState::Running => matches!(next, LaunchState::Exited | LaunchState::Crashed),
            LaunchState::Exited | LaunchState::Crashed | LaunchState::Error => matches!(next, LaunchState::Idle),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_not_busy() { assert!(!LaunchState::Idle.is_busy()); }
    #[test]
    fn checking_busy() { assert!(LaunchState::Checking.is_busy()); }
    #[test]
    fn running_busy() { assert!(LaunchState::Running.is_busy()); }
    #[test]
    fn exited_not_busy() { assert!(!LaunchState::Exited.is_busy()); }
    #[test]
    fn error_not_busy() { assert!(!LaunchState::Error.is_busy()); }

    #[test]
    fn valid_transitions() {
        assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Launching));
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
        assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
        assert!(LaunchState::Error.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn invalid_transitions() {
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Launching));
    }
}
