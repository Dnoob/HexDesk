use tauri::{AppHandle, State};

use crate::sandbox::manager::SandboxManager;
use crate::sandbox::{ExecResult, SandboxState};

#[tauri::command]
pub async fn sandbox_get_state(
    sandbox: State<'_, SandboxManager>,
) -> Result<SandboxState, String> {
    Ok(sandbox.state().await)
}

#[tauri::command]
pub async fn sandbox_start(
    app: AppHandle,
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.auto_start(&app).await
}

#[tauri::command]
pub async fn sandbox_stop(
    app: AppHandle,
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.stop(&app).await
}

#[tauri::command]
pub async fn sandbox_restart(
    app: AppHandle,
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.restart(&app).await
}

#[tauri::command]
pub async fn sandbox_exec(
    command: String,
    cwd: String,
    sandbox: State<'_, SandboxManager>,
) -> Result<ExecResult, String> {
    let cwd = if cwd.is_empty() {
        "/workspace".to_string()
    } else {
        cwd
    };
    sandbox.exec(&command, &cwd, 30).await
}

#[tauri::command]
pub async fn sandbox_mount_workspace(
    path: String,
    app: AppHandle,
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.mount_workspace(&path, &app).await
}

#[tauri::command]
pub async fn sandbox_clean_workspace(
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.clean_workspace().await
}

#[tauri::command]
pub async fn sandbox_set_enabled(
    enabled: bool,
    app: AppHandle,
    sandbox: State<'_, SandboxManager>,
) -> Result<(), String> {
    sandbox.set_enabled(enabled, &app).await
}
