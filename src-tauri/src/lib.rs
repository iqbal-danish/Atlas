pub mod commands;
pub mod db;
pub mod fs_service;
pub mod models;
pub mod operations;
pub mod preview_service;
pub mod remote;
pub mod search_service;
pub mod serverdock;

#[cfg(test)]
mod tests;

use db::Database;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Option<Database>>,
    pub remote_manager: remote::StorageManager,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::init().ok();
    let remote_manager = remote::StorageManager::new();

    tauri::Builder::default()
        .setup(|app| {
            let _ = fs_service::clean_remote_cache();
            let serverdock_state = serverdock::init_serverdock_state(app.handle());
            app.manage(serverdock_state);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let _ = fs_service::clean_remote_cache();
            }
        })
        .manage(AppState {
            db: Mutex::new(db),
            remote_manager,
        })
        .invoke_handler(tauri::generate_handler![
            // Core Atlas File Manager Commands
            commands::get_drives,
            commands::read_directory,
            commands::get_entry_metadata,
            commands::create_folder,
            commands::create_file,
            commands::rename_entry,
            commands::delete_entries,
            commands::open_file,
            commands::open_with_app,
            commands::get_remote_cache_path,
            commands::check_cached_remote_file,
            commands::clean_remote_cache,
            commands::get_file_preview,
            commands::read_file_base64,
            commands::copy_entries,
            commands::move_entries,
            commands::search_files,
            commands::save_setting,
            commands::load_setting,
            commands::record_recent,
            commands::get_recent_locations,
            commands::show_in_explorer,
            commands::open_recycle_bin,
            commands::launch_terminal,
            commands::calculate_directory_size,
            commands::calculate_file_hash,
            commands::list_archive,
            commands::extract_archive,
            commands::create_zip_archive,
            commands::compare_directories,
            commands::batch_rename,
            // Remote Storage & Recycle Bin Commands
            commands::list_remote_profiles,
            commands::save_remote_profile,
            commands::delete_remote_profile,
            commands::test_remote_connection,
            commands::connect_remote_profile,
            commands::disconnect_remote_profile,
            commands::atlas_legacy_list_remote_directory,
            commands::atlas_legacy_create_remote_directory,
            commands::rename_remote_item,
            commands::delete_remote_item,
            commands::download_remote_file,
            commands::upload_remote_file,
            commands::get_remote_connection_history,
            commands::init_remote_oauth,
            commands::list_recycle_bin,
            commands::restore_recycle_bin_item,
            commands::restore_all_recycle_bin,
            commands::empty_recycle_bin,
            commands::delete_recycle_bin_item,
            commands::import_serverdock_profiles,
            commands::forget_profile_password,
            commands::get_system_folders,

            // Full ServerDock Native Commands
            serverdock::commands::list_profiles,
            serverdock::commands::save_profile,
            serverdock::commands::delete_profile,
            serverdock::commands::delete_saved_password,
            serverdock::commands::clear_all_saved_passwords,
            serverdock::commands::test_sftp_connection,
            serverdock::commands::connect_sftp,
            serverdock::commands::disconnect_sftp,
            serverdock::commands::switch_sftp_session,
            serverdock::commands::get_active_sessions,
            serverdock::commands::get_connection_status,
            serverdock::commands::get_connection_logs,
            serverdock::commands::clear_connection_logs,
            serverdock::commands::get_default_local_directory,
            serverdock::commands::list_local_directory,
            serverdock::commands::list_remote_directory,
            serverdock::commands::create_local_directory,
            serverdock::commands::create_remote_directory,
            serverdock::commands::delete_local_file,
            serverdock::commands::delete_remote_file,
            serverdock::commands::rename_local_file,
            serverdock::commands::rename_remote_file,
            serverdock::commands::calculate_local_checksum,
            serverdock::commands::queue_transfer,
            serverdock::commands::get_transfers,
            serverdock::commands::pause_transfer,
            serverdock::commands::resume_transfer,
            serverdock::commands::cancel_transfer,
            serverdock::commands::retry_transfer,
            serverdock::commands::clear_completed_transfers,
            serverdock::commands::set_transfer_concurrency,
            serverdock::commands::get_transfer_concurrency,
            serverdock::commands::get_transfer_history,
            serverdock::commands::read_file_lines,
            serverdock::commands::read_file_chunk,
            serverdock::commands::read_remote_chunk,
            serverdock::commands::get_remote_file_preview,
            serverdock::commands::save_local_file,
            serverdock::commands::format_xml,
            serverdock::commands::validate_xml,
            serverdock::commands::format_json,
            serverdock::commands::validate_json,
            serverdock::commands::compare_files,
            serverdock::commands::search_file,
            serverdock::commands::analyze_xml_file,
            serverdock::commands::get_xml_tag_values,
            serverdock::commands::analyze_json_file,
            serverdock::commands::analyze_job_feed,
            serverdock::commands::run_performance_benchmark,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Atlas application");
}
