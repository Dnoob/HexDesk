use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

use super::types::{JsonRpcRequest, JsonRpcResponse, McpServerConfig, McpTool};

pub struct McpClient {
    child: Child,
    stdin: Option<tokio::process::ChildStdin>,
    stdout: Option<BufReader<tokio::process::ChildStdout>>,
    next_id: AtomicU64,
}

impl McpClient {
    pub fn new(config: &McpServerConfig) -> Result<Self, String> {
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .envs(&config.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server '{}': {}", config.name, e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take().map(BufReader::new);

        Ok(Self {
            child,
            stdin,
            stdout,
            next_id: AtomicU64::new(1),
        })
    }

    async fn send_request(&mut self, method: &str, params: Option<Value>) -> Result<JsonRpcResponse, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let request_str = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        let stdin = self.stdin.as_mut().ok_or("MCP client stdin not available")?;
        stdin
            .write_all(format!("{}\n", request_str).as_bytes())
            .await
            .map_err(|e| format!("Failed to write to MCP server: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush MCP server stdin: {}", e))?;

        let stdout = self.stdout.as_mut().ok_or("MCP client stdout not available")?;
        let mut line = String::new();
        stdout
            .read_line(&mut line)
            .await
            .map_err(|e| format!("Failed to read from MCP server: {}", e))?;

        if line.is_empty() {
            return Err("MCP server closed connection".to_string());
        }

        let response: JsonRpcResponse = serde_json::from_str(&line)
            .map_err(|e| format!("Failed to parse MCP response: {} (raw: {})", e, line.trim()))?;

        if let Some(ref err) = response.error {
            return Err(format!("MCP error ({}): {}", err.code, err.message));
        }

        Ok(response)
    }

    pub async fn initialize(&mut self) -> Result<(), String> {
        let params = serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "HexDesk",
                "version": "0.1.0"
            }
        });

        self.send_request("initialize", Some(params)).await?;

        // Send initialized notification (no id, no response expected)
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let notification_str = serde_json::to_string(&notification)
            .map_err(|e| format!("Failed to serialize notification: {}", e))?;

        if let Some(stdin) = self.stdin.as_mut() {
            stdin
                .write_all(format!("{}\n", notification_str).as_bytes())
                .await
                .map_err(|e| format!("Failed to send initialized notification: {}", e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush: {}", e))?;
        }

        Ok(())
    }

    pub async fn list_tools(&mut self) -> Result<Vec<McpTool>, String> {
        let response = self.send_request("tools/list", None).await?;

        let result = response.result.ok_or("No result in tools/list response")?;
        let tools_value = result
            .get("tools")
            .ok_or("No 'tools' field in response")?
            .clone();

        let tools: Vec<McpTool> = serde_json::from_value(tools_value)
            .map_err(|e| format!("Failed to parse tools: {}", e))?;

        Ok(tools)
    }

    pub async fn call_tool(&mut self, name: &str, arguments: Value) -> Result<Value, String> {
        let params = serde_json::json!({
            "name": name,
            "arguments": arguments
        });

        let response = self.send_request("tools/call", Some(params)).await?;
        response.result.ok_or("No result in tool call response".to_string())
    }

    pub async fn shutdown(&mut self) -> Result<(), String> {
        // Drop stdin/stdout to close pipes
        self.stdin.take();
        self.stdout.take();

        // Try to kill the child process
        let _ = self.child.kill().await;

        Ok(())
    }
}
