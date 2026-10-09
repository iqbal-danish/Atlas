use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock};
use crate::db::Database;
use crate::remote::credentials;
use crate::remote::ftp_provider::{FtpConfig, FtpStorageProvider};
use crate::remote::gdrive_provider::GoogleDriveProvider;
use crate::remote::mock_provider::MockStorageProvider;
use crate::remote::onedrive_provider::OneDriveProvider;
use crate::remote::provider::StorageProvider;
use crate::remote::sftp_provider::{SftpConfig, SftpStorageProvider};
use crate::remote::types::{
    ConnectionHistoryItem, ConnectionProfile, ProviderCapabilities, RemoteItem, StorageProviderType,
};

pub struct StorageManager {
    providers: Arc<RwLock<HashMap<String, Box<dyn StorageProvider>>>>,
}

impl StorageManager {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Lists all connection profiles, checking Windows Credential Manager for secret presence
    pub fn list_profiles(&self, db: &Database) -> Vec<ConnectionProfile> {
        let rows = db.get_remote_profiles().unwrap_or_default();
        let active = self.providers.read().unwrap();

        rows.into_iter()
            .map(|(id, name, ptype, host, port, user, root, timeout, last_conn, mut status, err, cfg)| {
                // If currently live in memory, report connected
                if active.contains_key(&id) {
                    status = "connected".to_string();
                }
                let has_secret = credentials::get_secret(&id).unwrap_or(None).is_some();
                let config_json = serde_json::from_str(&cfg).unwrap_or_else(|_| serde_json::json!({}));

                ConnectionProfile {
                    id,
                    name,
                    provider_type: StorageProviderType::from_str(&ptype),
                    host,
                    port,
                    username: user,
                    remote_root: root,
                    timeout_secs: timeout,
                    last_connected: last_conn,
                    status,
                    error_message: err,
                    has_secret,
                    config: config_json,
                }
            })
            .collect()
    }

    /// Saves a profile. Secrets are strictly stored in Windows Credential Manager!
    pub fn save_profile(
        &self,
        db: &Database,
        profile: ConnectionProfile,
        secret: Option<String>,
    ) -> Result<(), String> {
        if let Some(sec) = secret {
            if !sec.is_empty() {
                credentials::store_secret(&profile.id, &sec)?;
            }
        }

        let cfg_str = profile.config.to_string();
        db.save_remote_profile(
            &profile.id,
            &profile.name,
            profile.provider_type.as_str(),
            profile.host.as_deref(),
            profile.port,
            profile.username.as_deref(),
            profile.remote_root.as_deref(),
            profile.timeout_secs,
            profile.last_connected,
            &profile.status,
            profile.error_message.as_deref(),
            &cfg_str,
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Deletes profile and wipes secrets from Windows Credential Manager
    pub fn delete_profile(&self, db: &Database, profile_id: &str) -> Result<(), String> {
        let _ = credentials::delete_secret(profile_id);
        db.delete_remote_profile(profile_id).map_err(|e| e.to_string())?;
        self.providers.write().unwrap().remove(profile_id);
        Ok(())
    }

    fn create_adapter(&self, profile: &ConnectionProfile) -> Result<Box<dyn StorageProvider>, String> {
        let secret = credentials::get_secret(&profile.id)?;

        match profile.provider_type {
            StorageProviderType::Mock => {
                Ok(Box::new(MockStorageProvider::new(&profile.name)))
            }
            StorageProviderType::Sftp => {
                let host = profile.host.clone().unwrap_or_default();
                let port = profile.port.unwrap_or(22);
                let username = profile.username.clone().unwrap_or_default();
                let remote_root = profile.remote_root.clone().unwrap_or_else(|| "/".to_string());
                let auth_type = profile.config.get("auth_type").and_then(|v| v.as_str()).unwrap_or("password").to_string();
                let fingerprint = profile.config.get("known_host_fingerprint").and_then(|v| v.as_str()).map(|s| s.to_string());
                let trust_host = profile.config.get("trust_host_key").and_then(|v| v.as_bool()).unwrap_or(true);

                let config = SftpConfig {
                    host,
                    port,
                    username,
                    remote_root,
                    timeout_secs: profile.timeout_secs,
                    auth_type,
                    known_host_fingerprint: fingerprint,
                    trust_host_key: trust_host,
                };
                Ok(Box::new(SftpStorageProvider::new(config, secret)))
            }
            StorageProviderType::Ftp => {
                let host = profile.host.clone().unwrap_or_default();
                let port = profile.port.unwrap_or(21);
                let username = profile.username.clone().unwrap_or_default();
                let remote_root = profile.remote_root.clone().unwrap_or_else(|| "/".to_string());
                let passive_mode = profile.config.get("passive_mode").and_then(|v| v.as_bool()).unwrap_or(true);
                let use_ftps = profile.config.get("use_ftps").and_then(|v| v.as_bool()).unwrap_or(false);

                let config = FtpConfig {
                    host,
                    port,
                    username,
                    passive_mode,
                    use_ftps,
                    timeout_secs: profile.timeout_secs,
                    remote_root,
                };
                Ok(Box::new(FtpStorageProvider::new(config, secret)))
            }
            StorageProviderType::GoogleDrive => {
                let client_id = profile.config.get("client_id").and_then(|v| v.as_str()).unwrap_or("atlas-desktop-app");
                let access_token = profile.config.get("access_token").and_then(|v| v.as_str()).map(|s| s.to_string());
                let refresh_token = secret; // Refresh token held securely
                Ok(Box::new(GoogleDriveProvider::new(client_id, access_token, refresh_token)))
            }
            StorageProviderType::OneDrive => {
                let client_id = profile.config.get("client_id").and_then(|v| v.as_str()).unwrap_or("atlas-desktop-app");
                let access_token = profile.config.get("access_token").and_then(|v| v.as_str()).map(|s| s.to_string());
                let account_type = profile.config.get("account_type").and_then(|v| v.as_str()).unwrap_or("personal");
                let refresh_token = secret;
                Ok(Box::new(OneDriveProvider::new(client_id, access_token, refresh_token, account_type)))
            }
            StorageProviderType::Local => {
                Err("Local filesystem is handled directly by fs_service".to_string())
            }
        }
    }

    /// Tests connection and returns error or Ok(())
    pub fn test_profile(&self, db: &Database, profile_id: &str) -> Result<(), String> {
        let profiles = self.list_profiles(db);
        let profile = profiles.into_iter().find(|p| p.id == profile_id)
            .ok_or_else(|| format!("Profile not found: {}", profile_id))?;

        let adapter = self.create_adapter(&profile)?;
        adapter.test_connection()
    }

    /// Connects to profile, persists active adapter, records history
    pub fn connect_profile(&self, db: &Database, profile_id: &str) -> Result<ProviderCapabilities, String> {
        let profiles = self.list_profiles(db);
        let profile = profiles.into_iter().find(|p| p.id == profile_id)
            .ok_or_else(|| format!("Profile not found: {}", profile_id))?;

        let adapter = self.create_adapter(&profile)?;
        match adapter.test_connection() {
            Ok(_) => {
                let caps = adapter.get_capabilities();
                self.providers.write().unwrap().insert(profile_id.to_string(), adapter);
                let _ = db.record_connection_history(profile_id, "connected", None);
                Ok(caps)
            }
            Err(e) => {
                let _ = db.record_connection_history(profile_id, "error", Some(&e));
                Err(e)
            }
        }
    }

    pub fn disconnect_profile(&self, db: &Database, profile_id: &str) -> Result<(), String> {
        self.providers.write().unwrap().remove(profile_id);
        let _ = db.record_connection_history(profile_id, "disconnected", None);
        Ok(())
    }

    pub fn get_active_provider(&self, db: &Database, profile_id: &str) -> Result<(), String> {
        let mut active = self.providers.write().unwrap();
        if !active.contains_key(profile_id) {
            let profiles = self.list_profiles(db);
            let profile = profiles.into_iter().find(|p| p.id == profile_id)
                .ok_or_else(|| format!("Profile not found: {}", profile_id))?;
            let adapter = self.create_adapter(&profile)?;
            adapter.test_connection()?;
            active.insert(profile_id.to_string(), adapter);
        }
        Ok(())
    }

    pub fn list_directory(&self, db: &Database, profile_id: &str, path_or_id: &str) -> Result<Vec<RemoteItem>, String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.list_directory(path_or_id)
    }

    pub fn create_directory(&self, db: &Database, profile_id: &str, parent_id: &str, name: &str) -> Result<RemoteItem, String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.create_directory(parent_id, name)
    }

    pub fn rename_item(&self, db: &Database, profile_id: &str, item_id: &str, new_name: &str) -> Result<RemoteItem, String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.rename_item(item_id, new_name)
    }

    pub fn delete_item(&self, db: &Database, profile_id: &str, item_id: &str, permanent: bool) -> Result<(), String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.delete_item(item_id, permanent)
    }

    pub fn download_file(&self, db: &Database, profile_id: &str, item_id: &str, local_dest: &Path) -> Result<u64, String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.download_file(item_id, local_dest)
    }

    pub fn upload_file(
        &self,
        db: &Database,
        profile_id: &str,
        local_src: &Path,
        parent_id: &str,
        remote_name: &str,
    ) -> Result<RemoteItem, String> {
        self.get_active_provider(db, profile_id)?;
        let active = self.providers.read().unwrap();
        let adapter = active.get(profile_id).ok_or_else(|| "Provider inactive".to_string())?;
        adapter.upload_file(local_src, parent_id, remote_name)
    }

    pub fn get_connection_history(&self, db: &Database, profile_id: &str) -> Vec<ConnectionHistoryItem> {
        let rows = db.get_connection_history(profile_id, 20).unwrap_or_default();
        rows.into_iter()
            .map(|(id, prof_id, connected_at, status, err)| ConnectionHistoryItem {
                id,
                profile_id: prof_id,
                connected_at,
                status,
                error_message: err,
            })
            .collect()
    }
}
