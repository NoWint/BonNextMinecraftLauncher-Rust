use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone)]
struct MirrorHealth {
    success_count: u64,
    failure_count: u64,
    total_latency_ms: u64,
}

static MIRROR_HEALTH: OnceLock<Mutex<HashMap<String, MirrorHealth>>> = OnceLock::new();

fn mirror_health() -> &'static Mutex<HashMap<String, MirrorHealth>> {
    MIRROR_HEALTH.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn record_success(mirror: &str, latency_ms: u64) {
    let mut health = mirror_health().lock().unwrap();
    let entry = health.entry(mirror.to_string()).or_insert(MirrorHealth {
        success_count: 0,
        failure_count: 0,
        total_latency_ms: 0,
    });
    entry.success_count += 1;
    entry.total_latency_ms += latency_ms;
}

pub fn record_failure(mirror: &str) {
    let mut health = mirror_health().lock().unwrap();
    let entry = health.entry(mirror.to_string()).or_insert(MirrorHealth {
        success_count: 0,
        failure_count: 0,
        total_latency_ms: 0,
    });
    entry.failure_count += 1;
}

pub fn get_best_mirror(candidates: &[&str]) -> String {
    let health = mirror_health().lock().unwrap();

    let mut best = candidates[0].to_string();
    let mut best_score = f64::NEG_INFINITY;

    for &mirror in candidates {
        if let Some(h) = health.get(mirror) {
            let total = h.success_count + h.failure_count;
            if total == 0 {
                continue;
            }
            let success_rate = h.success_count as f64 / total as f64;
            let avg_latency = if h.success_count > 0 {
                h.total_latency_ms as f64 / h.success_count as f64
            } else {
                5000.0
            };
            let score = success_rate * 100.0 - avg_latency * 0.01;
            if score > best_score {
                best_score = score;
                best = mirror.to_string();
            }
        }
    }

    best
}

pub fn get_mirror_stats() -> Vec<(String, f64, u64)> {
    let health = mirror_health().lock().unwrap();
    let mut stats = Vec::new();
    for (mirror, h) in health.iter() {
        let total = h.success_count + h.failure_count;
        let success_rate = if total > 0 {
            h.success_count as f64 / total as f64
        } else {
            0.0
        };
        let avg_latency = if h.success_count > 0 {
            h.total_latency_ms / h.success_count
        } else {
            0
        };
        stats.push((mirror.clone(), success_rate, avg_latency));
    }
    stats
}
