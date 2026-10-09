#[cfg(test)]
mod tests {
    use crate::fs_service;
    use crate::models::*;
    use crate::operations::{ConflictPolicy, OperationManager};
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    #[test]
    fn test_drives_listing() {
        let drives = fs_service::get_drives();
        assert!(!drives.is_empty(), "Should return at least one drive on Windows or fallback");
    }

    #[test]
    fn test_list_recycle_bin() {
        let items = fs_service::list_recycle_bin().expect("Should query recycle bin");
        // Must succeed without hanging or error
        assert!(items.len() >= 0);
    }

    #[test]
    fn test_directory_read_and_file_ops() {
        let temp_dir = std::env::temp_dir().join(format!("atlas_test_{}", std::process::id()));
        fs::create_dir_all(&temp_dir).expect("Failed to create temp dir");

        // Test create folder
        let created_folder = fs_service::create_folder(
            &temp_dir.to_string_lossy(),
            "Subfolder"
        ).expect("Failed to create folder");
        assert!(std::path::Path::new(&created_folder).exists());

        // Test create file
        let created_file = fs_service::create_file(
            &temp_dir.to_string_lossy(),
            "sample.txt"
        ).expect("Failed to create file");
        assert!(std::path::Path::new(&created_file).exists());

        // Test read directory
        let listing = fs_service::read_directory(&temp_dir.to_string_lossy(), true)
            .expect("Failed to read directory");
        assert_eq!(listing.entries.len(), 2);
        assert!(listing.entries[0].is_dir); // Directory listed first

        // Test rename
        let renamed = fs_service::rename_entry(&created_file, "renamed.txt")
            .expect("Failed to rename file");
        assert!(std::path::Path::new(&renamed).exists());
        assert!(!std::path::Path::new(&created_file).exists());

        // Test copy
        let dest_copy = temp_dir.join("Subfolder");
        let cancel = Arc::new(AtomicBool::new(false));
        OperationManager::copy_items(
            vec![renamed.clone()],
            dest_copy.to_string_lossy().to_string(),
            ConflictPolicy::Replace,
            cancel,
        ).expect("Failed to copy item");

        assert!(dest_copy.join("renamed.txt").exists());

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_dir_size_and_hash() {
        let temp_dir = std::env::temp_dir().join(format!("atlas_size_test_{}", std::process::id()));
        fs::create_dir_all(&temp_dir).expect("Failed to create temp dir");

        let test_file = temp_dir.join("test_hash.txt");
        fs::write(&test_file, "Atlas file manager test string").expect("Failed to write test file");

        // Test hash calculation
        let hash_res = fs_service::calculate_file_hash(&test_file.to_string_lossy(), "sha256")
            .expect("Failed to hash file");
        assert_eq!(hash_res.algorithm, "SHA-256");
        assert!(!hash_res.hash.is_empty());

        // Test directory size calculation
        let size_info = fs_service::calculate_directory_size(&temp_dir.to_string_lossy())
            .expect("Failed to calculate dir size");
        assert_eq!(size_info.file_count, 1);
        assert!(size_info.total_bytes > 0);

        // Test compare directories
        let temp_dir2 = std::env::temp_dir().join(format!("atlas_compare_test_{}", std::process::id()));
        fs::create_dir_all(&temp_dir2).expect("Failed to create temp dir 2");
        let cmp = fs_service::compare_directories(
            &temp_dir.to_string_lossy(),
            &temp_dir2.to_string_lossy()
        ).expect("Failed to compare dirs");
        assert_eq!(cmp.items.len(), 1);
        assert_eq!(cmp.items[0].status, "onlyInLeft");

        // Test batch rename
        let target_new = temp_dir.join("test_hash_renamed.txt");
        let pairs = vec![BatchRenamePair {
            old_path: test_file.to_string_lossy().to_string(),
            new_path: target_new.to_string_lossy().to_string(),
        }];
        let renamed = fs_service::batch_rename_entries(pairs).expect("Failed batch rename");
        assert_eq!(renamed.len(), 1);
        assert!(target_new.exists());

        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::remove_dir_all(&temp_dir2);
    }

    #[test]
    fn test_remote_credentials() {
        use crate::remote::credentials;

        let test_profile_id = format!("test_prof_{}", uuid::Uuid::new_v4());
        let test_secret = "super_secret_ssh_passphrase_or_token_1234!";

        // 1. Store secret
        credentials::store_secret(&test_profile_id, test_secret)
            .expect("Should store secret securely");

        // 2. Retrieve secret
        let fetched = credentials::get_secret(&test_profile_id)
            .expect("Should query secret store")
            .expect("Secret should exist");
        assert_eq!(fetched, test_secret);

        // 3. Delete secret
        credentials::delete_secret(&test_profile_id).expect("Should delete secret");
        let after_delete = credentials::get_secret(&test_profile_id).expect("Should query");
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_mock_storage_provider() {
        use crate::remote::provider::StorageProvider;
        use crate::remote::mock_provider::MockStorageProvider;

        let provider = MockStorageProvider::new("Unit Test Provider");
        assert_eq!(provider.provider_type(), crate::remote::types::StorageProviderType::Mock);

        // 1. Connection check
        assert!(provider.test_connection().is_ok());

        // 2. Directory listing & Unicode name verification
        let items = provider.list_directory("root").expect("Should list root items");
        assert!(!items.is_empty());
        let has_unicode = items.iter().any(|it| it.name.contains("项目报告") && it.name.contains("🚀"));
        assert!(has_unicode, "Mock provider must support Unicode filenames and emoji");

        let has_workspace_doc = items.iter().any(|it| it.is_workspace_doc && !it.export_types.is_empty());
        assert!(has_workspace_doc, "Mock provider must identify Google Workspace exportable documents");

        // 3. Create directory
        let new_dir = provider.create_directory("root", "Test_Remote_Folder")
            .expect("Should create directory");
        assert!(new_dir.is_dir);

        // 4. Download file
        let temp_download = std::env::temp_dir().join(format!("remote_dl_{}.txt", uuid::Uuid::new_v4()));
        let bytes_written = provider.download_file("file_readme", &temp_download)
            .expect("Should download remote file");
        assert!(bytes_written > 0);
        assert!(temp_download.exists());
        let _ = fs::remove_file(&temp_download);

        // 5. Upload file
        let temp_upload = std::env::temp_dir().join(format!("remote_ul_{}.txt", uuid::Uuid::new_v4()));
        fs::write(&temp_upload, b"Sample payload to upload to remote cloud").unwrap();
        let uploaded = provider.upload_file(&temp_upload, "root", "uploaded_sample.txt")
            .expect("Should upload file");
        assert_eq!(uploaded.name, "uploaded_sample.txt");
        assert_eq!(uploaded.size, 40);
        let _ = fs::remove_file(&temp_upload);

        // 6. Error handling simulation
        *provider.should_fail.write().unwrap() = true;
        assert!(provider.test_connection().is_err());
        assert!(provider.list_directory("root").is_err());
    }

    #[test]
    fn test_sftp_host_key_verification() {
        use crate::remote::sftp_provider::{SftpConfig, SftpStorageProvider};

        let config = SftpConfig {
            host: "sftp.example.com".to_string(),
            port: 22,
            username: "admin".to_string(),
            remote_root: "/home/admin".to_string(),
            timeout_secs: 30,
            auth_type: "password".to_string(),
            known_host_fingerprint: Some("SHA256:abc123trustedFingerprint".to_string()),
            trust_host_key: true,
        };

        let provider = SftpStorageProvider::new(config.clone(), Some("pwd".to_string()));

        // Matching fingerprint succeeds
        assert!(provider.verify_host_key("SHA256:abc123trustedFingerprint").is_ok());

        // Mismatched fingerprint MUST fail with MITM error
        let mismatch_err = provider.verify_host_key("SHA256:differentUntrustedKey");
        assert!(mismatch_err.is_err());
        assert!(mismatch_err.unwrap_err().contains("VERIFICATION FAILED"));
    }

    #[test]
    fn test_oauth_pkce_generation() {
        use crate::remote::oauth::{generate_pkce, init_oauth_flow};

        let (verifier, challenge) = generate_pkce();
        assert_eq!(verifier.len(), 64);
        assert!(!challenge.is_empty());
        assert_ne!(verifier, challenge);

        // Verify Google Drive & OneDrive auth URL construction
        let gdrive_init = init_oauth_flow("google_drive", "test_client_id_gdrive", 9090)
            .expect("Should init Google Drive OAuth");
        assert!(gdrive_init.auth_url.contains("accounts.google.com"));
        assert!(gdrive_init.auth_url.contains("code_challenge="));
        assert!(gdrive_init.redirect_uri.contains("127.0.0.1:9090"));

        let onedrive_init = init_oauth_flow("onedrive", "test_client_id_onedrive", 9091)
            .expect("Should init OneDrive OAuth");
        assert!(onedrive_init.auth_url.contains("login.microsoftonline.com"));
        assert!(onedrive_init.auth_url.contains("code_challenge="));
        assert!(onedrive_init.redirect_uri.contains("127.0.0.1:9091"));
    }

    #[test]
    fn test_storage_manager_lifecycle() {
        use crate::db::Database;
        use crate::remote::manager::StorageManager;
        use crate::remote::types::{ConnectionProfile, StorageProviderType};

        let db = Database::init().expect("Database init failed");
        let mgr = StorageManager::new();

        let prof_id = format!("prof_test_{}", uuid::Uuid::new_v4());
        let profile = ConnectionProfile {
            id: prof_id.clone(),
            name: "Mock Cloud Profile".to_string(),
            provider_type: StorageProviderType::Mock,
            host: None,
            port: None,
            username: None,
            remote_root: Some("/".to_string()),
            timeout_secs: 30,
            last_connected: None,
            status: "disconnected".to_string(),
            error_message: None,
            has_secret: false,
            config: serde_json::json!({}),
        };

        // 1. Save profile with secret
        mgr.save_profile(&db, profile, Some("super_mock_token".to_string()))
            .expect("Should save profile");

        // 2. Verify listed profiles include the profile and report secret exists
        let profiles = mgr.list_profiles(&db);
        let found = profiles.iter().find(|p| p.id == prof_id).expect("Should find profile");
        assert_eq!(found.name, "Mock Cloud Profile");
        assert!(found.has_secret);

        // 3. Connect to profile
        let caps = mgr.connect_profile(&db, &prof_id).expect("Should connect profile");
        assert!(caps.can_upload);
        assert!(caps.can_download);

        // 4. List remote directory via manager
        let items = mgr.list_directory(&db, &prof_id, "root").expect("Should list items");
        assert!(!items.is_empty());

        // 5. Check connection history logged in SQLite
        let history = mgr.get_connection_history(&db, &prof_id);
        assert!(!history.is_empty());
        assert_eq!(history[0].status, "connected");

        // 6. Disconnect profile
        mgr.disconnect_profile(&db, &prof_id).expect("Should disconnect");

        // 7. Delete profile
        mgr.delete_profile(&db, &prof_id).expect("Should delete profile");
        let after_delete = mgr.list_profiles(&db);
        assert!(!after_delete.iter().any(|p| p.id == prof_id));
    }
}
