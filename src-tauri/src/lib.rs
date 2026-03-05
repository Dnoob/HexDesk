mod commands;
mod db;
mod llm;
mod mcp;
mod state;
mod tools;

use state::AppState;
use std::sync::Mutex;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create conversations and messages tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create scheduled_tasks table",
            sql: include_str!("../migrations/002_scheduled_tasks.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:hexdesk.db", migrations)
                .build(),
        )
        .manage(AppState {
            settings: Mutex::new(state::Settings::default()),
            pending_confirmations: Mutex::new(std::collections::HashMap::new()),
            mcp_clients: tokio::sync::Mutex::new(std::collections::HashMap::new()),
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
            commands::confirmation::respond_confirmation,
            commands::documents::generate_word,
            commands::documents::generate_excel,
            commands::documents::generate_pdf,
            commands::mcp::connect_mcp_server,
            commands::mcp::disconnect_mcp_server,
            commands::mcp::list_mcp_tools,
            commands::mcp::call_mcp_tool,
            commands::scheduler::parse_cron_next_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
