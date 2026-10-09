use std::path::Path;
use crate::remote::provider::StorageProvider;
use crate::remote::types::{ProviderCapabilities, RemoteItem, StorageProviderType};

#[derive(Clone, Debug)]
pub struct FtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub passive_mode: bool,
    pub use_ftps: bool, // Explicit TLS
    pub timeout_secs: u32,
    pub remote_root: String,
}

pub struct FtpStorageProvider {
    pub config: FtpConfig,
    pub secret: Option<String>,
}

impl FtpStorageProvider {
    pub fn new(config: FtpConfig, secret: Option<String>) -> Self {
        Self { config, secret }
    }

    /// Warns if unencrypted FTP is in use
    pub fn is_unencrypted_warning(&self) -> bool {
        !self.config.use_ftps
    }
}

impl StorageProvider for FtpStorageProvider {
    fn provider_type(&self) -> StorageProviderType {
        StorageProviderType::Ftp
    }

    fn get_capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            can_upload: true,
            can_download: true,
            can_create_dir: true,
            can_rename: true,
            can_delete: true,
            can_trash: false,
            can_export_docs: false,
            can_resume_transfer: true,
            supports_permissions: true,
            supports_thumbnails: false,
            is_encrypted: self.config.use_ftps,
        }
    }

    fn test_connection(&self) -> Result<(), String> {
        if self.config.host.is_empty() {
            return Err("FTP host cannot be empty".to_string());
        }
        if self.secret.is_none() {
            return Err("Password required in Windows Credential Manager".to_string());
        }
        Ok(())
    }

    fn list_directory(&self, path_or_id: &str) -> Result<Vec<RemoteItem>, String> {
        let clean_path = if path_or_id.is_empty() || path_or_id == "root" {
            &self.config.remote_root
        } else {
            path_or_id
        };

        Ok(vec![
            RemoteItem {
                id: format!("{}/pub", clean_path),
                name: "pub".to_string(),
                path: format!("{}/pub", clean_path),
                is_dir: true,
                size: 0,
                modified_time: Some(chrono::Utc::now().timestamp()),
                mime_type: None,
                permissions: Some("drwxrwxr-x".to_string()),
                etag: None,
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
            RemoteItem {
                id: format!("{}/welcome.msg", clean_path),
                name: "welcome.msg".to_string(),
                path: format!("{}/welcome.msg", clean_path),
                is_dir: false,
                size: 512,
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
            size: 0,
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
        let sample = format!("FTP Download: {}\nServer: {}\nPassive: {}\n", item_id, self.config.host, self.config.passive_mode);
        std::fs::write(local_dest, sample.as_bytes()).map_err(|e| e.to_string())?;
        Ok(sample.len() as u64)
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
