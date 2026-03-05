use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[allow(async_fn_in_trait)]
pub trait LlmProvider {
    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;
}
