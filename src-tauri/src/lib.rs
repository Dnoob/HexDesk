mod commands;
mod db;
mod llm;
mod mcp;
mod sandbox;
mod state;
mod tools;

use sandbox::manager::SandboxManager;
use state::AppState;
use std::sync::Mutex;
use tauri::Manager;
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
        Migration {
            version: 3,
            description: "add is_compacted column to messages",
            sql: include_str!("../migrations/003_add_compaction.sql"),
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
            mcp_manager: tokio::sync::Mutex::new(mcp::McpManager::new()),
        })
        .manage(SandboxManager::new())
        .setup(|app| {
            // 后台启动沙盒（不阻塞 app 启动）
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let sandbox = handle.state::<SandboxManager>();
                if let Err(e) = sandbox.auto_start(&handle).await {
                    eprintln!("Sandbox auto-start failed: {}", e);
                }
            });
            Ok(())
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
            commands::mcp::replace_mcp_client,
            commands::scheduler::parse_cron_next_run,
            commands::sandbox::sandbox_get_state,
            commands::sandbox::sandbox_start,
            commands::sandbox::sandbox_stop,
            commands::sandbox::sandbox_restart,
            commands::sandbox::sandbox_exec,
            commands::sandbox::sandbox_mount_workspace,
            commands::sandbox::sandbox_clean_workspace,
            commands::sandbox::sandbox_set_enabled,
            commands::skills::fetch_skill_from_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
