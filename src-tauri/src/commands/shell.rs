use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct ShellOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

const DANGEROUS_PATTERNS: &[&str] = &[
    "rm -rf /",
    "rm -rf /*",
    "mkfs",
    "dd if=",
    "format c:",
    ":(){ :|:& };:",
];

fn is_dangerous(command: &str) -> Option<&'static str> {
    let cmd = command.trim();
    for pattern in DANGEROUS_PATTERNS {
        if cmd.contains(pattern) {
            return Some(pattern);
        }
    }
    None
}

#[tauri::command]
pub fn execute_shell(command: String, cwd: Option<String>) -> Result<ShellOutput, String> {
    if let Some(pattern) = is_dangerous(&command) {
        return Err(format!("Dangerous command blocked: {}", pattern));
    }

    let mut cmd = Command::new("sh");
    cmd.arg("-c").arg(&command);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
