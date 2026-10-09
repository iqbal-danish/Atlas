use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OperationType {
    Copy,
    Move,
    Delete,
    Archive,
    Extract,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OperationStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictPolicy {
    Replace,
    Skip,
    Rename,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationTask {
    pub id: String,
    pub op_type: OperationType,
    pub sources: Vec<String>,
    pub destination: Option<String>,
    pub status: OperationStatus,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub total_files: usize,
    pub processed_files: usize,
    pub current_file: Option<String>,
    pub error: Option<String>,
}

pub struct OperationManager {
    _is_cancelled: Arc<AtomicBool>,
}

impl OperationManager {
    pub fn new() -> Self {
        Self {
            _is_cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn copy_items(
        sources: Vec<String>,
        destination_dir: String,
        conflict_policy: ConflictPolicy,
        cancel_token: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let dest = Path::new(&destination_dir);
        if !dest.is_dir() {
            return Err("Destination is not a directory".to_string());
        }

        for src_str in sources {
            if cancel_token.load(Ordering::Relaxed) {
                return Err("Operation cancelled by user".to_string());
            }

            let src_path = Path::new(&src_str);
            if !src_path.exists() {
                continue;
            }

            let file_name = src_path
                .file_name()
                .ok_or_else(|| "Invalid source file name".to_string())?;

            let mut target_path = dest.join(file_name);

            if target_path.exists() {
                match conflict_policy {
                    ConflictPolicy::Skip => continue,
                    ConflictPolicy::Replace => {
                        if target_path.is_dir() {
                            let _ = fs::remove_dir_all(&target_path);
                        } else {
                            let _ = fs::remove_file(&target_path);
                        }
                    }
                    ConflictPolicy::Rename => {
                        let stem = target_path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let ext = target_path
                            .extension()
                            .map(|s| format!(".{}", s.to_string_lossy()))
                            .unwrap_or_default();
                        let mut counter = 1;
                        loop {
                            let candidate = dest.join(format!("{} ({}){}", stem, counter, ext));
                            if !candidate.exists() {
                                target_path = candidate;
                                break;
                            }
                            counter += 1;
                        }
                    }
                }
            }

            if src_path.is_dir() {
                Self::copy_dir_recursive(src_path, &target_path, &cancel_token)?;
            } else {
                Self::copy_file_buffered(src_path, &target_path, &cancel_token)?;
            }
        }

        Ok(())
    }

    pub fn move_items(
        sources: Vec<String>,
        destination_dir: String,
        conflict_policy: ConflictPolicy,
        cancel_token: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let dest = Path::new(&destination_dir);
        if !dest.is_dir() {
            return Err("Destination is not a directory".to_string());
        }

        for src_str in sources {
            if cancel_token.load(Ordering::Relaxed) {
                return Err("Operation cancelled".to_string());
            }

            let src_path = Path::new(&src_str);
            if !src_path.exists() {
                continue;
            }

            let file_name = src_path
                .file_name()
                .ok_or_else(|| "Invalid source file name".to_string())?;

            let target_path = dest.join(file_name);

            // Attempt fast same-volume rename
            if fs::rename(src_path, &target_path).is_ok() {
                continue;
            }

            // Cross-volume fallback: copy then remove
            Self::copy_items(
                vec![src_str.clone()],
                destination_dir.clone(),
                conflict_policy.clone(),
                cancel_token.clone(),
            )?;

            if src_path.is_dir() {
                let _ = fs::remove_dir_all(src_path);
            } else {
                let _ = fs::remove_file(src_path);
            }
        }

        Ok(())
    }

    fn copy_file_buffered(src: &Path, dst: &Path, cancel_token: &Arc<AtomicBool>) -> Result<(), String> {
        let mut reader = fs::File::open(src).map_err(|e| e.to_string())?;
        let mut writer = fs::File::create(dst).map_err(|e| e.to_string())?;
        let mut buffer = [0u8; 64 * 1024]; // 64KB bounded streaming buffer

        loop {
            if cancel_token.load(Ordering::Relaxed) {
                let _ = fs::remove_file(dst);
                return Err("Cancelled".to_string());
            }

            let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            writer.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    fn copy_dir_recursive(src: &Path, dst: &Path, cancel_token: &Arc<AtomicBool>) -> Result<(), String> {
        fs::create_dir_all(dst).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
            if cancel_token.load(Ordering::Relaxed) {
                return Err("Cancelled".to_string());
            }
            let entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path();
            let dest_child = dst.join(entry.file_name());

            if entry_path.is_dir() {
                Self::copy_dir_recursive(&entry_path, &dest_child, cancel_token)?;
            } else {
                Self::copy_file_buffered(&entry_path, &dest_child, cancel_token)?;
            }
        }
        Ok(())
    }
}
