use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::state::Settings;
use crate::tools::ToolDefinition;

use super::provider::ChatMessage;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    max_tokens: u32,
    temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
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
    tool_calls: Option<Vec<DeltaToolCall>>,
}

#[derive(Deserialize)]
struct DeltaToolCall {
    index: Option<usize>,
    id: Option<String>,
    function: Option<DeltaFunction>,
}

#[derive(Deserialize)]
struct DeltaFunction {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default, Debug)]
pub struct ToolCall {
    pub id: String,
    pub function: ToolCallFunction,
}

#[derive(Clone, Serialize, Deserialize, Default, Debug)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

/// Stream chat completion. Returns collected tool_calls if the model requested any,
/// or an empty Vec if the response completed normally with text only.
pub async fn stream_chat(
    settings: &Settings,
    messages: &[ChatMessage],
    tools: Option<&[ToolDefinition]>,
    mut on_chunk: impl FnMut(String),
) -> Result<Vec<ToolCall>, String> {
    let client = Client::new();

    let request = ChatRequest {
        model: settings.model.clone(),
        messages: messages.to_vec(),
        stream: true,
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
        tools: tools.map(|t| t.to_vec()),
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
    let mut tool_calls: Vec<ToolCall> = Vec::new();

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
                    return Ok(tool_calls);
                }

                match serde_json::from_str::<ChatChunk>(data) {
                    Ok(chunk) => {
                        if let Some(choice) = chunk.choices.first() {
                            // Handle text content
                            if let Some(ref content) = choice.delta.content {
                                if !content.is_empty() {
                                    on_chunk(content.clone());
                                }
                            }

                            // Handle tool_calls (incremental)
                            if let Some(ref delta_tcs) = choice.delta.tool_calls {
                                for dtc in delta_tcs {
                                    let idx = dtc.index.unwrap_or(0);

                                    // Grow the vec if needed
                                    while tool_calls.len() <= idx {
                                        tool_calls.push(ToolCall::default());
                                    }

                                    let tc = &mut tool_calls[idx];

                                    if let Some(ref id) = dtc.id {
                                        tc.id = id.clone();
                                    }

                                    if let Some(ref func) = dtc.function {
                                        if let Some(ref name) = func.name {
                                            tc.function.name = name.clone();
                                        }
                                        if let Some(ref args) = func.arguments {
                                            tc.function.arguments.push_str(args);
                                        }
                                    }
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

    Ok(tool_calls)
}
