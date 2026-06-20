use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerProfile {
    pub version_preferences: HashMap<String, f64>,
    pub loader_preferences: HashMap<String, f64>,
    pub mod_category_preferences: HashMap<String, f64>,
    pub total_playtime_minutes: f64,
    pub installed_mod_count: usize,
}

impl PlayerProfile {
    pub fn cosine_similarity(&self, other: &PlayerProfile) -> f64 {
        let mut a_vec = Vec::new();
        let mut b_vec = Vec::new();
        for (version, score) in &self.version_preferences {
            a_vec.push(*score);
            b_vec.push(*other.version_preferences.get(version).unwrap_or(&0.0));
        }
        for (loader, score) in &self.loader_preferences {
            a_vec.push(*score);
            b_vec.push(*other.loader_preferences.get(loader).unwrap_or(&0.0));
        }
        for (cat, score) in &self.mod_category_preferences {
            a_vec.push(*score);
            b_vec.push(*other.mod_category_preferences.get(cat).unwrap_or(&0.0));
        }
        if a_vec.is_empty() || b_vec.is_empty() { return 0.0; }
        let dot: f64 = a_vec.iter().zip(b_vec.iter()).map(|(a, b)| a * b).sum();
        let mag_a: f64 = (a_vec.iter().map(|v| v * v).sum::<f64>()).sqrt();
        let mag_b: f64 = (b_vec.iter().map(|v| v * v).sum::<f64>()).sqrt();
        if mag_a == 0.0 || mag_b == 0.0 { return 0.0; }
        dot / (mag_a * mag_b)
    }
}

pub fn build_player_profile(
    installed_mod_categories: &HashMap<String, String>,
    collection_categories: &HashMap<String, String>,
    played_versions: &HashMap<String, f64>,
    played_loaders: &HashMap<String, f64>,
    total_playtime_minutes: f64,
) -> PlayerProfile {
    let mut mod_cat_prefs: HashMap<String, f64> = HashMap::new();
    for (_, cat) in installed_mod_categories {
        *mod_cat_prefs.entry(cat.clone()).or_insert(0.0) += 1.0;
    }
    for (_, cat) in collection_categories {
        *mod_cat_prefs.entry(cat.clone()).or_insert(0.0) += 0.5;
    }
    let max_cat = mod_cat_prefs.values().cloned().fold(0.0, f64::max);
    if max_cat > 0.0 {
        for v in mod_cat_prefs.values_mut() { *v /= max_cat; }
    }
    PlayerProfile {
        version_preferences: played_versions.clone(),
        loader_preferences: played_loaders.clone(),
        mod_category_preferences: mod_cat_prefs,
        total_playtime_minutes,
        installed_mod_count: installed_mod_categories.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_profiles_similarity_1() {
        let p1 = PlayerProfile {
            version_preferences: [("1.21".into(), 0.8)].into(),
            loader_preferences: [("fabric".into(), 1.0)].into(),
            mod_category_preferences: [("tech".into(), 0.9)].into(),
            total_playtime_minutes: 100.0, installed_mod_count: 10,
        };
        let sim = p1.cosine_similarity(&p1.clone());
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_completely_different_profiles() {
        let p1 = PlayerProfile {
            version_preferences: [("1.21".into(), 1.0)].into(),
            loader_preferences: HashMap::new(),
            mod_category_preferences: [("tech".into(), 1.0)].into(),
            total_playtime_minutes: 100.0, installed_mod_count: 10,
        };
        let p2 = PlayerProfile {
            version_preferences: [("1.8".into(), 1.0)].into(),
            loader_preferences: HashMap::new(),
            mod_category_preferences: [("magic".into(), 1.0)].into(),
            total_playtime_minutes: 50.0, installed_mod_count: 5,
        };
        assert!(p1.cosine_similarity(&p2) < 0.5);
    }
}
