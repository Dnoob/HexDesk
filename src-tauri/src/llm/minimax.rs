use super::provider::{ChatMessage, LlmProvider};

pub struct MiniMaxProvider {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

impl LlmProvider for MiniMaxProvider {
    async fn chat(
        &self,
        _messages: Vec<ChatMessage>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        todo!("Implement MiniMax API call")
    }
}
