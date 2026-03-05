use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::state::Settings;

use super::provider::ChatMessage;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    max_tokens: u32,
    temperature: f64,
}

#[derive(Deserialize)]
struct ChatChunk {
    choices: Vec<ChunkChoice>,
}

#[derive(Deserialize)]
struct ChunkChoice {
    delta: Delta,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}

pub async fn stream_chat(
    settings: &Settings,
    messages: Vec<ChatMessage>,
    mut on_chunk: impl FnMut(String),
) -> Result<(), String> {
    let client = Client::new();

    let request = ChatRequest {
        model: settings.model.clone(),
        messages,
        stream: true,
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
    };

    let response = client
        .post(format!("{}/chat/completions", settings.base_url))
        .header("Authorization", format!("Bearer {}", settings.api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let bytes = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();

                if data == "[DONE]" {
                    return Ok(());
                }

                match serde_json::from_str::<ChatChunk>(data) {
                    Ok(chunk) => {
                        if let Some(choice) = chunk.choices.first() {
                            if let Some(ref content) = choice.delta.content {
                                if !content.is_empty() {
                                    on_chunk(content.clone());
                                }
                            }
                        }
                    }
                    Err(_) => {
                        // Skip unparseable chunks (e.g. usage info)
                    }
                }
            }
        }
    }

    Ok(())
}
