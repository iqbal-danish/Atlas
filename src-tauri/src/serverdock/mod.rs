pub mod analysis;
pub mod commands;
pub mod database;
pub mod editor;
pub mod filesystem;
pub mod logger;
pub mod search;
pub mod security;
pub mod sftp;
pub mod transfers;
pub mod types;

use std::sync::Arc;
pub use commands::AppState as ServerDockAppState;
use database::Database;
use logger::Logger;
use sftp::SftpManager;
use tauri::Manager;
use transfers::TransferEngine;

pub fn init_serverdock_state(app_handle: &tauri::AppHandle) -> Arc<commands::AppState> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("serverdock_data"));

    let db = Database::new(app_data_dir).expect("Failed to initialize ServerDock SQLite database");
    let logger = Logger::new(app_handle.clone());
    let sftp = SftpManager::new();
    sftp.set_logger(logger.clone());
    let transfers = TransferEngine::new(app_handle.clone(), sftp.clone(), db.clone());

    Arc::new(commands::AppState {
        db,
        sftp,
        transfers,
        logger,
    })
}
