pub mod client;
pub mod types;

use std::collections::HashMap;

use client::McpClient;
use types::{McpServerConfig, McpTool};

pub struct McpManager {
    clients: HashMap<String, McpClient>,
    configs: HashMap<String, McpServerConfig>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
            configs: HashMap::new(),
        }
    }

    /// Connect a new MCP server
    pub async fn connect(
        &mut self,
        config: McpServerConfig,
    ) -> Result<Vec<McpTool>, String> {
        let name = config.name.clone();
        let mut client = McpClient::new(&config)?;
        client.initialize().await?;
        let tools = client.list_tools().await?;

        self.configs.insert(name.clone(), config);
        self.clients.insert(name, client);

        Ok(tools)
    }

    /// Disconnect and remove a server
    pub async fn disconnect(&mut self, name: &str) -> Result<(), String> {
        self.configs.remove(name);
        if let Some(mut client) = self.clients.remove(name) {
            client.shutdown().await?;
        }
        Ok(())
    }

    /// Ensure a client is connected, auto-reconnecting if dead
    pub async fn ensure_connected(&mut self, name: &str) -> Result<&mut McpClient, String> {
        let needs_reconnect = match self.clients.get_mut(name) {
            Some(client) => !client.is_alive(),
            None => true,
        };

        if needs_reconnect {
            let config = self
                .configs
                .get(name)
                .ok_or_else(|| format!("MCP server '{}' config not found", name))?
                .clone();

            // Clean up old connection
            if let Some(mut old) = self.clients.remove(name) {
                let _ = old.shutdown().await;
            }

            // Rebuild connection
            let mut client = McpClient::new(&config)?;
            client.initialize().await?;
            self.clients.insert(name.to_string(), client);
        }

        self.clients
            .get_mut(name)
            .ok_or_else(|| format!("MCP client '{}' not available", name))
    }

    /// Hot-replace: replace existing connection with new config
    pub async fn replace_client(
        &mut self,
        name: &str,
        new_config: McpServerConfig,
    ) -> Result<Vec<McpTool>, String> {
        let mut new_client = McpClient::new(&new_config)?;
        new_client.initialize().await?;
        let tools = new_client.list_tools().await?;

        if let Some(mut old) = self.clients.remove(name) {
            let _ = old.shutdown().await;
        }
        self.clients.insert(name.to_string(), new_client);
        self.configs.insert(name.to_string(), new_config);

        Ok(tools)
    }

    /// Get a connected client by name
    pub fn get_client_mut(&mut self, name: &str) -> Option<&mut McpClient> {
        self.clients.get_mut(name)
    }

    /// Check if a server is connected
    pub fn is_connected(&mut self, name: &str) -> bool {
        self.clients.get_mut(name).map(|c| c.is_alive()).unwrap_or(false)
    }

    /// Shutdown all clients
    pub async fn shutdown_all(&mut self) {
        for (_, mut client) in self.clients.drain() {
            let _ = client.shutdown().await;
        }
        self.configs.clear();
    }
}
