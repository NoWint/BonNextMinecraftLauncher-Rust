use bonnext_lib::auth::token_store::{AccountStore, StoredAccount};

fn make_account(id: &str, username: &str, account_type: &str) -> StoredAccount {
    StoredAccount {
        id: id.to_string(),
        username: username.to_string(),
        uuid: format!("uuid-{}", id),
        access_token: format!("at-{}", id),
        refresh_token: None,
        account_type: account_type.to_string(),
        last_used: "2024-01-01".to_string(),
        expires_at: None,
        avatar_url: None,
        yggdrasil_client_token: None,
        yggdrasil_server_url: None,
        yggdrasil_selected_profile: None,
        local_skin_path: None,
        local_skin_model: None,
    }
}

#[test]
fn account_store_default_is_empty() {
    let store = AccountStore::default();
    assert!(store.accounts.is_empty());
    assert!(store.active_account_id.is_none());
}

#[test]
fn add_account_and_set_active() {
    let mut store = AccountStore::default();
    let account = make_account("test-1", "TestUser", "offline");
    store.accounts.push(account);
    store.active_account_id = Some("test-1".to_string());
    assert_eq!(store.accounts.len(), 1);
    assert_eq!(store.active_account_id, Some("test-1".to_string()));
}

#[test]
fn get_active_returns_correct_account() {
    let mut store = AccountStore::default();
    store.accounts.push(make_account("id-1", "User1", "offline"));
    store.accounts.push(make_account("id-2", "User2", "microsoft"));
    store.active_account_id = Some("id-2".to_string());
    let active = store.get_active();
    assert!(active.is_some());
    assert_eq!(active.unwrap().username, "User2");
}

#[test]
fn get_active_returns_none_when_not_set() {
    let mut store = AccountStore::default();
    store.accounts.push(make_account("id-1", "User1", "offline"));
    assert!(store.get_active().is_none());
}

#[test]
fn get_active_returns_none_for_invalid_id() {
    let mut store = AccountStore::default();
    store.accounts.push(make_account("id-1", "User1", "offline"));
    store.active_account_id = Some("nonexistent".to_string());
    assert!(store.get_active().is_none());
}

#[test]
fn stored_account_serialization_roundtrip() {
    let account = StoredAccount {
        id: "test-id".to_string(),
        username: "TestUser".to_string(),
        uuid: "uuid-1234".to_string(),
        access_token: "at-1234".to_string(),
        refresh_token: Some("rt-1234".to_string()),
        account_type: "microsoft".to_string(),
        last_used: "2024-01-01".to_string(),
        expires_at: Some("2024-12-31".to_string()),
        avatar_url: None,
        yggdrasil_client_token: None,
        yggdrasil_server_url: None,
        yggdrasil_selected_profile: None,
        local_skin_path: None,
        local_skin_model: None,
    };
    let json = serde_json::to_string(&account).unwrap();
    let deserialized: StoredAccount = serde_json::from_str(&json).unwrap();
    assert_eq!(account.id, deserialized.id);
    assert_eq!(account.username, deserialized.username);
    assert_eq!(account.uuid, deserialized.uuid);
    assert_eq!(account.access_token, deserialized.access_token);
    assert_eq!(account.refresh_token, deserialized.refresh_token);
    assert_eq!(account.account_type, deserialized.account_type);
}

#[test]
fn account_store_serialization_roundtrip() {
    let mut store = AccountStore::default();
    store.accounts.push(make_account("id-1", "User1", "offline"));
    store.accounts.push(make_account("id-2", "User2", "microsoft"));
    store.active_account_id = Some("id-2".to_string());
    let json = serde_json::to_string(&store).unwrap();
    let deserialized: AccountStore = serde_json::from_str(&json).unwrap();
    assert_eq!(store.accounts.len(), deserialized.accounts.len());
    assert_eq!(store.active_account_id, deserialized.active_account_id);
    assert_eq!(deserialized.accounts[0].username, "User1");
    assert_eq!(deserialized.accounts[1].username, "User2");
}

#[test]
fn stored_account_with_yggdrasil_fields() {
    let account = StoredAccount {
        id: "ygg-1".to_string(),
        username: "YggUser".to_string(),
        uuid: "uuid-ygg".to_string(),
        access_token: "at-ygg".to_string(),
        refresh_token: None,
        account_type: "yggdrasil".to_string(),
        last_used: "2024-06-01".to_string(),
        expires_at: None,
        avatar_url: Some("https://example.com/avatar.png".to_string()),
        yggdrasil_client_token: Some("ct-123".to_string()),
        yggdrasil_server_url: Some("https://auth.example.com".to_string()),
        yggdrasil_selected_profile: Some("profile-1".to_string()),
        local_skin_path: None,
        local_skin_model: None,
    };
    let json = serde_json::to_string(&account).unwrap();
    let deserialized: StoredAccount = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.yggdrasil_client_token, Some("ct-123".to_string()));
    assert_eq!(deserialized.yggdrasil_server_url, Some("https://auth.example.com".to_string()));
    assert_eq!(deserialized.avatar_url, Some("https://example.com/avatar.png".to_string()));
}

#[test]
fn stored_account_missing_optional_fields_deserialize_to_none() {
    let json = r#"{
        "id": "minimal",
        "username": "MinUser",
        "uuid": "uuid-min",
        "access_token": "at-min",
        "refresh_token": null,
        "account_type": "offline",
        "last_used": "2024-01-01",
        "expires_at": null,
        "avatar_url": null
    }"#;
    let account: StoredAccount = serde_json::from_str(json).unwrap();
    assert_eq!(account.id, "minimal");
    assert_eq!(account.yggdrasil_client_token, None);
    assert_eq!(account.yggdrasil_server_url, None);
    assert_eq!(account.yggdrasil_selected_profile, None);
    assert_eq!(account.local_skin_path, None);
    assert_eq!(account.local_skin_model, None);
}
