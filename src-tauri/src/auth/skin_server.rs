use axum::{
    Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use base64::Engine;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

static HANDLE_LOCK: parking_lot::Mutex<()> = parking_lot::Mutex::new(());
static mut ACTIVE_HANDLE: Option<SkinServerHandle> = None;

#[derive(Debug, Clone)]
struct SkinEntry {
    uuid: String,
    username: String,
    skin_data: Vec<u8>,
    skin_model: String,
    cape_data: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
struct ServerState {
    port: u16,
    registry: Arc<RwLock<HashMap<String, SkinEntry>>>,
}

pub struct SkinServerHandle {
    pub port: u16,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}
impl SkinServerHandle {
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

impl Drop for SkinServerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn set_active_handle(handle: SkinServerHandle) {
    let _lock = HANDLE_LOCK.lock();
    stop_skin_server_internal();
    unsafe {
        ACTIVE_HANDLE = Some(handle);
    }
}

pub fn stop_skin_server() {
    let _lock = HANDLE_LOCK.lock();
    stop_skin_server_internal();
}

fn stop_skin_server_internal() {
    unsafe {
        if let Some(ref mut handle) = ACTIVE_HANDLE {
            handle.stop();
        }
        ACTIVE_HANDLE = None;
    }
}

pub async fn start_skin_server(
    uuid: &str,
    username: &str,
    skin_path: &str,
    skin_model: &str,
    cape_data: Option<Vec<u8>>,
) -> Result<SkinServerHandle, crate::error::LauncherError> {
    let skin_data = tokio::fs::read(skin_path).await?;

    let registry: Arc<RwLock<HashMap<String, SkinEntry>>> = Arc::new(RwLock::new(HashMap::new()));
    let entry = SkinEntry {
        uuid: uuid.to_string(),
        username: username.to_string(),
        skin_data,
        skin_model: skin_model.to_string(),
        cape_data,
    };
    registry.write().await.insert(uuid.to_string(), entry);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();

    let state = ServerState {
        port,
        registry: registry.clone(),
    };

    let app = Router::new()
        .route("/", get(handle_api_root))
        .route(
            "/sessionserver/session/minecraft/profile/{uuid}",
            get(handle_profile),
        )
        .route("/skin/{uuid}", get(handle_skin))
        .route("/cape/{uuid}", get(handle_cape))
        .with_state(state);

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        let server = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            });
        if let Err(e) = server.await {
            tracing::warn!("Skin server error: {}", e);
        }
    });

    tracing::info!("Local skin server started on 127.0.0.1:{}", port);

    Ok(SkinServerHandle {
        port,
        shutdown_tx: Some(shutdown_tx),
    })
}

async fn handle_api_root(State(state): State<ServerState>) -> Response {
    let metadata = json!({
        "meta": {
            "serverName": "BonNext Local Skin Server",
            "implementationName": "BonNext",
            "implementationVersion": "1.0.0"
        },
        "skinDomains": [
            "127.0.0.1",
            "localhost"
        ],
        "signaturePublickey": ""
    });
    axum::Json(metadata).into_response()
}

async fn handle_profile(
    Path(uuid): Path<String>,
    State(state): State<ServerState>,
) -> Response {
    let registry = state.registry.read().await;
    let entry = match registry.get(&uuid) {
        Some(e) => e,
        None => return (StatusCode::NOT_FOUND, "Profile not found").into_response(),
    };

    let server_base = format!("http://127.0.0.1:{}", state.port);
    let skin_url = format!("{}/skin/{}", server_base, uuid);
    let cape_url = entry.cape_data.as_ref().map(|_| format!("{}/cape/{}", server_base, uuid));

    let mut textures = json!({
        "SKIN": {
            "url": skin_url,
            "metadata": { "model": entry.skin_model }
        }
    });
    if let Some(ref cape) = cape_url {
        textures.as_object_mut().unwrap().insert(
            "CAPE".to_string(),
            json!({ "url": cape }),
        );
    }

    let textures_value = json!({
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "profile_id": entry.uuid,
        "profile_name": entry.username,
        "textures": textures,
    });

    let textures_b64 = base64::engine::general_purpose::STANDARD
        .encode(textures_value.to_string());

    let profile = json!({
        "id": entry.uuid,
        "name": entry.username,
        "properties": [
            {
                "name": "textures",
                "value": textures_b64,
            }
        ]
    });

    axum::Json(profile).into_response()
}

async fn handle_skin(
    Path(uuid): Path<String>,
    State(state): State<ServerState>,
) -> Response {
    let registry = state.registry.read().await;
    match registry.get(&uuid) {
        Some(entry) => (
            StatusCode::OK,
            [("Content-Type", "image/png")],
            entry.skin_data.clone(),
        )
            .into_response(),
        None => (StatusCode::NOT_FOUND, "Skin not found").into_response(),
    }
}

async fn handle_cape(
    Path(uuid): Path<String>,
    State(state): State<ServerState>,
) -> Response {
    let registry = state.registry.read().await;
    match registry.get(&uuid) {
        Some(entry) => match &entry.cape_data {
            Some(data) => (
                StatusCode::OK,
                [("Content-Type", "image/png")],
                data.clone(),
            )
                .into_response(),
            None => (StatusCode::NOT_FOUND, "No cape").into_response(),
        },
        None => (StatusCode::NOT_FOUND, "Profile not found").into_response(),
    }
}
