use crate::state::{AppState, Settings};
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings(settings: Settings, state: State<'_, AppState>) -> Result<(), String> {
    let mut current = state
        .settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    *current = settings;
    Ok(())
}
