use serde::{Serialize, Deserialize};
use chrono::Utc;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityType {
    Playing { version: String, server: Option<String> },
    ModInstalled { mod_name: String },
    AchievementUnlocked { achievement_name: String },
    InstanceCreated { instance_name: String },
    CoPlayInvite { peer_name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Visibility {
    Friends,
    Public,
    Nobody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: String,
    pub activity_type: ActivityType,
    pub timestamp: i64,
    pub visible_to: Visibility,
    pub signature: Option<String>,
}

pub struct ActivityStore {
    path: PathBuf,
}

impl ActivityStore {
    pub fn new(storage_path: PathBuf) -> Self {
        Self { path: storage_path }
    }

    pub fn add_activity(&self, activity: &Activity) -> Result<(), String> {
        let mut activities = self.load_all().unwrap_or_default();
        activities.push(activity.clone());
        if activities.len() > 200 {
            activities = activities.split_off(activities.len() - 200);
        }
        let json = serde_json::to_string_pretty(&activities)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        std::fs::write(&self.path, json).map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    pub fn load_all(&self) -> Option<Vec<Activity>> {
        if !self.path.exists() { return None; }
        let data = std::fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&data).ok()
    }

    pub fn get_recent(&self, limit: usize) -> Vec<Activity> {
        let all = self.load_all().unwrap_or_default();
        all.into_iter().rev().take(limit).collect()
    }

    pub fn get_visible_to_friends(&self, limit: usize) -> Vec<Activity> {
        self.get_recent(limit).into_iter()
            .filter(|a| matches!(a.visible_to, Visibility::Friends | Visibility::Public))
            .collect()
    }
}

pub fn create_activity(activity_type: ActivityType, visible_to: Visibility) -> Activity {
    Activity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type,
        timestamp: Utc::now().timestamp(),
        visible_to,
        signature: None,
    }
}
