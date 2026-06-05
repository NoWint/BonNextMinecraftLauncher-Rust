use crate::error::LauncherError;

pub async fn resolve_srv(domain: &str) -> Result<Option<(String, u16)>, LauncherError> {
    let srv_name = format!("_minecraft._tcp.{}", domain);
    let resolver = hickory_resolver::TokioAsyncResolver::tokio_from_system_conf()
        .map_err(|e| LauncherError::ServerPing(format!("Failed to create DNS resolver: {}", e)))?;
    let lookup = resolver.srv_lookup(&srv_name).await;
    match lookup {
        Ok(records) => {
            let record = records.iter().min_by_key(|r| r.priority());
            match record {
                Some(r) => Ok(Some((r.target().to_string().trim_end_matches('.').to_string(), r.port()))),
                None => Ok(None),
            }
        }
        Err(_) => Ok(None),
    }
}
