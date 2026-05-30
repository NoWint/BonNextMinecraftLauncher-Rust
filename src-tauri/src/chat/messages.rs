use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Message {
    pub id: Option<i64>,
    pub peer_id: String,
    pub content: String,
    pub sent_by_me: bool,
    pub timestamp: i64,
    pub read: bool,
    pub attachment: Option<AttachmentInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AttachmentInfo {
    pub filename: String,
    pub file_path: String,
    pub size_bytes: u64,
}

pub struct MessageStore {
    conn: Mutex<Connection>,
}

impl MessageStore {
    pub fn new(db_path: &PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create db dir: {}", e))?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open message db: {}", e))?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id TEXT NOT NULL,
                content TEXT NOT NULL,
                sent_by_me INTEGER NOT NULL DEFAULT 0,
                timestamp INTEGER NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                attachment_filename TEXT,
                attachment_path TEXT,
                attachment_size INTEGER
            )",
            [],
        ).map_err(|e| format!("Failed to create messages table: {}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_peer ON messages(peer_id, timestamp)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;
        Ok(MessageStore { conn: Mutex::new(conn) })
    }

    pub fn insert(&self, msg: &Message) -> Result<i64, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                msg.peer_id, msg.content, msg.sent_by_me as i32, msg.timestamp, msg.read as i32,
                msg.attachment.as_ref().map(|a| &a.filename),
                msg.attachment.as_ref().map(|a| &a.file_path),
                msg.attachment.as_ref().map(|a| a.size_bytes as i64),
            ],
        ).map_err(|e| format!("Insert failed: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_messages(&self, peer_id: &str, before_id: Option<i64>, limit: u32) -> Result<Vec<Message>, String> {
        let conn = self.conn.lock().unwrap();
        let query = if let Some(before) = before_id {
            format!(
                "SELECT id, peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size
                 FROM messages WHERE peer_id = ? AND id < {} ORDER BY id DESC LIMIT ?", before
            )
        } else {
            "SELECT id, peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size
             FROM messages WHERE peer_id = ? ORDER BY id DESC LIMIT ?".to_string()
        };
        let mut stmt = conn.prepare(&query).map_err(|e| format!("Prepare failed: {}", e))?;
        let rows = stmt.query_map(params![peer_id, limit], |row| {
            Ok(Message {
                id: Some(row.get(0)?), peer_id: row.get(1)?, content: row.get(2)?,
                sent_by_me: row.get::<_, i32>(3)? != 0, timestamp: row.get(4)?,
                read: row.get::<_, i32>(5)? != 0,
                attachment: match row.get::<_, Option<String>>(6)? {
                    Some(filename) => Some(AttachmentInfo {
                        filename,
                        file_path: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                        size_bytes: row.get::<_, Option<i64>>(8)?.unwrap_or(0) as u64,
                    }),
                    None => None,
                },
            })
        }).map_err(|e| format!("Query failed: {}", e))?;
        let mut messages: Vec<Message> = rows.filter_map(|r| r.ok()).collect();
        messages.reverse();
        Ok(messages)
    }

    pub fn mark_read(&self, peer_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE messages SET read = 1 WHERE peer_id = ? AND read = 0", params![peer_id])
            .map_err(|e| format!("Mark read failed: {}", e))?;
        Ok(())
    }

    pub fn get_unread_count(&self, peer_id: &str) -> Result<i64, String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE peer_id = ? AND read = 0",
            params![peer_id],
            |row| row.get(0),
        ).map_err(|e| format!("Count failed: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_store() -> (MessageStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("messages.db");
        let store = MessageStore::new(&db_path).unwrap();
        (store, dir)
    }

    #[test]
    fn test_insert_and_get_messages() {
        let (store, _dir) = create_test_store();
        let msg = Message {
            id: None, peer_id: "bon-test123".into(), content: "hello".into(),
            sent_by_me: true, timestamp: 1700000000, read: false, attachment: None,
        };
        let id = store.insert(&msg).unwrap();
        assert!(id > 0);
        let msgs = store.get_messages("bon-test123", None, 50).unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content, "hello");
        assert!(msgs[0].sent_by_me);
    }

    #[test]
    fn test_mark_read() {
        let (store, _dir) = create_test_store();
        store.insert(&Message {
            id: None, peer_id: "p1".into(), content: "msg".into(),
            sent_by_me: false, timestamp: 1, read: false, attachment: None,
        }).unwrap();
        assert_eq!(store.get_unread_count("p1").unwrap(), 1);
        store.mark_read("p1").unwrap();
        assert_eq!(store.get_unread_count("p1").unwrap(), 0);
    }

    #[test]
    fn test_pagination() {
        let (store, _dir) = create_test_store();
        for i in 0..5 {
            store.insert(&Message {
                id: None, peer_id: "p1".into(),
                content: format!("msg{}", i),
                sent_by_me: i % 2 == 0, timestamp: i as i64,
                read: false, attachment: None,
            }).unwrap();
        }
        let msgs = store.get_messages("p1", None, 3).unwrap();
        assert_eq!(msgs.len(), 3);
        let last_id = msgs.last().unwrap().id;
        let rest = store.get_messages("p1", last_id, 3).unwrap();
        assert_eq!(rest.len(), 2);
    }
}
