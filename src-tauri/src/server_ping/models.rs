use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftServerInfo {
    pub version: ServerVersion,
    pub players: ServerPlayers,
    #[serde(deserialize_with = "deserialize_description")]
    pub description: ServerDescription,
    pub favicon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerVersion {
    pub name: String,
    pub protocol: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPlayers {
    pub max: i32,
    pub online: i32,
    pub sample: Option<Vec<ServerPlayer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPlayer {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDescription {
    pub text: String,
    #[serde(default)]
    pub extra: Option<Vec<ServerDescriptionExtra>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDescriptionExtra {
    pub text: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub bold: Option<bool>,
    #[serde(default)]
    pub italic: Option<bool>,
    #[serde(default)]
    pub underlined: Option<bool>,
    #[serde(default)]
    pub strikethrough: Option<bool>,
    #[serde(default)]
    pub obfuscated: Option<bool>,
}

impl From<&str> for ServerDescription {
    fn from(s: &str) -> Self {
        Self {
            text: s.to_string(),
            extra: None,
        }
    }
}

fn deserialize_description<'de, D>(deserializer: D) -> Result<ServerDescription, D::Error>
where
    D: Deserializer<'de>,
{
    use serde_json::Value;
    let value = Value::deserialize(deserializer)?;
    match &value {
        Value::String(s) => Ok(ServerDescription {
            text: s.clone(),
            extra: None,
        }),
        Value::Object(_) => {
            let text = value
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let extra = value
                .get("extra")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value(v.clone()).ok())
                        .collect::<Vec<ServerDescriptionExtra>>()
                });
            Ok(ServerDescription { text, extra })
        }
        Value::Array(arr) => {
            let text = arr
                .first()
                .and_then(|v| v.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let extra = Some(
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect::<Vec<ServerDescriptionExtra>>(),
            );
            Ok(ServerDescription { text, extra })
        }
        _ => Ok(ServerDescription {
            text: String::new(),
            extra: None,
        }),
    }
}

impl ServerDescription {
    pub fn to_plain_text(&self) -> String {
        let mut parts = Vec::new();
        if !self.text.is_empty() {
            parts.push(self.text.clone());
        }
        if let Some(extra) = &self.extra {
            for e in extra {
                parts.push(e.text.clone());
            }
        }
        if parts.is_empty() {
            return String::new();
        }
        parts.join("")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerListEntry {
    pub id: i64,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub is_favorite: bool,
    pub last_ping_result: Option<MinecraftServerInfo>,
    pub last_ping_at: Option<i64>,
    pub latency_ms: Option<i64>,
    pub icon_base64: Option<String>,
    pub notes: Option<String>,
}
