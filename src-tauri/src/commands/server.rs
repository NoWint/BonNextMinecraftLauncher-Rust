use crate::error::LauncherError;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatusInfo {
    pub name: String,
    pub address: String,
    pub online: bool,
    pub players_online: u32,
    pub players_max: u32,
    pub latency_ms: u64,
    pub motd: String,
    pub version: String,
}

fn write_varint(buf: &mut Vec<u8>, mut value: i32) {
    loop {
        let mut temp = (value & 0x7F) as u8;
        value = ((value as u32) >> 7) as i32;
        if value != 0 {
            temp |= 0x80;
        }
        buf.push(temp);
        if value == 0 {
            break;
        }
    }
}

fn read_varint(reader: &mut impl std::io::Read) -> Result<i32, LauncherError> {
    let mut result = 0i32;
    let mut shift = 0u32;
    loop {
        let mut buf = [0u8; 1];
        reader.read_exact(&mut buf).map_err(|e| LauncherError::Other(format!("SLP read error: {}", e)))?;
        let byte = buf[0];
        result |= ((byte & 0x7F) as i32) << shift;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift >= 32 {
            return Err(LauncherError::Other("VarInt too long".into()));
        }
    }
    Ok(result)
}

fn write_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    write_varint(buf, bytes.len() as i32);
    buf.extend_from_slice(bytes);
}

fn read_string(reader: &mut impl std::io::Read) -> Result<String, LauncherError> {
    let len = read_varint(reader)? as usize;
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).map_err(|e| LauncherError::Other(format!("SLP string read: {}", e)))?;
    String::from_utf8(buf).map_err(|e| LauncherError::Other(format!("SLP invalid utf8: {}", e)))
}

#[tauri::command]
pub async fn ping_server(address: String) -> Result<ServerStatusInfo, LauncherError> {
    let start = std::time::Instant::now();

    let addr = address.trim();
    let (host, port) = if addr.starts_with('[') {
        if let Some(bracket_end) = addr.find(']') {
            let h = addr[1..bracket_end].to_string();
            let p = addr.get(bracket_end + 2..).and_then(|s| s.parse::<u16>().ok()).unwrap_or(25565);
            (h, p)
        } else {
            (addr.to_string(), 25565u16)
        }
    } else if let Some((h, p)) = addr.rsplit_once(':') {
        (h.to_string(), p.parse::<u16>().unwrap_or(25565))
    } else {
        (addr.to_string(), 25565u16)
    };

    let sock_addr = format!("{}:{}", host, port);

    let connect_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&sock_addr)
    ).await;
    let stream = connect_result.map_err(|_| LauncherError::Other(format!("Connection timeout: {}", sock_addr)))?
        .map_err(|e| LauncherError::Other(format!("Cannot connect to {}: {}", sock_addr, e)))?;

    let latency_ms = start.elapsed().as_millis() as u64;

    let (mut reader, mut writer) = stream.into_split();
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut handshake = Vec::new();
    write_varint(&mut handshake, 0x00);
    write_varint(&mut handshake, -1);
    write_string(&mut handshake, &host);
    handshake.push((port >> 8) as u8);
    handshake.push((port & 0xFF) as u8);
    write_varint(&mut handshake, 1);

    let mut handshake_packet = Vec::new();
    write_varint(&mut handshake_packet, handshake.len() as i32);
    handshake_packet.extend_from_slice(&handshake);

    let mut status_request = Vec::new();
    write_varint(&mut status_request, 1);
    write_varint(&mut status_request, 0x00);

    writer.write_all(&handshake_packet).await.map_err(|e| LauncherError::Other(format!("SLP handshake: {}", e)))?;
    writer.write_all(&status_request).await.map_err(|e| LauncherError::Other(format!("SLP status req: {}", e)))?;

    let mut len_buf = [0u8; 5];
    let mut len_pos = 0;
    loop {
        let n = reader.read(&mut len_buf[len_pos..(len_pos + 1)]).await.map_err(|e| LauncherError::Other(format!("SLP read len: {}", e)))?;
        if n == 0 {
            return Ok(ServerStatusInfo {
                name: host.clone(), address: sock_addr.clone(),
                online: true, players_online: 0, players_max: 0,
                latency_ms, motd: String::new(), version: String::new(),
            });
        }
        len_pos += 1;
        if len_buf[len_pos - 1] & 0x80 == 0 {
            break;
        }
        if len_pos >= 5 {
            return Err(LauncherError::Other("SLP packet too large".into()));
        }
    }

    let packet_len = {
        let mut cursor = std::io::Cursor::new(&len_buf[..len_pos]);
        read_varint(&mut cursor)?
    } as usize;

    let mut packet_data = vec![0u8; packet_len];
    reader.read_exact(&mut packet_data).await.map_err(|e| LauncherError::Other(format!("SLP read packet: {}", e)))?;

    let mut cursor = std::io::Cursor::new(&packet_data);
    let packet_id = read_varint(&mut cursor)?;
    if packet_id != 0x00 {
        return Ok(ServerStatusInfo {
            name: host.clone(), address: sock_addr.clone(),
            online: true, players_online: 0, players_max: 0,
            latency_ms, motd: format!("Unexpected packet ID: {}", packet_id), version: String::new(),
        });
    }

    let json_str = read_string(&mut cursor)?;
    let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();

    let motd = if let Some(desc) = parsed["description"].as_str() {
        desc.to_string()
    } else if let Some(text) = parsed["description"]["text"].as_str() {
        text.to_string()
    } else if let Some(extra) = parsed["description"]["extra"].as_array() {
        extra.iter().filter_map(|e| e["text"].as_str()).collect::<Vec<_>>().join("")
    } else {
        String::new()
    };

    let players_online = parsed["players"]["online"].as_u64().unwrap_or(0) as u32;
    let players_max = parsed["players"]["max"].as_u64().unwrap_or(0) as u32;

    let version = parsed["version"]["name"].as_str().unwrap_or("").to_string();

    Ok(ServerStatusInfo {
        name: host.clone(),
        address: sock_addr,
        online: true,
        players_online,
        players_max,
        latency_ms,
        motd,
        version,
    })
}
