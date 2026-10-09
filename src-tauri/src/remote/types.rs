use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageProviderType {
    Local,
    Sftp,
    Ftp,
    GoogleDrive,
    OneDrive,
    Mock,
}

impl Default for StorageProviderType {
    fn default() -> Self {
        Self::Local
    }
}

impl StorageProviderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Sftp => "sftp",
            Self::Ftp => "ftp",
            Self::GoogleDrive => "google_drive",
            Self::OneDrive => "onedrive",
            Self::Mock => "mock",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "sftp" => Self::Sftp,
            "ftp" => Self::Ftp,
            "google_drive" => Self::GoogleDrive,
            "onedrive" => Self::OneDrive,
            "mock" => Self::Mock,
            _ => Self::Local,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilities {
    pub can_upload: bool,
    pub can_download: bool,
    pub can_create_dir: bool,
    pub can_rename: bool,
    pub can_delete: bool,
    pub can_trash: bool,
    pub can_export_docs: bool,
    pub can_resume_transfer: bool,
    pub supports_permissions: bool,
    pub supports_thumbnails: bool,
    pub is_encrypted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_time: Option<i64>,
    pub mime_type: Option<String>,
    pub permissions: Option<String>,
    pub etag: Option<String>,
    pub thumbnail_url: Option<String>,
    pub is_trashed: bool,
    pub is_workspace_doc: bool,
    pub export_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub provider_type: StorageProviderType,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub remote_root: Option<String>,
    pub timeout_secs: u32,
    pub last_connected: Option<i64>,
    pub status: String, // "disconnected", "connected", "connecting", "error"
    pub error_message: Option<String>,
    pub has_secret: bool,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHistoryItem {
    pub id: i64,
    pub profile_id: String,
    pub connected_at: i64,
    pub status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthInitResult {
    pub auth_url: String,
    pub state: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTransferProgress {
    pub operation_id: String,
    pub profile_id: String,
    pub item_name: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f32,
    pub speed_bytes_sec: u64,
    pub status: String, // "queued", "transferring", "completed", "failed", "cancelled"
}
