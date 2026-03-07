use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;

use crate::mcp::McpManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub max_tokens: u32,
    pub temperature: f64,
    pub system_prompt: String,
    #[serde(default)]
    pub working_directory: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            provider: "minimax".to_string(),
            api_key: String::new(),
            model: "MiniMax-M2.5".to_string(),
            base_url: "https://api.minimaxi.com/v1".to_string(),
            max_tokens: 4096,
            temperature: 0.7,
            system_prompt: "你是 HexDesk AI 助手，一个强大的桌面级通用 AI 助手。你可以帮助用户进行文件操作、执行命令、生成文档等。请使用中文回复。".to_string(),
            working_directory: String::new(),
        }
    }
}

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub pending_confirmations: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub mcp_manager: tokio::sync::Mutex<McpManager>,
}
