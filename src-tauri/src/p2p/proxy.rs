pub struct MinecraftProxy {
    pub local_port: u16,
}

impl MinecraftProxy {
    pub async fn start(port: u16) -> Result<Self, crate::error::LauncherError> {
        Ok(Self { local_port: port })
    }

    pub async fn stop(&self) -> Result<(), crate::error::LauncherError> {
        Ok(())
    }

    pub async fn broadcast_lan(&self, motd: &str) -> Result<(), crate::error::LauncherError> {
        let _ = motd;
        Ok(())
    }
}
