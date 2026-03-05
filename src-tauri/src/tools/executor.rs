use serde_json::Value;
use tauri::AppHandle;

use crate::commands::{confirmation, files, shell};

pub async fn execute_tool(
    app: &AppHandle,
    tool_name: &str,
    arguments: Value,
) -> Result<String, String> {
    match tool_name {
        "read_file" => {
            let path = get_str(&arguments, "path")?;
            let content = files::read_file(path)?;
            Ok(content)
        }
        "write_file" => {
            let path = get_str(&arguments, "path")?;
            let content = get_str(&arguments, "content")?;
            let approved = confirmation::request_confirmation(
                app,
                "file_write",
                "写入文件",
                &format!("AI 请求写入文件: {}", path),
                Some(&format!("内容长度: {} 字符", content.len())),
            )
            .await?;
            if !approved {
                return Ok("用户拒绝了写入操作".to_string());
            }
            files::write_file(path, content)?;
            Ok("文件写入成功".to_string())
        }
        "list_directory" => {
            let path = get_str(&arguments, "path")?;
            let entries = files::list_directory(path)?;
            serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())
        }
        "search_files" => {
            let dir = get_str(&arguments, "directory")?;
            let pattern = get_str(&arguments, "pattern")?;
            let results = files::search_files(dir, pattern)?;
            Ok(results.join("\n"))
        }
        "execute_shell" => {
            let command = get_str(&arguments, "command")?;
            let cwd = arguments
                .get("cwd")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let approved = confirmation::request_confirmation(
                app,
                "shell_execute",
                "执行命令",
                "AI 请求执行 Shell 命令",
                Some(&command),
            )
            .await?;
            if !approved {
                return Ok("用户拒绝了命令执行".to_string());
            }
            let output = shell::execute_shell(command, cwd)?;
            Ok(format!(
                "exit code: {}\nstdout:\n{}\nstderr:\n{}",
                output.exit_code, output.stdout, output.stderr
            ))
        }
        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}

fn get_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing argument: {key}"))
}
