mod commands;
mod llm;
mod state;

use state::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            settings: Mutex::new(state::Settings::default()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::chat::send_message,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::list_directory,
            commands::files::search_files,
            commands::shell::execute_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
