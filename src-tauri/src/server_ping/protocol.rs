use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

use crate::error::LauncherError;
use super::models::MinecraftServerInfo;

fn encode_var_int(value: i32) -> Vec<u8> {
    let mut buf = Vec::new();
    let mut val = value as u32;
    loop {
        let mut byte = (val & 0x7F) as u8;
        val >>= 7;
        if val != 0 {
            byte |= 0x80;
        }
        buf.push(byte);
        if val == 0 {
            break;
        }
    }
    buf
}

async fn decode_var_int<R: AsyncReadExt + Unpin>(reader: &mut R) -> Result<i32, LauncherError> {
    let mut result: i32 = 0;
    let mut shift: u32 = 0;
    loop {
        let mut buf = [0u8; 1];
        reader
            .read_exact(&mut buf)
            .await
            .map_err(|e| LauncherError::ServerPing(format!("Failed to read VarInt: {}", e)))?;
        let byte = buf[0];
        result |= ((byte & 0x7F) as i32) << shift;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift >= 35 {
            return Err(LauncherError::ServerPing("VarInt too large".to_string()));
        }
    }
    Ok(result)
}

fn build_handshake_packet(address: &str, port: u16) -> Vec<u8> {
    let protocol_version = encode_var_int(-1);
    let addr_bytes = address.as_bytes();
    let addr_len = encode_var_int(addr_bytes.len() as i32);
    let port_bytes = port.to_be_bytes();
    let next_state = encode_var_int(1);

    let mut data = Vec::new();
    data.extend_from_slice(&protocol_version);
    data.extend_from_slice(&addr_len);
    data.extend_from_slice(addr_bytes);
    data.extend_from_slice(&port_bytes);
    data.extend_from_slice(&next_state);

    let packet_id = encode_var_int(0);
    let mut packet_data = Vec::new();
    packet_data.extend_from_slice(&packet_id);
    packet_data.extend_from_slice(&data);

    let length = encode_var_int(packet_data.len() as i32);
    let mut packet = Vec::new();
    packet.extend_from_slice(&length);
    packet.extend_from_slice(&packet_data);
    packet
}

fn build_status_request_packet() -> Vec<u8> {
    let packet_id = encode_var_int(0);
    let length = encode_var_int(packet_id.len() as i32);
    let mut packet = Vec::new();
    packet.extend_from_slice(&length);
    packet.extend_from_slice(&packet_id);
    packet
}

pub async fn ping_server(
    connect_address: &str,
    connect_port: u16,
    handshake_address: &str,
    handshake_port: u16,
    timeout_ms: u32,
) -> Result<MinecraftServerInfo, LauncherError> {
    let addr = format!("{}:{}", connect_address, connect_port);
    let stream = timeout(Duration::from_millis(timeout_ms as u64), TcpStream::connect(&addr))
        .await
        .map_err(|_| LauncherError::ServerPing(format!("Connection timeout to {}", addr)))?
        .map_err(|e| {
            LauncherError::ServerPing(format!("Connection failed to {}: {}", addr, e))
        })?;

    let (mut reader, mut writer) = stream.into_split();

    let handshake = build_handshake_packet(handshake_address, handshake_port);
    writer.write_all(&handshake).await.map_err(|e| {
        LauncherError::ServerPing(format!("Handshake send failed: {}", e))
    })?;

    let status_request = build_status_request_packet();
    writer.write_all(&status_request).await.map_err(|e| {
        LauncherError::ServerPing(format!("Status request send failed: {}", e))
    })?;

    let _packet_length = decode_var_int(&mut reader).await?;
    let _packet_id = decode_var_int(&mut reader).await?;
    let json_length = decode_var_int(&mut reader).await?;

    if json_length <= 0 || json_length > 1_000_000 {
        return Err(LauncherError::ServerPing(format!(
            "Invalid response length: {}",
            json_length
        )));
    }

    let mut json_buf = vec![0u8; json_length as usize];
    reader.read_exact(&mut json_buf).await.map_err(|e| {
        LauncherError::ServerPing(format!("Failed to read response: {}", e))
    })?;

    let json_str = String::from_utf8(json_buf)
        .map_err(|e| LauncherError::ServerPing(format!("Invalid UTF-8 in response: {}", e)))?;

    let info: MinecraftServerInfo = serde_json::from_str(&json_str).map_err(|e| {
        LauncherError::ServerPing(format!("Failed to parse server response: {}", e))
    })?;

    Ok(info)
}
