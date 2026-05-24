use bonnext_lib::*;

#[test]
fn version_entry_deserialization() {
    let json = r#"{
        "id": "1.21.4",
        "type": "release",
        "url": "https://piston-meta.mojang.com/v1/objects/abc/1.21.4.json",
        "time": "2024-12-03T10:00:00+00:00",
        "releaseTime": "2024-12-03T10:00:00+00:00"
    }"#;
    let entry: VersionEntry = serde_json::from_str(json).unwrap();
    assert_eq!(entry.id, "1.21.4");
    assert_eq!(entry.version_type, "release");
    assert!(entry.url.contains("piston-meta"));
}

#[test]
fn version_manifest_deserialization() {
    let json = r#"{
        "latest": {
            "release": "1.21.4",
            "snapshot": "25w02a"
        },
        "versions": [
            {
                "id": "1.21.4",
                "type": "release",
                "url": "https://example.com/1.21.4.json",
                "time": "2024-12-03T10:00:00+00:00",
                "releaseTime": "2024-12-03T10:00:00+00:00"
            },
            {
                "id": "25w02a",
                "type": "snapshot",
                "url": "https://example.com/25w02a.json",
                "time": "2024-12-10T10:00:00+00:00",
                "releaseTime": "2024-12-10T10:00:00+00:00"
            }
        ]
    }"#;
    let manifest: VersionManifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.latest.release, "1.21.4");
    assert_eq!(manifest.latest.snapshot, "25w02a");
    assert_eq!(manifest.versions.len(), 2);
}

#[test]
fn version_entry_serialization_roundtrip() {
    let entry = VersionEntry {
        id: "1.20.4".to_string(),
        version_type: "release".to_string(),
        url: "https://example.com/1.20.4.json".to_string(),
        time: "2024-01-01T00:00:00+00:00".to_string(),
        release_time: "2024-01-01T00:00:00+00:00".to_string(),
    };
    let json = serde_json::to_string(&entry).unwrap();
    let deserialized: VersionEntry = serde_json::from_str(&json).unwrap();
    assert_eq!(entry.id, deserialized.id);
    assert_eq!(entry.version_type, deserialized.version_type);
    assert_eq!(entry.url, deserialized.url);
}

#[test]
fn latest_versions_deserialization() {
    let json = r#"{"release": "1.21", "snapshot": "23w44a"}"#;
    let latest: LatestVersions = serde_json::from_str(json).unwrap();
    assert_eq!(latest.release, "1.21");
    assert_eq!(latest.snapshot, "23w44a");
}

#[test]
fn version_type_snapshot() {
    let json = r#"{
        "id": "23w44a",
        "type": "snapshot",
        "url": "https://example.com/snap.json",
        "time": "2024-11-01T00:00:00+00:00",
        "releaseTime": "2024-11-01T00:00:00+00:00"
    }"#;
    let entry: VersionEntry = serde_json::from_str(json).unwrap();
    assert_eq!(entry.version_type, "snapshot");
}

#[test]
fn game_instance_new() {
    let inst = GameInstance::new("Test World", "1.21.4", "https://example.com/1.21.4.json");
    assert!(inst.id.contains("1.21.4"));
    assert_eq!(inst.name, "Test World");
    assert_eq!(inst.version_id, "1.21.4");
    assert!(inst.loader_type.is_none());
    assert!(inst.loader_version.is_none());
    assert_eq!(inst.max_memory, 2048);
    assert_eq!(inst.min_memory, 512);
    assert_eq!(inst.playtime_seconds, 0);
}

#[test]
fn game_instance_serialization_roundtrip() {
    let inst = GameInstance::new("My Instance", "1.20.4", "https://example.com/1.20.4.json");
    let json = serde_json::to_string(&inst).unwrap();
    let deserialized: GameInstance = serde_json::from_str(&json).unwrap();
    assert_eq!(inst.id, deserialized.id);
    assert_eq!(inst.name, deserialized.name);
    assert_eq!(inst.version_id, deserialized.version_id);
    assert_eq!(inst.version_url, deserialized.version_url);
}
