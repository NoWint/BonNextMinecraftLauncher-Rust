use bonnext_lib::LaunchState;

#[test]
fn launch_state_idle_is_default_start() {
    assert_eq!(LaunchState::Idle, LaunchState::Idle);
}

#[test]
fn idle_can_transition_to_checking() {
    assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
}

#[test]
fn idle_cannot_transition_to_downloading() {
    assert!(!LaunchState::Idle.can_transition_to(LaunchState::Downloading));
}

#[test]
fn idle_cannot_transition_to_running() {
    assert!(!LaunchState::Idle.can_transition_to(LaunchState::Running));
}

#[test]
fn idle_cannot_transition_to_exited() {
    assert!(!LaunchState::Idle.can_transition_to(LaunchState::Exited));
}

#[test]
fn checking_can_transition_to_downloading() {
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
}

#[test]
fn checking_can_transition_to_launching() {
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Launching));
}

#[test]
fn checking_can_transition_to_error() {
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Error));
}

#[test]
fn downloading_can_transition_to_validating() {
    assert!(LaunchState::Downloading.can_transition_to(LaunchState::Validating));
}

#[test]
fn downloading_can_transition_to_error() {
    assert!(LaunchState::Downloading.can_transition_to(LaunchState::Error));
}

#[test]
fn validating_can_transition_to_launching() {
    assert!(LaunchState::Validating.can_transition_to(LaunchState::Launching));
}

#[test]
fn validating_can_transition_to_error() {
    assert!(LaunchState::Validating.can_transition_to(LaunchState::Error));
}

#[test]
fn launching_can_transition_to_running() {
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
}

#[test]
fn launching_can_transition_to_crashed() {
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Crashed));
}

#[test]
fn launching_can_transition_to_error() {
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Error));
}

#[test]
fn running_can_transition_to_exited() {
    assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
}

#[test]
fn running_can_transition_to_crashed() {
    assert!(LaunchState::Running.can_transition_to(LaunchState::Crashed));
}

#[test]
fn running_cannot_transition_to_checking() {
    assert!(!LaunchState::Running.can_transition_to(LaunchState::Checking));
}

#[test]
fn exited_can_transition_to_idle() {
    assert!(LaunchState::Exited.can_transition_to(LaunchState::Idle));
}

#[test]
fn crashed_can_transition_to_idle() {
    assert!(LaunchState::Crashed.can_transition_to(LaunchState::Idle));
}

#[test]
fn error_can_transition_to_idle() {
    assert!(LaunchState::Error.can_transition_to(LaunchState::Idle));
}

#[test]
fn is_busy_when_not_idle() {
    assert!(!LaunchState::Idle.is_busy());
    assert!(LaunchState::Checking.is_busy());
    assert!(LaunchState::Downloading.is_busy());
    assert!(LaunchState::Validating.is_busy());
    assert!(LaunchState::Launching.is_busy());
    assert!(LaunchState::Running.is_busy());
    assert!(!LaunchState::Exited.is_busy());
    assert!(!LaunchState::Crashed.is_busy());
    assert!(!LaunchState::Error.is_busy());
}

#[test]
fn terminal_states_cannot_transition_to_non_idle() {
    for state in [LaunchState::Exited, LaunchState::Crashed, LaunchState::Error] {
        for next in [
            LaunchState::Checking,
            LaunchState::Downloading,
            LaunchState::Validating,
            LaunchState::Launching,
            LaunchState::Running,
        ] {
            assert!(!state.can_transition_to(next));
        }
        assert!(state.can_transition_to(LaunchState::Idle));
    }
}

#[test]
fn full_happy_path_transition_chain() {
    assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
    assert!(LaunchState::Downloading.can_transition_to(LaunchState::Validating));
    assert!(LaunchState::Validating.can_transition_to(LaunchState::Launching));
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
    assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
    assert!(LaunchState::Exited.can_transition_to(LaunchState::Idle));
}

#[test]
fn shortcut_checking_to_launching() {
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Launching));
}
