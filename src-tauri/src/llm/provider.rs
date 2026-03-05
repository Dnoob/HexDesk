use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[allow(async_fn_in_trait)]
pub trait LlmProvider {
    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;
}
