use crate::error::LauncherError;
use crate::platform::paths;
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct AchievementInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
    pub icon: String,
}

pub fn try_unlock_achievement(app: &tauri::AppHandle, id: &str) {
    let achievements_path = paths::get_game_dir().join("achievements.json");
    let mut unlocked: std::collections::HashMap<String, String> = if achievements_path.exists() {
        std::fs::read_to_string(&achievements_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    if unlocked.contains_key(id) {
        return;
    }

    let now = chrono::Local::now().to_rfc3339();
    unlocked.insert(id.to_string(), now);

    if let Ok(data) = serde_json::to_string_pretty(&unlocked) {
        let _ = std::fs::write(&achievements_path, data);
    }

    tracing::info!("Achievement unlocked: {}", id);
    let _ = app.emit("achievement-unlocked", serde_json::json!({ "id": id }));
}

#[tauri::command]
pub async fn get_achievements() -> Result<Vec<AchievementInfo>, LauncherError> {
    let achievements_path = paths::get_game_dir().join("achievements.json");
    let unlocked: std::collections::HashMap<String, String> = if achievements_path.exists() {
        std::fs::read_to_string(&achievements_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let definitions: &[(&str, &str, &str, &str)] = &[
        ("first_launch", "初次启动", "首次启动游戏", "🚀"),
        ("install_10_mods", "模组收藏家", "安装10个模组", "📦"),
        ("100_hours", "百小时玩家", "累计游戏100小时", "⏰"),
        ("create_instance", "世界创造者", "创建第一个实例", "🌍"),
        ("import_modpack", "整合包达人", "导入一个整合包", "📥"),
        ("export_modpack", "分享达人", "导出一个整合包", "📤"),
        ("use_snapshot", "时光旅行者", "使用快照功能", "📸"),
        ("optimize_preset", "性能大师", "使用优化预设", "⚡"),
        ("add_friend", "社交达人", "添加第一个好友", "👥"),
        ("customize_theme", "个性定制", "自定义主题设置", "🎨"),
    ];

    Ok(definitions.iter().map(|(id, name, desc, icon)| {
        AchievementInfo {
            id: id.to_string(),
            name: name.to_string(),
            description: desc.to_string(),
            unlocked: unlocked.contains_key(*id),
            unlocked_at: unlocked.get(*id).cloned(),
            icon: icon.to_string(),
        }
    }).collect())
}

#[tauri::command]
pub async fn unlock_achievement(achievement_id: String) -> Result<(), LauncherError> {
    let achievements_path = paths::get_game_dir().join("achievements.json");
    let mut unlocked: std::collections::HashMap<String, String> = if achievements_path.exists() {
        std::fs::read_to_string(&achievements_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let now = chrono::Local::now().to_rfc3339();
    unlocked.insert(achievement_id, now);

    let data = serde_json::to_string_pretty(&unlocked)?;
    std::fs::write(&achievements_path, data)?;
    Ok(())
}
