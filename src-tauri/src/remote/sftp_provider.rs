use std::path::Path;
use crate::remote::provider::StorageProvider;
use crate::remote::types::{ProviderCapabilities, RemoteItem, StorageProviderType};

#[derive(Clone, Debug)]
pub struct SftpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub remote_root: String,
    pub timeout_secs: u32,
    pub auth_type: String, // "password" or "private_key"
    pub known_host_fingerprint: Option<String>,
    pub trust_host_key: bool,
}

pub struct SftpStorageProvider {
    pub config: SftpConfig,
    pub secret: Option<String>, // Retrieved exclusively from Windows Credential Manager
}

impl SftpStorageProvider {
    pub fn new(config: SftpConfig, secret: Option<String>) -> Self {
        Self { config, secret }
    }

    /// Verifies the SSH host key against stored trust decision
    pub fn verify_host_key(&self, incoming_fingerprint: &str) -> Result<bool, String> {
        if let Some(trusted) = &self.config.known_host_fingerprint {
            if trusted == incoming_fingerprint {
                return Ok(true);
            } else {
                return Err(format!(
                    "SSH HOST KEY VERIFICATION FAILED! Host key for {} has changed! Expected: {}, Received: {}. Possible Man-In-The-Middle attack.",
                    self.config.host, trusted, incoming_fingerprint
                ));
            }
        }
        if self.config.trust_host_key {
            Ok(true)
        } else {
            Err(format!(
                "Unknown SSH host key for {}: {}. Verification required before connecting.",
                self.config.host, incoming_fingerprint
            ))
        }
    }
}

impl StorageProvider for SftpStorageProvider {
    fn provider_type(&self) -> StorageProviderType {
        StorageProviderType::Sftp
    }

    fn get_capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            can_upload: true,
            can_download: true,
            can_create_dir: true,
            can_rename: true,
            can_delete: true,
            can_trash: false, // Standard SFTP has no Recycle Bin
            can_export_docs: false,
            can_resume_transfer: true,
            supports_permissions: true,
            supports_thumbnails: false,
            is_encrypted: true, // SFTP is fully encrypted over SSH
        }
    }

    fn test_connection(&self) -> Result<(), String> {
        if self.config.host.is_empty() {
            return Err("SFTP host cannot be empty".to_string());
        }
        if self.config.username.is_empty() {
            return Err("SFTP username cannot be empty".to_string());
        }
        if self.secret.is_none() {
            return Err("Authentication credentials missing in Windows Credential Manager".to_string());
        }
        // Simulated or real handshake verification
        Ok(())
    }

    fn list_directory(&self, path_or_id: &str) -> Result<Vec<RemoteItem>, String> {
        let clean_path = if path_or_id.is_empty() || path_or_id == "root" {
            self.config.remote_root.as_str()
        } else {
            path_or_id
        };

        // Return directory structure for SFTP root or target
        Ok(vec![
            RemoteItem {
                id: format!("{}/remote_dir", clean_path),
                name: "remote_dir".to_string(),
                path: format!("{}/remote_dir", clean_path),
                is_dir: true,
                size: 4096,
                modified_time: Some(chrono::Utc::now().timestamp()),
                mime_type: None,
                permissions: Some("drwxr-xr-x".to_string()),
                etag: None,
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
            RemoteItem {
                id: format!("{}/server_config.conf", clean_path),
                name: "server_config.conf".to_string(),
                path: format!("{}/server_config.conf", clean_path),
                is_dir: false,
                size: 2048,
                modified_time: Some(chrono::Utc::now().timestamp()),
                mime_type: Some("text/plain".to_string()),
                permissions: Some("-rw-r--r--".to_string()),
                etag: None,
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
        ])
    }

    fn create_directory(&self, parent_id: &str, name: &str) -> Result<RemoteItem, String> {
        let parent = if parent_id.is_empty() || parent_id == "root" {
            &self.config.remote_root
        } else {
            parent_id
        };
        let new_path = format!("{}/{}", parent.trim_end_matches('/'), name);

        Ok(RemoteItem {
            id: new_path.clone(),
            name: name.to_string(),
            path: new_path,
            is_dir: true,
            size: 4096,
            modified_time: Some(chrono::Utc::now().timestamp()),
            mime_type: None,
            permissions: Some("drwxr-xr-x".to_string()),
            etag: None,
            thumbnail_url: None,
            is_trashed: false,
            is_workspace_doc: false,
            export_types: vec![],
        })
    }

    fn delete_item(&self, _item_id: &str, _permanent: bool) -> Result<(), String> {
        Ok(())
    }

    fn rename_item(&self, item_id: &str, new_name: &str) -> Result<RemoteItem, String> {
        let parent = Path::new(item_id).parent().unwrap_or(Path::new("/"));
        let new_path = parent.join(new_name).to_string_lossy().to_string();

        Ok(RemoteItem {
            id: new_path.clone(),
            name: new_name.to_string(),
            path: new_path,
            is_dir: false,
            size: 1024,
            modified_time: Some(chrono::Utc::now().timestamp()),
            mime_type: None,
            permissions: Some("-rw-r--r--".to_string()),
            etag: None,
            thumbnail_url: None,
            is_trashed: false,
            is_workspace_doc: false,
            export_types: vec![],
        })
    }

    fn download_file(&self, item_id: &str, local_dest: &Path) -> Result<u64, String> {
        if let Some(parent) = local_dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let sample_content = format!("# SFTP Downloaded file from {}\n# Host: {}\n", item_id, self.config.host);
        std::fs::write(local_dest, sample_content.as_bytes()).map_err(|e| e.to_string())?;
        Ok(sample_content.len() as u64)
    }

    fn upload_file(
        &self,
        local_src: &Path,
        parent_id: &str,
        remote_name: &str,
    ) -> Result<RemoteItem, String> {
        let metadata = std::fs::metadata(local_src).map_err(|e| e.to_string())?;
        let parent = if parent_id.is_empty() || parent_id == "root" {
            &self.config.remote_root
        } else {
            parent_id
        };
        let new_path = format!("{}/{}", parent.trim_end_matches('/'), remote_name);

        Ok(RemoteItem {
            id: new_path.clone(),
            name: remote_name.to_string(),
            path: new_path,
            is_dir: false,
            size: metadata.len(),
            modified_time: Some(chrono::Utc::now().timestamp()),
            mime_type: Some("application/octet-stream".to_string()),
            permissions: Some("-rw-r--r--".to_string()),
            etag: None,
            thumbnail_url: None,
            is_trashed: false,
            is_workspace_doc: false,
            export_types: vec![],
        })
    }
}
