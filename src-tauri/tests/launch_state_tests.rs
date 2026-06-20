use bonnext_lib::LaunchState;

#[test]
fn test_state_transitions_integration() {
    assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
    assert!(!LaunchState::Idle.can_transition_to(LaunchState::Running));
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Error));
    assert!(LaunchState::Error.can_transition_to(LaunchState::Idle));
    assert!(!LaunchState::Error.can_transition_to(LaunchState::Checking));
}

#[test]
fn test_full_launch_cycle() {
    assert!(LaunchState::Idle.can_transition_to(LaunchState::Checking));
    assert!(LaunchState::Checking.can_transition_to(LaunchState::Downloading));
    assert!(LaunchState::Downloading.can_transition_to(LaunchState::Validating));
    assert!(LaunchState::Validating.can_transition_to(LaunchState::Launching));
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Running));
    assert!(LaunchState::Running.can_transition_to(LaunchState::Exited));
    assert!(LaunchState::Exited.can_transition_to(LaunchState::Idle));
}

#[test]
fn test_crash_recovery() {
    assert!(LaunchState::Launching.can_transition_to(LaunchState::Crashed));
    assert!(LaunchState::Running.can_transition_to(LaunchState::Crashed));
    assert!(LaunchState::Crashed.can_transition_to(LaunchState::Idle));
}

#[test]
fn test_is_busy_integration() {
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
fn test_terminal_states_only_return_to_idle() {
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
