use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::commands::{confirmation, files};
use crate::sandbox::manager::SandboxManager;
use crate::tools::ActivatedSkill;

pub async fn execute_tool(
    app: &AppHandle,
    tool_name: &str,
    arguments: Value,
    working_dir: &str,
    activated_skills: &[ActivatedSkill],
) -> Result<String, String> {
    match tool_name {
        "read_file" => {
            let path = resolve_path(get_str(&arguments, "path")?, working_dir);
            files::validate_within_working_dir(&path, working_dir)?;
            let content = files::read_file(path)?;
            Ok(content)
        }
        "write_file" => {
            let path = resolve_path(get_str(&arguments, "path")?, working_dir);
            let content = get_str(&arguments, "content")?;
            files::validate_within_working_dir(&path, working_dir)?;
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
            let path = resolve_path(get_str(&arguments, "path")?, working_dir);
            files::validate_within_working_dir(&path, working_dir)?;
            let entries = files::list_directory(path)?;
            serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())
        }
        "search_files" => {
            let dir = resolve_path(get_str(&arguments, "directory")?, working_dir);
            let pattern = get_str(&arguments, "pattern")?;
            files::validate_within_working_dir(&dir, working_dir)?;
            let results = files::search_files(dir, pattern)?;
            Ok(results.join("\n"))
        }
        "execute_shell" => {
            let command = get_str(&arguments, "command")?;

            // 确认机制保持不变
            let approved = confirmation::request_confirmation(
                app,
                "shell_execute",
                "执行命令",
                "AI 请求执行 Shell 命令（沙盒内）",
                Some(&command),
            )
            .await?;
            if !approved {
                return Ok("用户拒绝了命令执行".to_string());
            }

            // 通过沙盒执行（不再本地降级）
            let sandbox = app.state::<SandboxManager>();
            let result = sandbox.exec(&command, "/workspace", 30).await?;
            Ok(format!(
                "exit code: {}\nstdout:\n{}\nstderr:\n{}",
                result.exit_code, result.stdout, result.stderr
            ))
        }
        "activate_skill" => {
            let skill_name = get_str(&arguments, "skill_name")?;
            let skill = activated_skills
                .iter()
                .find(|s| s.name == skill_name)
                .ok_or_else(|| format!("未找到技能: {skill_name}"))?;
            Ok(format!(
                "已激活技能「{}」。请严格按照以下指令执行用户的请求：\n\n{}",
                skill.name, skill.instruction
            ))
        }
        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}

/// If the path is relative and a working directory is set, resolve it against the working directory
fn resolve_path(path: String, working_dir: &str) -> String {
    if working_dir.is_empty() {
        return path;
    }
    let p = std::path::Path::new(&path);
    if p.is_absolute() {
        path
    } else {
        std::path::Path::new(working_dir)
            .join(&path)
            .to_string_lossy()
            .to_string()
    }
}

fn get_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing argument: {key}"))
}
