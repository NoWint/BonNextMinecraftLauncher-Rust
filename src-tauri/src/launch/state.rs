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
            LaunchState::Downloading => matches!(next, LaunchState::Checking | LaunchState::Validating | LaunchState::Error),
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
    fn downloading_busy() { assert!(LaunchState::Downloading.is_busy()); }
    #[test]
    fn validating_busy() { assert!(LaunchState::Validating.is_busy()); }
    #[test]
    fn launching_busy() { assert!(LaunchState::Launching.is_busy()); }
    #[test]
    fn running_busy() { assert!(LaunchState::Running.is_busy()); }
    #[test]
    fn exited_not_busy() { assert!(!LaunchState::Exited.is_busy()); }
    #[test]
    fn crashed_not_busy() { assert!(!LaunchState::Crashed.is_busy()); }
    #[test]
    fn error_not_busy() { assert!(!LaunchState::Error.is_busy()); }

    #[test]
    fn valid_transition_idle_to_checking() {
        assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
    }

    #[test]
    fn valid_transition_checking_to_downloading() {
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
    }

    #[test]
    fn valid_transition_checking_to_launching() {
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Launching));
    }

    #[test]
    fn valid_transition_checking_to_error() {
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn valid_transition_downloading_to_checking() {
        assert!(LaunchState::Downloading.can_transition_to(LaunchState::Checking));
    }

    #[test]
    fn valid_transition_downloading_to_validating() {
        assert!(LaunchState::Downloading.can_transition_to(LaunchState::Validating));
    }

    #[test]
    fn valid_transition_downloading_to_error() {
        assert!(LaunchState::Downloading.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn valid_transition_validating_to_launching() {
        assert!(LaunchState::Validating.can_transition_to(LaunchState::Launching));
    }

    #[test]
    fn valid_transition_validating_to_error() {
        assert!(LaunchState::Validating.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn valid_transition_launching_to_running() {
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
    }

    #[test]
    fn valid_transition_launching_to_crashed() {
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Crashed));
    }

    #[test]
    fn valid_transition_launching_to_error() {
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn valid_transition_running_to_exited() {
        assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
    }

    #[test]
    fn valid_transition_running_to_crashed() {
        assert!(LaunchState::Running.can_transition_to(LaunchState::Crashed));
    }

    #[test]
    fn valid_transition_exited_to_idle() {
        assert!(LaunchState::Exited.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn valid_transition_crashed_to_idle() {
        assert!(LaunchState::Crashed.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn valid_transition_error_to_idle() {
        assert!(LaunchState::Error.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn invalid_transitions_from_idle() {
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Validating));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Crashed));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Error));
        assert!(!LaunchState::Idle.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn invalid_transitions_from_checking() {
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Idle));
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Validating));
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Checking.can_transition_to(LaunchState::Crashed));
    }

    #[test]
    fn invalid_transitions_from_downloading() {
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Idle));
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Downloading.can_transition_to(LaunchState::Crashed));
    }

    #[test]
    fn invalid_transitions_from_validating() {
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Idle));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Validating));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Validating.can_transition_to(LaunchState::Crashed));
    }

    #[test]
    fn invalid_transitions_from_launching() {
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Idle));
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Validating));
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Launching.can_transition_to(LaunchState::Exited));
    }

    #[test]
    fn invalid_transitions_from_running() {
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Idle));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Validating));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Running.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn terminal_states_only_go_to_idle() {
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Error));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Exited.can_transition_to(LaunchState::Crashed));

        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Error));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Crashed.can_transition_to(LaunchState::Crashed));

        assert!(!LaunchState::Error.can_transition_to(LaunchState::Checking));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Downloading));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Launching));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Running));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Exited));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Crashed));
        assert!(!LaunchState::Error.can_transition_to(LaunchState::Error));
    }

    #[test]
    fn full_happy_path() {
        assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
        assert!(LaunchState::Downloading.can_transition_to(LaunchState::Validating));
        assert!(LaunchState::Validating.can_transition_to(LaunchState::Launching));
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
        assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
        assert!(LaunchState::Exited.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn error_recovery_path() {
        assert!(LaunchState::Checking.can_transition_to(LaunchState::Error));
        assert!(LaunchState::Downloading.can_transition_to(LaunchState::Error));
        assert!(LaunchState::Validating.can_transition_to(LaunchState::Error));
        assert!(LaunchState::Launching.can_transition_to(LaunchState::Error));
        assert!(LaunchState::Error.can_transition_to(LaunchState::Idle));
    }

    #[test]
    fn serde_roundtrip() {
        let states = [
            LaunchState::Idle,
            LaunchState::Checking,
            LaunchState::Downloading,
            LaunchState::Validating,
            LaunchState::Launching,
            LaunchState::Running,
            LaunchState::Exited,
            LaunchState::Crashed,
            LaunchState::Error,
        ];
        for s in &states {
            let json = serde_json::to_string(s).unwrap();
            let back: LaunchState = serde_json::from_str(&json).unwrap();
            assert_eq!(*s, back);
        }
    }
}
