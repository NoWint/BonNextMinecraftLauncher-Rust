pub struct SignalingClient {
    server_url: String,
    connected: bool,
}

impl SignalingClient {
    pub fn new(server_url: &str) -> Self {
        Self {
            server_url: server_url.to_string(),
            connected: false,
        }
    }

    pub async fn connect(&mut self) -> Result<(), crate::error::LauncherError> {
        self.connected = true;
        Ok(())
    }

    pub async fn disconnect(&mut self) -> Result<(), crate::error::LauncherError> {
        self.connected = false;
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }
}
