pub mod executor;

use serde::Serialize;
use serde_json::{json, Value};

#[derive(Clone, Serialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDef,
}

#[derive(Clone, Serialize)]
pub struct FunctionDef {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

pub fn get_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        tool("read_file", "读取文件内容", json!({
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件的绝对路径"}
            },
            "required": ["path"]
        })),
        tool("write_file", "写入文件内容（创建或覆盖）", json!({
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "content": {"type": "string", "description": "要写入的内容"}
            },
            "required": ["path", "content"]
        })),
        tool("list_directory", "列出目录内容", json!({
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目录路径"}
            },
            "required": ["path"]
        })),
        tool("search_files", "按名称模式搜索文件", json!({
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "搜索目录"},
                "pattern": {"type": "string", "description": "文件名关键词"}
            },
            "required": ["directory", "pattern"]
        })),
        tool("execute_shell", "执行 Shell 命令", json!({
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的命令"},
                "cwd": {"type": "string", "description": "工作目录（可选）"}
            },
            "required": ["command"]
        })),
    ]
}

fn tool(name: &str, desc: &str, params: Value) -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: name.to_string(),
            description: desc.to_string(),
            parameters: params,
        },
    }
}
