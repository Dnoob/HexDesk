use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;

use crate::mcp::client::McpClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub max_tokens: u32,
    pub temperature: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            provider: "minimax".to_string(),
            api_key: String::new(),
            model: "MiniMax-Text-01".to_string(),
            base_url: "https://api.minimax.chat/v1".to_string(),
            max_tokens: 4096,
            temperature: 0.7,
        }
    }
}

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub pending_confirmations: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub mcp_clients: tokio::sync::Mutex<HashMap<String, McpClient>>,
}
