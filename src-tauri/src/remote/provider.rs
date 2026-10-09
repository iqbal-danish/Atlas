use std::path::Path;
use crate::remote::types::{ProviderCapabilities, RemoteItem, StorageProviderType};

/// Universal interface for all storage adapters (Local, SFTP, FTP, Google Drive, OneDrive, Mock)
pub trait StorageProvider: Send + Sync {
    fn provider_type(&self) -> StorageProviderType;
    fn get_capabilities(&self) -> ProviderCapabilities;

    /// Verifies server reachability, credential validity, and permissions
    fn test_connection(&self) -> Result<(), String>;

    /// Lists items in the specified directory or container
    fn list_directory(&self, path_or_id: &str) -> Result<Vec<RemoteItem>, String>;

    /// Creates a new subfolder/directory
    fn create_directory(&self, parent_id: &str, name: &str) -> Result<RemoteItem, String>;

    /// Deletes an item (trashed if permanent == false and provider supports it)
    fn delete_item(&self, item_id: &str, permanent: bool) -> Result<(), String>;

    /// Renames an item
    fn rename_item(&self, item_id: &str, new_name: &str) -> Result<RemoteItem, String>;

    /// Downloads a remote item directly to a local destination file
    fn download_file(&self, item_id: &str, local_dest: &Path) -> Result<u64, String>;

    /// Uploads a local file to the specified parent directory
    fn upload_file(
        &self,
        local_src: &Path,
        parent_id: &str,
        remote_name: &str,
    ) -> Result<RemoteItem, String>;
}
