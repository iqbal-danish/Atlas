use std::collections::HashMap;
use std::path::Path;
use std::sync::RwLock;
use crate::remote::provider::StorageProvider;
use crate::remote::types::{ProviderCapabilities, RemoteItem, StorageProviderType};

pub struct MockStorageProvider {
    pub name: String,
    pub is_connected: RwLock<bool>,
    pub should_fail: RwLock<bool>,
    pub items: RwLock<HashMap<String, Vec<RemoteItem>>>, // parent_id -> list of items
    pub file_payloads: RwLock<HashMap<String, Vec<u8>>>,  // item_id -> byte data
}

impl MockStorageProvider {
    pub fn new(name: &str) -> Self {
        let provider = Self {
            name: name.to_string(),
            is_connected: RwLock::new(true),
            should_fail: RwLock::new(false),
            items: RwLock::new(HashMap::new()),
            file_payloads: RwLock::new(HashMap::new()),
        };
        provider.seed_initial_tree();
        provider
    }

    fn seed_initial_tree(&self) {
        let root_items = vec![
            RemoteItem {
                id: "folder_docs".to_string(),
                name: "Documents".to_string(),
                path: "/Documents".to_string(),
                is_dir: true,
                size: 0,
                modified_time: Some(1730000000),
                mime_type: None,
                permissions: Some("drwxr-xr-x".to_string()),
                etag: Some("etag_docs".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
            RemoteItem {
                id: "folder_media".to_string(),
                name: "Media & Photos".to_string(),
                path: "/Media & Photos".to_string(),
                is_dir: true,
                size: 0,
                modified_time: Some(1730001000),
                mime_type: None,
                permissions: Some("drwxr-xr-x".to_string()),
                etag: Some("etag_media".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
            RemoteItem {
                id: "file_readme".to_string(),
                name: "README_remote.txt".to_string(),
                path: "/README_remote.txt".to_string(),
                is_dir: false,
                size: 1420,
                modified_time: Some(1730002000),
                mime_type: Some("text/plain".to_string()),
                permissions: Some("-rw-r--r--".to_string()),
                etag: Some("etag_readme".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
            RemoteItem {
                id: "file_workspace_doc".to_string(),
                name: "Q4 Strategy Proposal (Google Docs)".to_string(),
                path: "/Q4 Strategy Proposal (Google Docs)".to_string(),
                is_dir: false,
                size: 25400,
                modified_time: Some(1730003000),
                mime_type: Some("application/vnd.google-apps.document".to_string()),
                permissions: Some("-rw-r--r--".to_string()),
                etag: Some("etag_doc".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: true,
                export_types: vec![
                    "application/pdf".to_string(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
                ],
            },
            RemoteItem {
                id: "file_unicode".to_string(),
                name: "项目报告_2026🚀.pdf".to_string(),
                path: "/项目报告_2026🚀.pdf".to_string(),
                is_dir: false,
                size: 1048576,
                modified_time: Some(1730004000),
                mime_type: Some("application/pdf".to_string()),
                permissions: Some("-rw-r--r--".to_string()),
                etag: Some("etag_unicode".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
        ];

        let docs_subitems = vec![
            RemoteItem {
                id: "doc_budget".to_string(),
                name: "budget_2026.xlsx".to_string(),
                path: "/Documents/budget_2026.xlsx".to_string(),
                is_dir: false,
                size: 45056,
                modified_time: Some(1730005000),
                mime_type: Some("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string()),
                permissions: Some("-rw-r--r--".to_string()),
                etag: Some("etag_budget".to_string()),
                thumbnail_url: None,
                is_trashed: false,
                is_workspace_doc: false,
                export_types: vec![],
            },
        ];

        let mut items = self.items.write().unwrap();
        items.insert("/".to_string(), root_items.clone());
        items.insert("root".to_string(), root_items);
        items.insert("folder_docs".to_string(), docs_subitems);
        items.insert("folder_media".to_string(), vec![]);

        let mut payloads = self.file_payloads.write().unwrap();
        payloads.insert(
            "file_readme".to_string(),
            b"Welcome to Atlas Remote Storage Provider!\nThis item is served securely from remote adapter.\n".to_vec(),
        );
    }
}

impl StorageProvider for MockStorageProvider {
    fn provider_type(&self) -> StorageProviderType {
        StorageProviderType::Mock
    }

    fn get_capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            can_upload: true,
            can_download: true,
            can_create_dir: true,
            can_rename: true,
            can_delete: true,
            can_trash: true,
            can_export_docs: true,
            can_resume_transfer: true,
            supports_permissions: true,
            supports_thumbnails: false,
            is_encrypted: true,
        }
    }

    fn test_connection(&self) -> Result<(), String> {
        if *self.should_fail.read().unwrap() {
            return Err("Simulated network timeout connecting to remote host".to_string());
        }
        if !*self.is_connected.read().unwrap() {
            return Err("Remote host is unreachable (offline)".to_string());
        }
        Ok(())
    }

    fn list_directory(&self, path_or_id: &str) -> Result<Vec<RemoteItem>, String> {
        if *self.should_fail.read().unwrap() {
            return Err("Simulated error: Remote directory listing timed out".to_string());
        }
        let key = if path_or_id.is_empty() || path_or_id == "/" || path_or_id == "root" {
            "root"
        } else {
            path_or_id
        };

        let items = self.items.read().unwrap();
        match items.get(key) {
            Some(list) => Ok(list.clone()),
            None => Ok(vec![]),
        }
    }

    fn create_directory(&self, parent_id: &str, name: &str) -> Result<RemoteItem, String> {
        let key = if parent_id.is_empty() || parent_id == "/" {
            "root"
        } else {
            parent_id
        };
        let new_id = format!("dir_{}", uuid::Uuid::new_v4());
        let item = RemoteItem {
            id: new_id.clone(),
            name: name.to_string(),
            path: format!("{}/{}", key, name),
            is_dir: true,
            size: 0,
            modified_time: Some(chrono::Utc::now().timestamp()),
            mime_type: None,
            permissions: Some("drwxr-xr-x".to_string()),
            etag: Some(format!("etag_{}", new_id)),
            thumbnail_url: None,
            is_trashed: false,
            is_workspace_doc: false,
            export_types: vec![],
        };

        let mut items = self.items.write().unwrap();
        items.entry(key.to_string()).or_default().push(item.clone());
        items.insert(new_id, vec![]);
        Ok(item)
    }

    fn delete_item(&self, item_id: &str, _permanent: bool) -> Result<(), String> {
        let mut items = self.items.write().unwrap();
        for (_, list) in items.iter_mut() {
            list.retain(|it| it.id != item_id);
        }
        items.remove(item_id);
        Ok(())
    }

    fn rename_item(&self, item_id: &str, new_name: &str) -> Result<RemoteItem, String> {
        let mut items = self.items.write().unwrap();
        for (_, list) in items.iter_mut() {
            for it in list.iter_mut() {
                if it.id == item_id {
                    it.name = new_name.to_string();
                    return Ok(it.clone());
                }
            }
        }
        Err(format!("Item not found: {}", item_id))
    }

    fn download_file(&self, item_id: &str, local_dest: &Path) -> Result<u64, String> {
        let payloads = self.file_payloads.read().unwrap();
        let bytes = payloads
            .get(item_id)
            .cloned()
            .unwrap_or_else(|| format!("Simulated downloaded content for item {}\n", item_id).into_bytes());

        if let Some(parent) = local_dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(local_dest, &bytes).map_err(|e| e.to_string())?;
        Ok(bytes.len() as u64)
    }

    fn upload_file(
        &self,
        local_src: &Path,
        parent_id: &str,
        remote_name: &str,
    ) -> Result<RemoteItem, String> {
        let data = std::fs::read(local_src).map_err(|e| e.to_string())?;
        let size = data.len() as u64;
        let new_id = format!("file_{}", uuid::Uuid::new_v4());
        let key = if parent_id.is_empty() || parent_id == "/" {
            "root"
        } else {
            parent_id
        };

        let item = RemoteItem {
            id: new_id.clone(),
            name: remote_name.to_string(),
            path: format!("{}/{}", key, remote_name),
            is_dir: false,
            size,
            modified_time: Some(chrono::Utc::now().timestamp()),
            mime_type: Some("application/octet-stream".to_string()),
            permissions: Some("-rw-r--r--".to_string()),
            etag: Some(format!("etag_{}", new_id)),
            thumbnail_url: None,
            is_trashed: false,
            is_workspace_doc: false,
            export_types: vec![],
        };

        self.file_payloads.write().unwrap().insert(new_id, data);
        let mut items = self.items.write().unwrap();
        items.entry(key.to_string()).or_default().push(item.clone());
        Ok(item)
    }
}
