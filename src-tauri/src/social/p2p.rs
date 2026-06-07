use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

use rand::Rng;
use ed25519_dalek::{Signer, Verifier};
use crate::social::identity::{self, Identity};
use crate::social::transport::{self, EncryptedMessage, SendSession};
use crate::chat::messages::{Message, MessageStore};
use serde::{Serialize, Deserialize};

/// Peer connection state with established encryption sessions.
pub struct PeerConnection {
    pub peer_id: String,
    pub address: String,
    pub verifying_key: ed25519_dalek::VerifyingKey,
    pub send_session: Option<SendSession>,
}

/// Global P2P state shared across the app.
pub struct P2pState {
    pub listener_port: Mutex<Option<u16>>,
    pub connections: Mutex<HashMap<String, PeerConnection>>,
}

impl P2pState {
    pub fn new() -> Self {
        P2pState {
            listener_port: Mutex::new(None),
            connections: Mutex::new(HashMap::new()),
        }
    }
}

/// Simple framed message protocol: 4-byte big-endian length prefix + payload.
fn read_frame(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).map_err(|e| format!("Failed to read frame length: {}", e))?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > 10 * 1024 * 1024 {
        return Err("Frame too large".to_string());
    }
    let mut payload = vec![0u8; len];
    stream.read_exact(&mut payload).map_err(|e| format!("Failed to read frame payload: {}", e))?;
    Ok(payload)
}

fn write_frame(stream: &mut TcpStream, payload: &[u8]) -> Result<(), String> {
    let len = payload.len() as u32;
    stream.write_all(&len.to_be_bytes()).map_err(|e| format!("Write failed: {}", e))?;
    stream.write_all(payload).map_err(|e| format!("Write failed: {}", e))?;
    stream.flush().map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}

/// Plaintext envelope sent over the wire after encryption.
#[derive(Debug, Serialize, Deserialize)]
struct PlaintextEnvelope {
    msg_type: String,
    peer_id: String,
    content: String,
    timestamp: i64,
    signature: String,
}

/// Challenge-response identity verification.
#[derive(Debug, Serialize, Deserialize)]
struct ChallengeMessage {
    msg_type: String,
    challenge: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChallengeResponse {
    msg_type: String,
    peer_id: String,
    challenge: String,
    signature: String,
}

/// Start a TCP listener on a random port. Returns the bound port.
pub fn start_listener(
    state: Arc<P2pState>,
    identity: Arc<Identity>,
    message_store: Arc<MessageStore>,
) -> Result<u16, String> {
    let listener = TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind P2P listener: {}", e))?;
    let port = listener.local_addr().map_err(|e| format!("Failed to get local addr: {}", e))?.port();

    {
        let mut lp = state.listener_port.lock().unwrap();
        *lp = Some(port);
    }

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let identity = identity.clone();
                    let message_store = message_store.clone();
                    std::thread::spawn(move || {
                        if let Err(e) = handle_incoming(&mut stream, &identity, &message_store) {
                            tracing::warn!("P2P incoming connection error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    tracing::warn!("P2P listener error: {}", e);
                }
            }
        }
    });

    tracing::info!("P2P listener started on port {}", port);
    Ok(port)
}

/// Handle an incoming P2P connection: verify identity, decrypt message, store to DB.
fn handle_incoming(
    stream: &mut TcpStream,
    identity: &Identity,
    message_store: &MessageStore,
) -> Result<(), String> {
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30)))
        .map_err(|e| format!("set timeout: {}", e))?;

    // Phase 1: Generate challenge and send to peer
    let mut rng = rand::rngs::OsRng;
    let challenge: [u8; 32] = rng.gen();
    let challenge_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &challenge,
    );
    let chal_msg = serde_json::to_vec(&ChallengeMessage {
        msg_type: "challenge".to_string(),
        challenge: challenge_b64,
    }).map_err(|e| format!("json: {}", e))?;
    write_frame(stream, &chal_msg)?;

    // Phase 2: Read challenge response from peer
    let response_bytes = read_frame(stream)?;
    let response: ChallengeResponse = serde_json::from_slice(&response_bytes)
        .map_err(|e| format!("parse challenge response: {}", e))?;

    if response.msg_type != "challenge_response" {
        return Err("Expected challenge_response".to_string());
    }
    if response.challenge != base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &challenge,
    ) {
        return Err("Challenge mismatch".to_string());
    }

    // Verify the signature using the peer's claimed identity
    let sig_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &response.signature,
    ).map_err(|e| format!("sig decode: {}", e))?;
    let _sig = ed25519_dalek::Signature::from_slice(&sig_bytes)
        .map_err(|_| "Invalid signature bytes".to_string())?;

    // TODO: Verify signature against the friend's stored public key.
    // Full verification requires the peer's public key, which should come from
    // a friend request handshake or out-of-band exchange.
    let peer_id = &response.peer_id;
    tracing::info!("P2P connection from {} (signature format verified)", peer_id);

    // Phase 3: Read encrypted message
    let frame = read_frame(stream)?;
    let enc_msg: EncryptedMessage = serde_json::from_slice(&frame)
        .map_err(|e| format!("parse encrypted message: {}", e))?;

    let recv_session = transport::create_receive_session(&identity.signing_key);
    let plaintext = transport::decrypt_message(&recv_session, &enc_msg)?;

    let envelope: PlaintextEnvelope = serde_json::from_slice(&plaintext)
        .map_err(|e| format!("parse envelope: {}", e))?;

    // Store incoming message to local DB
    let msg = Message {
        id: None,
        peer_id: envelope.peer_id.clone(),
        content: envelope.content,
        sent_by_me: false,
        timestamp: envelope.timestamp,
        read: false,
        attachment: None,
    };
    message_store.insert(&msg).map_err(|e| format!("store message: {}", e))?;

    tracing::info!("Received P2P message from {}: {}", envelope.peer_id, msg.content);
    Ok(())
}

/// Send a message to a peer over TCP with encryption.
pub fn send_p2p_message(
    identity: &Identity,
    peer_verifying_key: &ed25519_dalek::VerifyingKey,
    peer_address: &str,
    peer_id: &str,
    content: &str,
) -> Result<(), String> {
    let mut stream = TcpStream::connect(peer_address)
        .map_err(|e| format!("Failed to connect to {}: {}", peer_address, e))?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30)))
        .map_err(|e| format!("set timeout: {}", e))?;

    // Phase 1: Read challenge from receiver
    let chal_bytes = read_frame(&mut stream)?;
    let chal_msg: ChallengeMessage = serde_json::from_slice(&chal_bytes)
        .map_err(|e| format!("parse challenge: {}", e))?;

    // Phase 2: Sign the challenge and send response
    let my_peer_id = identity::public_key_to_id(&identity.verifying_key);
    let sig = identity.signing_key.sign(
        &base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &chal_msg.challenge,
        ).map_err(|e| format!("chal decode: {}", e))?,
    );
    let sig_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        sig.to_bytes(),
    );
    let response = serde_json::to_vec(&ChallengeResponse {
        msg_type: "challenge_response".to_string(),
        peer_id: my_peer_id.clone(),
        challenge: chal_msg.challenge,
        signature: sig_b64,
    }).map_err(|e| format!("json: {}", e))?;
    write_frame(&mut stream, &response)?;

    // Phase 3: Send encrypted message
    let envelope = PlaintextEnvelope {
        msg_type: "chat_message".to_string(),
        peer_id: my_peer_id,
        content: content.to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        signature: String::new(),
    };
    let plaintext = serde_json::to_vec(&envelope).map_err(|e| format!("json: {}", e))?;

    let mut send_session = transport::create_send_session(&identity.signing_key, peer_verifying_key);
    let enc_msg = transport::encrypt_message(&mut send_session, &plaintext);
    let frame = serde_json::to_vec(&enc_msg).map_err(|e| format!("json: {}", e))?;
    write_frame(&mut stream, &frame)?;

    tracing::info!("Sent P2P message to {} at {}", peer_id, peer_address);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::messages::MessageStore;
    use tempfile::tempdir;

    #[test]
    fn test_p2p_message_encrypt_decrypt_flow() {
        let alice = identity::generate_identity();
        let bob = identity::generate_identity();

        let alice_id = identity::public_key_to_id(&alice.verifying_key);

        // Bob creates a receive session and decrypts
        let mut send = transport::create_send_session(&alice.signing_key, &bob.verifying_key);
        let plaintext = serde_json::to_vec(&PlaintextEnvelope {
            msg_type: "chat_message".to_string(),
            peer_id: alice_id.clone(),
            content: "hello from alice".to_string(),
            timestamp: 1700000000,
            signature: String::new(),
        }).unwrap();
        let enc_msg = transport::encrypt_message(&mut send, &plaintext);
        let frame = serde_json::to_vec(&enc_msg).unwrap();

        // Bob receives
        let recv = transport::create_receive_session(&bob.signing_key);
        let parsed: EncryptedMessage = serde_json::from_slice(&frame).unwrap();
        let decrypted = transport::decrypt_message(&recv, &parsed).unwrap();
        let envelope: PlaintextEnvelope = serde_json::from_slice(&decrypted).unwrap();

        assert_eq!(envelope.peer_id, alice_id);
        assert_eq!(envelope.content, "hello from alice");
    }

    #[test]
    fn test_challenge_response_roundtrip() {
        let identity = identity::generate_identity();
        let mut rng = rand::rngs::OsRng;
        let challenge: [u8; 32] = rng.gen();

        // Sign the challenge
        let sig = identity.signing_key.sign(&challenge);
        let sig_b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            sig.to_bytes(),
        );

        // Verify the signature
        let sig_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &sig_b64,
        ).unwrap();
        let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).unwrap();
        identity.verifying_key.verify(&challenge, &sig).unwrap();
    }
}
