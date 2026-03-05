#[tauri::command]
pub async fn send_message(message: String) -> Result<String, String> {
    // TODO: implement streaming chat with LLM
    Ok(format!("Echo: {}", message))
}
