use crate::models::SearchResult;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use walkdir::WalkDir;

pub fn search_directory(
    root_path: &str,
    query: &str,
    max_results: usize,
    cancel_token: Arc<AtomicBool>,
) -> Vec<SearchResult> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    let start_time = Instant::now();

    // If searching at root of drive (e.g. "C:\" or "C:"), restrict depth to 4 to prevent hanging on Windows system trees.
    // If searching inside a specific folder, allow depth up to 8.
    let is_drive_root = root_path.trim_end_matches(['\\', '/']).len() <= 2;
    let max_depth = if is_drive_root { 4 } else { 8 };

    let mut scanned_count: usize = 0;

    for entry in WalkDir::new(root_path)
        .max_depth(max_depth)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            let name_lower = name.to_lowercase();

            // Skip hidden or massive system/dependency directories that freeze the search
            if name.starts_with('.') {
                return false;
            }
            if name_lower == "$recycle.bin"
                || name_lower == "system volume information"
                || name_lower == "recovery"
                || name_lower == "node_modules"
                || name_lower == ".git"
                || name_lower == "package cache"
            {
                return false;
            }

            // If at drive root, skip Windows system internals to avoid hanging
            if is_drive_root && (name_lower == "windows" || name_lower == "winsxs") {
                return false;
            }

            true
        })
    {
        // Cancellation check
        if cancel_token.load(Ordering::Relaxed) {
            break;
        }

        // Circuit breaker: prevent UI freeze if search takes longer than 1.2s or visits 20,000 files
        scanned_count += 1;
        if scanned_count % 100 == 0 {
            if start_time.elapsed().as_millis() > 1200 || scanned_count > 20000 {
                break;
            }
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = entry.file_name().to_string_lossy();
        if file_name.to_lowercase().contains(&query_lower) {
            let metadata = entry.metadata().ok();
            let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let is_dir = entry.file_type().is_dir();
            let modified_time = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            results.push(SearchResult {
                path: entry.path().to_string_lossy().to_string(),
                name: file_name.to_string(),
                is_dir,
                size,
                modified_time,
                match_indices: None,
            });

            if results.len() >= max_results {
                break;
            }
        }
    }

    results
}
