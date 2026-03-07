use serde_json::Value;
use tauri::State;

use crate::mcp::types::{McpServerConfig, McpTool};
use crate::state::AppState;

#[tauri::command]
pub async fn connect_mcp_server(
    config: McpServerConfig,
    state: State<'_, AppState>,
) -> Result<Vec<McpTool>, String> {
    let mut manager = state.mcp_manager.lock().await;
    manager.connect(config).await
}

#[tauri::command]
pub async fn disconnect_mcp_server(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.mcp_manager.lock().await;
    manager.disconnect(&name).await
}

#[tauri::command]
pub async fn list_mcp_tools(
    name: String,
    state: State<'_, AppState>,
) -> Result<Vec<McpTool>, String> {
    let mut manager = state.mcp_manager.lock().await;
    let client = manager
        .ensure_connected(&name)
        .await?;
    client.list_tools().await
}

#[tauri::command]
pub async fn call_mcp_tool(
    server_name: String,
    tool_name: String,
    arguments: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let mut manager = state.mcp_manager.lock().await;
    let client = manager
        .ensure_connected(&server_name)
        .await?;
    client.call_tool(&tool_name, arguments).await
}

#[tauri::command]
pub async fn replace_mcp_client(
    name: String,
    config: McpServerConfig,
    state: State<'_, AppState>,
) -> Result<Vec<McpTool>, String> {
    let mut manager = state.mcp_manager.lock().await;
    manager.replace_client(&name, config).await
}
