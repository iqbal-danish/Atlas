use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
    pub is_readonly: bool,
    pub size: u64,
    pub extension: Option<String>,
    pub modified_time: Option<i64>,
    pub created_time: Option<i64>,
    pub item_count: Option<usize>, // Lazily fetched or for quick preview
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub mount_point: String,
    pub volume_label: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub drive_type: String,
    pub is_removable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub entries: Vec<FsEntry>,
    pub total_count: usize,
    pub total_size: u64,
    pub is_readable: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub path: String,
    pub mime_type: String,
    pub preview_type: String, // "text", "image", "json", "code", "binary", "error"
    pub content: Option<String>,
    pub size: u64,
    pub line_count: Option<usize>,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_time: Option<i64>,
    pub match_indices: Option<Vec<usize>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirSizeInfo {
    pub path: String,
    pub total_bytes: u64,
    pub file_count: usize,
    pub dir_count: usize,
    pub inaccessible_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    pub path: String,
    pub algorithm: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntryInfo {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareItem {
    pub name: String,
    pub relative_path: String,
    pub status: String, // "onlyInLeft", "onlyInRight", "identical", "differentSize", "differentDate"
    pub size_a: Option<u64>,
    pub size_b: Option<u64>,
    pub modified_a: Option<i64>,
    pub modified_b: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareResult {
    pub dir_a: String,
    pub dir_b: String,
    pub items: Vec<CompareItem>,
    pub total_compared: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRenamePair {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinEntry {
    pub id: String,
    pub name: String,
    pub original_path: String,
    pub date_deleted: String,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFolders {
    pub desktop: String,
    pub downloads: String,
    pub documents: String,
    pub pictures: String,
    pub music: String,
    pub videos: String,
    pub home: String,
}

