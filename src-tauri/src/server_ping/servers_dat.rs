use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerAddress {
    pub name: String,
    pub address: String,
    pub port: u16,
    pub hidden: bool,
    pub icon: Option<String>,
    pub accept_textures: bool,
}

fn parse_ip_and_port(ip_str: &str) -> (String, u16) {
    if let Some(colon_pos) = ip_str.rfind(':') {
        let addr = &ip_str[..colon_pos];
        let port_str = &ip_str[colon_pos + 1..];
        if let Ok(port) = port_str.parse::<u16>() {
            return (addr.to_string(), port);
        }
    }
    (ip_str.to_string(), 25565)
}

pub fn read_servers_dat(path: &PathBuf) -> Result<Vec<ServerAddress>, LauncherError> {
    let data = std::fs::read(path)
        .map_err(|e| LauncherError::ServerPing(format!("Failed to read servers.dat: {}", e)))?;

    // Try gzip decompression first, then raw
    let nbt_data = if data.len() >= 2 && data[0] == 0x1F && data[1] == 0x8B {
        let mut decoder = flate2::read::GzDecoder::new(&data[..]);
        let mut decompressed = Vec::new();
        std::io::Read::read_to_end(&mut decoder, &mut decompressed)
            .map_err(|e| LauncherError::ServerPing(format!("Gzip decompress failed: {}", e)))?;
        decompressed
    } else {
        data
    };

    let value: fastnbt::Value = fastnbt::from_bytes(&nbt_data)
        .map_err(|e| LauncherError::ServerPing(format!("NBT parse failed: {}", e)))?;

    let mut servers = Vec::new();

    if let fastnbt::Value::Compound(root) = value {
        if let Some(fastnbt::Value::List(list)) = root.get("servers") {
            for item in list {
                if let fastnbt::Value::Compound(comp) = item {
                    let name = comp
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    let ip = comp
                        .get("ip")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let (address, port) = parse_ip_and_port(&ip);
                    let hidden = comp
                        .get("hidden")
                        .and_then(|v| match v {
                            fastnbt::Value::Byte(b) => Some(*b != 0),
                            _ => None,
                        })
                        .unwrap_or(false);
                    let icon = comp
                        .get("icon")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let accept_textures = comp
                        .get("acceptTextures")
                        .and_then(|v| match v {
                            fastnbt::Value::Byte(b) => Some(*b != 0),
                            _ => None,
                        })
                        .unwrap_or(false);

                    servers.push(ServerAddress {
                        name,
                        address,
                        port,
                        hidden,
                        icon,
                        accept_textures,
                    });
                }
            }
        }
    }

    Ok(servers)
}

pub fn write_servers_dat(path: &PathBuf, servers: &[ServerAddress]) -> Result<(), LauncherError> {
    let mut list = Vec::new();
    for server in servers {
        let mut comp = std::collections::HashMap::new();
        comp.insert(
            "name".to_string(),
            fastnbt::Value::String(server.name.clone()),
        );
        let ip = if server.port != 25565 {
            format!("{}:{}", server.address, server.port)
        } else {
            server.address.clone()
        };
        comp.insert("ip".to_string(), fastnbt::Value::String(ip));
        comp.insert(
            "hidden".to_string(),
            fastnbt::Value::Byte(if server.hidden { 1 } else { 0 }),
        );
        if let Some(icon) = &server.icon {
            comp.insert("icon".to_string(), fastnbt::Value::String(icon.clone()));
        }
        comp.insert(
            "acceptTextures".to_string(),
            fastnbt::Value::Byte(if server.accept_textures { 1 } else { 0 }),
        );
        list.push(fastnbt::Value::Compound(comp));
    }

    let mut root = std::collections::HashMap::new();
    root.insert("servers".to_string(), fastnbt::Value::List(list));

    let nbt = fastnbt::to_bytes(&fastnbt::Value::Compound(root))
        .map_err(|e| LauncherError::ServerPing(format!("NBT encode failed: {}", e)))?;

    std::fs::write(path, &nbt)
        .map_err(|e| LauncherError::ServerPing(format!("Write servers.dat failed: {}", e)))?;

    Ok(())
}
