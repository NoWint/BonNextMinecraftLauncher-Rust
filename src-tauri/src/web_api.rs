use axum::{
    Router,
    extract::State,
    routing::get,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

#[derive(Debug, Clone, Serialize)]
struct ApiStatus {
    version: String,
    status: String,
    instances_count: usize,
}

#[derive(Debug, Clone, Serialize)]
struct InstanceInfo {
    id: String,
    name: String,
    version_id: String,
    loader_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuthHeader {
    authorization: String,
}

struct WebAppState {
    auth_token: String,
}

fn verify_token(state: &WebAppState, auth: &str) -> bool {
    auth == format!("Bearer {}", state.auth_token)
}

async fn get_status(
    State(state): State<Arc<WebAppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<ApiStatus>, StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !verify_token(&state, auth) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let instances = crate::instance::manager::list_instances().unwrap_or_default();
    Ok(Json(ApiStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        status: "running".to_string(),
        instances_count: instances.len(),
    }))
}

async fn list_instances_handler(
    State(state): State<Arc<WebAppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<InstanceInfo>>, StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !verify_token(&state, auth) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let instances = crate::instance::manager::list_instances().unwrap_or_default();
    let infos: Vec<InstanceInfo> = instances
        .iter()
        .map(|i| InstanceInfo {
            id: i.id.clone(),
            name: i.name.clone(),
            version_id: i.version_id.clone(),
            loader_type: i.loader_type.clone(),
        })
        .collect();
    Ok(Json(infos))
}

pub struct WebApiServer {
    pub port: u16,
    pub token: String,
}

impl WebApiServer {
    pub fn new(port: u16) -> Self {
        use rand::Rng;
        let token = format!("{:032x}", rand::thread_rng().gen::<u128>());
        Self { port, token }
    }

    pub async fn start(self: Arc<Self>) -> Result<(), String> {
        let state = Arc::new(WebAppState {
            auth_token: self.token.clone(),
        });

        let app = Router::new()
            .route("/api/status", get(get_status))
            .route("/api/instances", get(list_instances_handler))
            .layer(CorsLayer::permissive())
            .with_state(state);

        let addr = std::net::SocketAddr::from(([127, 0, 0, 1], self.port));
        tracing::info!("Web API server starting on {}", addr);

        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .map_err(|e| format!("Failed to bind Web API: {}", e))?;

        axum::serve(listener, app)
            .await
            .map_err(|e| format!("Web API error: {}", e))
    }
}
