use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::llm::minimax;
use crate::llm::provider::ChatMessage;
use crate::state::AppState;

#[derive(Clone, Serialize)]
struct ChunkPayload {
    content: String,
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state
        .settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?
        .clone();

    if settings.api_key.is_empty() {
        return Err("API Key is not configured. Please set it in Settings.".to_string());
    }

    minimax::stream_chat(&settings, messages, |content| {
        let _ = app.emit("chat:chunk", ChunkPayload { content });
    })
    .await?;

    let _ = app.emit("chat:done", ());

    Ok(())
}
