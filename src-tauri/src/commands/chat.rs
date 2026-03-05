use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::llm::openai_compatible::{self, ToolCall};
use crate::llm::provider::ChatMessage;
use crate::state::AppState;
use crate::tools;
use crate::tools::ActivatedSkill;

#[derive(Clone, Serialize)]
struct ChunkPayload {
    content: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolCallPayload {
    id: String,
    name: String,
    arguments: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolResultPayload {
    tool_call_id: String,
    name: String,
    result: String,
}

const MAX_TOOL_ROUNDS: usize = 10;

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    activated_skills: Option<Vec<ActivatedSkill>>,
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

    let working_dir = settings.working_directory.clone();
    let skills = activated_skills.unwrap_or_default();
    let tool_defs = tools::get_tool_definitions(&skills);
    let mut conversation = messages;

    for _ in 0..MAX_TOOL_ROUNDS {
        let tool_calls = openai_compatible::stream_chat(
            &settings,
            &conversation,
            Some(&tool_defs),
            |content| {
                let _ = app.emit("chat:chunk", ChunkPayload { content });
            },
        )
        .await?;

        if tool_calls.is_empty() {
            break;
        }

        // Append assistant message with tool_calls
        conversation.push(build_assistant_tool_call_message(&tool_calls));

        // Execute each tool and append results
        for tc in &tool_calls {
            let _ = app.emit(
                "chat:tool_call",
                ToolCallPayload {
                    id: tc.id.clone(),
                    name: tc.function.name.clone(),
                    arguments: tc.function.arguments.clone(),
                },
            );

            let args: Value =
                serde_json::from_str(&tc.function.arguments).unwrap_or_default();
            let result = tools::executor::execute_tool(&app, &tc.function.name, args, &working_dir, &skills)
                .await
                .unwrap_or_else(|e| format!("Error: {e}"));

            let _ = app.emit(
                "chat:tool_result",
                ToolResultPayload {
                    tool_call_id: tc.id.clone(),
                    name: tc.function.name.clone(),
                    result: result.clone(),
                },
            );

            conversation.push(build_tool_result_message(&tc.id, &result));
        }
    }

    let _ = app.emit("chat:done", ());

    Ok(())
}

fn build_assistant_tool_call_message(tool_calls: &[ToolCall]) -> ChatMessage {
    let tc_json: Vec<Value> = tool_calls
        .iter()
        .map(|tc| {
            serde_json::json!({
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
            })
        })
        .collect();

    ChatMessage {
        role: "assistant".to_string(),
        content: Value::Null,
        tool_calls: Some(tc_json),
        tool_call_id: None,
    }
}

fn build_tool_result_message(tool_call_id: &str, result: &str) -> ChatMessage {
    ChatMessage {
        role: "tool".to_string(),
        content: Value::String(result.to_string()),
        tool_calls: None,
        tool_call_id: Some(tool_call_id.to_string()),
    }
}
