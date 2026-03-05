use serde_json::Value;
use tauri::State;

use crate::mcp::client::McpClient;
use crate::mcp::types::{McpServerConfig, McpTool};
use crate::state::AppState;

#[tauri::command]
pub async fn connect_mcp_server(
    config: McpServerConfig,
    state: State<'_, AppState>,
) -> Result<Vec<McpTool>, String> {
    let mut client = McpClient::new(&config)?;
    client.initialize().await?;
    let tools = client.list_tools().await?;

    let mut clients = state.mcp_clients.lock().await;
    clients.insert(config.name, client);

    Ok(tools)
}

#[tauri::command]
pub async fn disconnect_mcp_server(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut clients = state.mcp_clients.lock().await;
    if let Some(mut client) = clients.remove(&name) {
        client.shutdown().await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_mcp_tools(
    name: String,
    state: State<'_, AppState>,
) -> Result<Vec<McpTool>, String> {
    let mut clients = state.mcp_clients.lock().await;
    let client = clients
        .get_mut(&name)
        .ok_or_else(|| format!("MCP server '{}' not connected", name))?;
    client.list_tools().await
}

#[tauri::command]
pub async fn call_mcp_tool(
    server_name: String,
    tool_name: String,
    arguments: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let mut clients = state.mcp_clients.lock().await;
    let client = clients
        .get_mut(&server_name)
        .ok_or_else(|| format!("MCP server '{}' not connected", server_name))?;
    client.call_tool(&tool_name, arguments).await
}
