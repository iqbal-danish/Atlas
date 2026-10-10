use crate::models::{
    ArchiveEntryInfo, BatchRenamePair, CompareResult, DirSizeInfo, DirectoryListing, DriveInfo,
    FilePreview, FsEntry, HashResult, SearchResult,
};
use crate::operations::ConflictPolicy;
use crate::{fs_service, operations, preview_service, search_service, AppState};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_drives() -> Vec<DriveInfo> {
    fs_service::get_drives()
}

#[tauri::command]
pub fn read_directory(path: String, show_hidden: Option<bool>) -> Result<DirectoryListing, String> {
    fs_service::read_directory(&path, show_hidden.unwrap_or(false))
}

#[tauri::command]
pub fn get_entry_metadata(path: String) -> Result<FsEntry, String> {
    fs_service::get_metadata(&path)
}

#[tauri::command]
pub fn create_folder(parent_path: String, folder_name: String) -> Result<String, String> {
    fs_service::create_folder(&parent_path, &folder_name)
}

#[tauri::command]
pub fn create_file(parent_path: String, file_name: String) -> Result<String, String> {
    fs_service::create_file(&parent_path, &file_name)
}

#[tauri::command]
pub fn rename_entry(old_path: String, new_name: String) -> Result<String, String> {
    fs_service::rename_entry(&old_path, &new_name)
}

#[tauri::command]
pub fn delete_entries(paths: Vec<String>, permanent: Option<bool>) -> Result<Vec<String>, String> {
    if permanent.unwrap_or(false) {
        fs_service::delete_permanently(paths)
    } else {
        fs_service::delete_to_trash(paths)
    }
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    fs_service::open_path_with_default_app(&path)
}

#[tauri::command]
pub fn open_with_app(app_name: String, path: String) -> Result<(), String> {
    fs_service::open_with_app(&app_name, &path)
}

#[tauri::command]
pub fn get_remote_cache_path(remote_path: String, file_name: String) -> Result<String, String> {
    fs_service::get_remote_cache_path(&remote_path, &file_name)
}

#[tauri::command]
pub fn check_cached_remote_file(cached_path: String, expected_size: u64) -> Result<bool, String> {
    fs_service::check_cached_remote_file(&cached_path, expected_size)
}

#[tauri::command]
pub fn clean_remote_cache() -> Result<(), String> {
    fs_service::clean_remote_cache()
}

#[tauri::command]
pub fn get_file_preview(path: String, max_bytes: Option<usize>) -> Result<FilePreview, String> {
    preview_service::generate_preview(&path, max_bytes.unwrap_or(256 * 1024))
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub fn copy_entries(
    sources: Vec<String>,
    destination: String,
    policy: Option<String>,
) -> Result<(), String> {
    let conflict_policy = match policy.as_deref() {
        Some("skip") => ConflictPolicy::Skip,
        Some("rename") => ConflictPolicy::Rename,
        _ => ConflictPolicy::Replace,
    };
    let cancel = Arc::new(AtomicBool::new(false));
    operations::OperationManager::copy_items(sources, destination, conflict_policy, cancel)
}

#[tauri::command]
pub fn move_entries(
    sources: Vec<String>,
    destination: String,
    policy: Option<String>,
) -> Result<(), String> {
    let conflict_policy = match policy.as_deref() {
        Some("skip") => ConflictPolicy::Skip,
        Some("rename") => ConflictPolicy::Rename,
        _ => ConflictPolicy::Replace,
    };
    let cancel = Arc::new(AtomicBool::new(false));
    operations::OperationManager::move_items(sources, destination, conflict_policy, cancel)
}

#[tauri::command]
pub fn search_files(path: String, query: String, max_results: Option<usize>) -> Vec<SearchResult> {
    let cancel = Arc::new(AtomicBool::new(false));
    search_service::search_directory(&path, &query, max_results.unwrap_or(100), cancel)
}

#[tauri::command]
pub fn save_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            db.set_setting(&key, &value).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn load_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return db.get_setting(&key).map_err(|e| e.to_string());
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn record_recent(state: State<AppState>, path: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            db.add_recent(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_recent_locations(state: State<AppState>) -> Result<Vec<String>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return db.get_recents(10).map_err(|e| e.to_string());
        }
    }
    Ok(Vec::new())
}

#[tauri::command]
pub fn show_in_explorer(path: String) -> Result<(), String> {
    fs_service::show_in_explorer(&path)
}

#[tauri::command]
pub fn open_recycle_bin() -> Result<(), String> {
    fs_service::open_recycle_bin()
}

#[tauri::command]
pub fn launch_terminal(path: String, shell: Option<String>) -> Result<(), String> {
    fs_service::launch_terminal(&path, shell.as_deref())
}

#[tauri::command]
pub fn calculate_directory_size(path: String) -> Result<DirSizeInfo, String> {
    fs_service::calculate_directory_size(&path)
}

#[tauri::command]
pub fn calculate_file_hash(path: String, algorithm: Option<String>) -> Result<HashResult, String> {
    fs_service::calculate_file_hash(&path, algorithm.as_deref().unwrap_or("sha256"))
}

#[tauri::command]
pub fn list_archive(path: String) -> Result<Vec<ArchiveEntryInfo>, String> {
    fs_service::list_archive(&path)
}

#[tauri::command]
pub fn extract_archive(path: String, destination: String) -> Result<usize, String> {
    fs_service::extract_archive(&path, &destination)
}

#[tauri::command]
pub fn create_zip_archive(sources: Vec<String>, destination: String) -> Result<String, String> {
    fs_service::create_zip_archive(sources, &destination)
}

#[tauri::command]
pub fn compare_directories(dir_a: String, dir_b: String) -> Result<CompareResult, String> {
    fs_service::compare_directories(&dir_a, &dir_b)
}

#[tauri::command]
pub fn batch_rename(pairs: Vec<BatchRenamePair>) -> Result<Vec<String>, String> {
    fs_service::batch_rename_entries(pairs)
}

// ==========================================
// Section 27: Remote Storage & Cloud Integration Commands
// ==========================================

use crate::remote::{
    ConnectionHistoryItem, ConnectionProfile, OAuthInitResult, ProviderCapabilities, RemoteItem,
};

#[tauri::command]
pub fn list_remote_profiles(state: State<AppState>) -> Result<Vec<ConnectionProfile>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return Ok(state.remote_manager.list_profiles(db));
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn save_remote_profile(
    state: State<AppState>,
    profile: ConnectionProfile,
    secret: Option<String>,
) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.save_profile(db, profile, secret);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn delete_remote_profile(state: State<AppState>, profile_id: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.delete_profile(db, &profile_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn test_remote_connection(state: State<AppState>, profile_id: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.test_profile(db, &profile_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn connect_remote_profile(
    state: State<AppState>,
    profile_id: String,
) -> Result<ProviderCapabilities, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.connect_profile(db, &profile_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn disconnect_remote_profile(state: State<AppState>, profile_id: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.disconnect_profile(db, &profile_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn atlas_legacy_list_remote_directory(
    state: State<AppState>,
    profile_id: String,
    path_or_id: String,
) -> Result<Vec<RemoteItem>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.list_directory(db, &profile_id, &path_or_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn atlas_legacy_create_remote_directory(
    state: State<AppState>,
    profile_id: String,
    parent_id: String,
    name: String,
) -> Result<RemoteItem, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.create_directory(db, &profile_id, &parent_id, &name);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn rename_remote_item(
    state: State<AppState>,
    profile_id: String,
    item_id: String,
    new_name: String,
) -> Result<RemoteItem, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.rename_item(db, &profile_id, &item_id, &new_name);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn delete_remote_item(
    state: State<AppState>,
    profile_id: String,
    item_id: String,
    permanent: Option<bool>,
) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return state.remote_manager.delete_item(
                db,
                &profile_id,
                &item_id,
                permanent.unwrap_or(false),
            );
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn download_remote_file(
    state: State<AppState>,
    profile_id: String,
    item_id: String,
    local_path: String,
) -> Result<u64, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            let path = std::path::PathBuf::from(local_path);
            return state.remote_manager.download_file(db, &profile_id, &item_id, &path);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn upload_remote_file(
    state: State<AppState>,
    profile_id: String,
    local_path: String,
    parent_id: String,
    remote_name: String,
) -> Result<RemoteItem, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            let path = std::path::PathBuf::from(local_path);
            return state.remote_manager.upload_file(
                db,
                &profile_id,
                &path,
                &parent_id,
                &remote_name,
            );
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn get_remote_connection_history(
    state: State<AppState>,
    profile_id: String,
) -> Result<Vec<ConnectionHistoryItem>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return Ok(state.remote_manager.get_connection_history(db, &profile_id));
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn init_remote_oauth(
    provider_type: String,
    client_id: String,
    port: Option<u16>,
) -> Result<OAuthInitResult, String> {
    crate::remote::oauth::init_oauth_flow(&provider_type, &client_id, port.unwrap_or(8080))
}

#[tauri::command]
pub fn list_recycle_bin() -> Result<Vec<crate::models::RecycleBinEntry>, String> {
    fs_service::list_recycle_bin()
}

#[tauri::command]
pub fn restore_recycle_bin_item(path: String) -> Result<(), String> {
    fs_service::restore_recycle_bin_item(&path)
}

#[tauri::command]
pub fn restore_all_recycle_bin() -> Result<(), String> {
    fs_service::restore_all_recycle_bin()
}

#[tauri::command]
pub fn empty_recycle_bin() -> Result<(), String> {
    fs_service::empty_recycle_bin()
}

#[tauri::command]
pub fn delete_recycle_bin_item(path: String) -> Result<(), String> {
    fs_service::delete_recycle_bin_item(&path)
}

#[tauri::command]
pub fn import_serverdock_profiles(state: State<AppState>) -> Result<Vec<ConnectionProfile>, String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            let _ = db.import_from_serverdock()?;
            return Ok(state.remote_manager.list_profiles(db));
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn forget_profile_password(state: State<AppState>, profile_id: String) -> Result<(), String> {
    if let Ok(guard) = state.db.lock() {
        if let Some(db) = &*guard {
            return db.forget_profile_password(&profile_id);
        }
    }
    Err("Database unavailable".to_string())
}

#[tauri::command]
pub fn get_system_folders() -> crate::models::SystemFolders {
    fs_service::get_system_folders()
}



