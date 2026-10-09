use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use crate::models::{DirectoryListing, DriveInfo, FsEntry};

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

pub fn get_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();

    #[cfg(windows)]
    {
        use windows_sys::Win32::Storage::FileSystem::{
            GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
        };

        // Constants from Win32 SDK
        const DRIVE_REMOVABLE: u32 = 2;
        const DRIVE_FIXED: u32 = 3;
        const DRIVE_REMOTE: u32 = 4;
        const DRIVE_CDROM: u32 = 5;
        const DRIVE_RAMDISK: u32 = 6;

        unsafe {
            let mask = GetLogicalDrives();
            for i in 0..26 {
                if (mask & (1 << i)) != 0 {
                    let letter = (b'A' + i) as char;
                    let root_str = format!("{}:\\", letter);
                    let mut root_wide: Vec<u16> = root_str.encode_utf16().collect();
                    root_wide.push(0);

                    let drive_type_raw = GetDriveTypeW(root_wide.as_ptr());
                    let (drive_type, is_removable) = match drive_type_raw {
                        DRIVE_REMOVABLE => ("Removable", true),
                        DRIVE_FIXED => ("Local Disk", false),
                        DRIVE_REMOTE => ("Network Drive", false),
                        DRIVE_CDROM => ("Optical Drive", true),
                        DRIVE_RAMDISK => ("RAM Disk", false),
                        _ => ("Disk", false),
                    };

                    let mut volume_name = [0u16; 260];
                    let mut serial = 0u32;
                    let mut max_component = 0u32;
                    let mut flags = 0u32;
                    let mut fs_name = [0u16; 260];

                    let _ = GetVolumeInformationW(
                        root_wide.as_ptr(),
                        volume_name.as_mut_ptr(),
                        volume_name.len() as u32,
                        &mut serial,
                        &mut max_component,
                        &mut flags,
                        fs_name.as_mut_ptr(),
                        fs_name.len() as u32,
                    );

                    let label = String::from_utf16_lossy(
                        &volume_name[..volume_name.iter().position(|&c| c == 0).unwrap_or(0)],
                    );

                    let mut free_bytes_available = 0u64;
                    let mut total_bytes = 0u64;
                    let mut total_free_bytes = 0u64;

                    let _ = GetDiskFreeSpaceExW(
                        root_wide.as_ptr(),
                        &mut free_bytes_available,
                        &mut total_bytes,
                        &mut total_free_bytes,
                    );

                    drives.push(DriveInfo {
                        mount_point: root_str,
                        volume_label: if label.is_empty() {
                            format!("Local Disk ({}:)", letter)
                        } else {
                            label
                        },
                        total_bytes,
                        available_bytes: free_bytes_available,
                        drive_type: drive_type.to_string(),
                        is_removable,
                    });
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        drives.push(DriveInfo {
            mount_point: "/".to_string(),
            volume_label: "Root".to_string(),
            total_bytes: 500_000_000_000,
            available_bytes: 250_000_000_000,
            drive_type: "Local Disk".to_string(),
            is_removable: false,
        });
    }

    drives
}

pub fn read_directory(path_str: &str, show_hidden: bool) -> Result<DirectoryListing, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path_str));
    }

    let parent_path = path.parent().map(|p| p.to_string_lossy().to_string());
    let mut entries = Vec::new();
    let mut total_size = 0u64;

    let read_dir = match fs::read_dir(path) {
        Ok(rd) => rd,
        Err(e) => {
            return Ok(DirectoryListing {
                current_path: path_str.to_string(),
                parent_path,
                entries: Vec::new(),
                total_count: 0,
                total_size: 0,
                is_readable: false,
                error_message: Some(format!("Access Denied or I/O error: {}", e)),
            });
        }
    };

    for entry_res in read_dir {
        let entry = match entry_res {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        let path_buf_str = entry_path.to_string_lossy().to_string();

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => match fs::symlink_metadata(&entry_path) {
                Ok(m) => m,
                Err(_) => continue,
            },
        };

        let is_dir = metadata.is_dir();
        let is_symlink = metadata.file_type().is_symlink();
        let size = if is_dir { 0 } else { metadata.len() };
        total_size += size;

        let mut is_hidden = file_name.starts_with('.');
        let mut is_readonly = metadata.permissions().readonly();

        #[cfg(windows)]
        {
            let attrs = metadata.file_attributes();
            // FILE_ATTRIBUTE_HIDDEN = 0x2
            if (attrs & 0x2) != 0 {
                is_hidden = true;
            }
            // FILE_ATTRIBUTE_READONLY = 0x1
            if (attrs & 0x1) != 0 {
                is_readonly = true;
            }
        }

        if !show_hidden && is_hidden {
            continue;
        }

        let extension = if is_dir {
            None
        } else {
            entry_path
                .extension()
                .map(|ext| ext.to_string_lossy().to_lowercase())
        };

        let modified_time = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        let created_time = metadata
            .created()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        entries.push(FsEntry {
            name: file_name,
            path: path_buf_str,
            is_dir,
            is_symlink,
            is_hidden,
            is_readonly,
            size,
            extension,
            modified_time,
            created_time,
            item_count: None,
        });
    }

    // Default sort: directories first, then alphabetical case-insensitive
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    let total_count = entries.len();

    Ok(DirectoryListing {
        current_path: path_str.to_string(),
        parent_path,
        entries,
        total_count,
        total_size,
        is_readable: true,
        error_message: None,
    })
}

pub fn get_metadata(path_str: &str) -> Result<FsEntry, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }

    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.to_string());

    let is_dir = metadata.is_dir();
    let is_symlink = metadata.file_type().is_symlink();
    let size = if is_dir { 0 } else { metadata.len() };

    let mut is_hidden = file_name.starts_with('.');
    let mut is_readonly = metadata.permissions().readonly();

    #[cfg(windows)]
    {
        let attrs = metadata.file_attributes();
        if (attrs & 0x2) != 0 {
            is_hidden = true;
        }
        if (attrs & 0x1) != 0 {
            is_readonly = true;
        }
    }

    let extension = if is_dir {
        None
    } else {
        path.extension()
            .map(|ext| ext.to_string_lossy().to_lowercase())
    };

    let modified_time = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let created_time = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let item_count = if is_dir {
        fs::read_dir(path).ok().map(|rd| rd.count())
    } else {
        None
    };

    Ok(FsEntry {
        name: file_name,
        path: path_str.to_string(),
        is_dir,
        is_symlink,
        is_hidden,
        is_readonly,
        size,
        extension,
        modified_time,
        created_time,
        item_count,
    })
}

pub fn create_folder(parent_path: &str, folder_name: &str) -> Result<String, String> {
    let target = Path::new(parent_path).join(folder_name);
    if target.exists() {
        return Err(format!("Folder already exists: {}", target.display()));
    }
    fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn create_file(parent_path: &str, file_name: &str) -> Result<String, String> {
    let target = Path::new(parent_path).join(file_name);
    if target.exists() {
        return Err(format!("File already exists: {}", target.display()));
    }
    fs::File::create(&target).map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn rename_entry(old_path: &str, new_name: &str) -> Result<String, String> {
    let old = Path::new(old_path);
    if !old.exists() {
        return Err(format!("Path does not exist: {}", old_path));
    }
    let parent = old
        .parent()
        .ok_or_else(|| "Cannot rename root drive".to_string())?;
    let new_target = parent.join(new_name);
    if new_target.exists() {
        return Err(format!("Target already exists: {}", new_target.display()));
    }
    fs::rename(old, &new_target).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(new_target.to_string_lossy().to_string())
}

pub fn delete_to_trash(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();
    for p in paths {
        let path = Path::new(&p);
        if path.exists() {
            trash::delete(path).map_err(|e| format!("Failed to move {} to trash: {}", p, e))?;
            deleted.push(p);
        }
    }
    Ok(deleted)
}

pub fn delete_permanently(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut deleted = Vec::new();
    for p in paths {
        let path = Path::new(&p);
        if path.is_dir() {
            fs::remove_dir_all(path)
                .map_err(|e| format!("Failed to remove directory {}: {}", p, e))?;
        } else if path.is_file() || path.is_symlink() {
            fs::remove_file(path).map_err(|e| format!("Failed to remove file {}: {}", p, e))?;
        }
        deleted.push(p);
    }
    Ok(deleted)
}

pub fn open_path_with_default_app(path_str: &str) -> Result<(), String> {
    open::that(path_str).map_err(|e| format!("Failed to open path: {}", e))
}

pub fn open_with_app(app_name: &str, file_path: &str) -> Result<(), String> {
    use std::process::Command;
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let exe_candidates: Vec<String> = match app_name.to_lowercase().as_str() {
        "ultraviewer" => vec![
            r"C:\Users\diqbal\UltraViewer\UltraViewer.exe".to_string(),
            r"C:\Users\diqbal\UltraViewer\target\release\UltraViewer.exe".to_string(),
        ],
        "feedlens" => vec![
            r"C:\Users\diqbal\FeedLens\FeedLens.exe".to_string(),
            r"C:\Users\diqbal\FeedLens\src-tauri\target\release\FeedLens.exe".to_string(),
            r"C:\Users\diqbal\FeedLens\src-tauri\target\release\tauri-app.exe".to_string(),
        ],
        "transformlab" => vec![
            r"C:\Users\diqbal\TransformLab\TransformLab.exe".to_string(),
            r"C:\Users\diqbal\TransformLab\src-tauri\target\release\TransformLab.exe".to_string(),
            r"C:\Users\diqbal\TransformLab\src-tauri\target\release\app.exe".to_string(),
        ],
        _ => return Err(format!("Unsupported application: {}", app_name)),
    };

    let target_exe = exe_candidates
        .into_iter()
        .find(|p| Path::new(p).exists())
        .ok_or_else(|| format!("Could not find {} executable", app_name))?;

    Command::new(&target_exe)
        .arg(file_path)
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", target_exe, e))?;

    Ok(())
}

pub fn show_in_explorer(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path_str));
    }
    #[cfg(windows)]
    {
        use std::process::Command;
        if path.is_file() {
            let _ = Command::new("explorer")
                .arg(format!("/select,{}", path_str))
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {}", e))?;
        } else {
            let _ = Command::new("explorer")
                .arg(path_str)
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {}", e))?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        open::that(path_str).map_err(|e| format!("Failed to open path: {}", e))
    }
}

pub fn open_recycle_bin() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("explorer")
            .arg("shell:RecycleBinFolder")
            .spawn()
            .map_err(|e| format!("Failed to open Recycle Bin: {}", e))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

fn parse_i_file(i_path: &Path) -> Option<(String, u64, String)> {
    let bytes = fs::read(i_path).ok()?;
    if bytes.len() < 24 {
        return None;
    }

    let version = u64::from_le_bytes(bytes[0..8].try_into().ok()?);
    let original_size = u64::from_le_bytes(bytes[8..16].try_into().ok()?);
    let filetime = u64::from_le_bytes(bytes[16..24].try_into().ok()?);

    let unix_secs = if filetime >= 116_444_736_000_000_000 {
        (filetime - 116_444_736_000_000_000) / 10_000_000
    } else {
        0
    };
    let date_str = if unix_secs > 0 {
        chrono::DateTime::from_timestamp(unix_secs as i64, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    } else {
        "Unknown".to_string()
    };

    let original_path = if version == 2 && bytes.len() >= 28 {
        let raw_u16: Vec<u16> = bytes[28..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|&c| c != 0)
            .collect();
        String::from_utf16_lossy(&raw_u16)
    } else if bytes.len() >= 24 {
        let raw_u16: Vec<u16> = bytes[24..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|&c| c != 0)
            .collect();
        String::from_utf16_lossy(&raw_u16)
    } else {
        return None;
    };

    if original_path.is_empty() {
        return None;
    }

    Some((original_path, original_size, date_str))
}

pub fn list_recycle_bin() -> Result<Vec<crate::models::RecycleBinEntry>, String> {
    #[cfg(windows)]
    {
        let mut results = Vec::new();
        let drives = get_drives();

        for drive in drives {
            let bin_dir = PathBuf::from(&drive.mount_point).join("$Recycle.Bin");
            if !bin_dir.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(&bin_dir) {
                for sid_res in entries {
                    let Ok(sid_entry) = sid_res else { continue };
                    let sid_path = sid_entry.path();
                    if !sid_path.is_dir() {
                        continue;
                    }

                    if let Ok(user_entries) = fs::read_dir(&sid_path) {
                        for item_res in user_entries {
                            let Ok(item) = item_res else { continue };
                            let item_path = item.path();
                            let file_name = item.file_name().to_string_lossy().to_string();

                            if file_name.starts_with("$I") {
                                if let Some((orig_path, size, date_deleted)) = parse_i_file(&item_path) {
                                    let r_name = format!("$R{}", &file_name[2..]);
                                    let r_path = sid_path.join(&r_name);
                                    if !r_path.exists() {
                                        // The actual payload does not exist (orphan metadata).
                                        // Silently purge the orphan so it doesn't appear in Recycle Bin
                                        let _ = fs::remove_file(&item_path);
                                        continue;
                                    }

                                    let is_dir = r_path.is_dir();
                                    let display_name = Path::new(&orig_path)
                                        .file_name()
                                        .map(|n| n.to_string_lossy().to_string())
                                        .unwrap_or_else(|| orig_path.clone());

                                    results.push(crate::models::RecycleBinEntry {
                                        id: item_path.to_string_lossy().to_string(),
                                        name: display_name,
                                        original_path: orig_path,
                                        date_deleted,
                                        size,
                                        is_dir,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sort most recently deleted first
        results.sort_by(|a, b| b.date_deleted.cmp(&a.date_deleted));
        Ok(results)
    }
    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

pub fn restore_recycle_bin_item(name_or_path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let i_path = PathBuf::from(name_or_path);
        if i_path.exists() {
            if let Some((orig_path_str, _, _)) = parse_i_file(&i_path) {
                if let Some(parent) = i_path.parent() {
                    let file_name = i_path.file_name().unwrap().to_string_lossy();
                    let r_name = format!("$R{}", &file_name[2..]);
                    let r_path = parent.join(&r_name);

                    if r_path.exists() {
                        let target_path = PathBuf::from(&orig_path_str);
                        if let Some(target_parent) = target_path.parent() {
                            let _ = fs::create_dir_all(target_parent);
                        }
                        if fs::rename(&r_path, &target_path).is_ok() {
                            let _ = fs::remove_file(&i_path);
                            return Ok(());
                        }
                    }
                }
            }
        }

        // Fallback to Shell COM
        let escaped = name_or_path.replace('"', "`\"");
        let script = format!(
            r#"
            $s = New-Object -ComObject Shell.Application
            $b = $s.Namespace(10)
            $target = "{}"
            if ($b) {{
                foreach($i in $b.Items()) {{
                    if ($i.Name -eq $target -or $i.Path -eq $target) {{
                        foreach($v in $i.Verbs()) {{
                            if ($v.Name -match '(?i)restore|undelete') {{
                                $v.DoIt()
                                exit 0
                            }}
                        }}
                    }}
                }}
            }}
            "#,
            escaped
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output();
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

pub fn restore_all_recycle_bin() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let script = r#"
            $s = New-Object -ComObject Shell.Application
            $b = $s.Namespace(10)
            if ($b) {
                foreach($i in $b.Items()) {
                    foreach($v in $i.Verbs()) {
                        if ($v.Name -match '(?i)restore|undelete') {
                            $v.DoIt()
                            break
                        }
                    }
                }
            }
        "#;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to restore all items: {}", e))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

pub fn empty_recycle_bin() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let script = "Clear-RecycleBin -Force -Confirm:$false -ErrorAction SilentlyContinue";
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to empty Recycle Bin: {}", e))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

pub fn delete_recycle_bin_item(name_or_path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let i_path = PathBuf::from(name_or_path);
        if let Some(parent) = i_path.parent() {
            let file_name = i_path.file_name().unwrap_or_default().to_string_lossy();
            if file_name.starts_with("$I") {
                let r_name = format!("$R{}", &file_name[2..]);
                let r_path = parent.join(&r_name);
                if r_path.exists() {
                    if r_path.is_dir() {
                        let _ = fs::remove_dir_all(&r_path);
                    } else {
                        let _ = fs::remove_file(&r_path);
                    }
                }
            }
        }
        if i_path.exists() {
            let _ = fs::remove_file(&i_path);
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}


pub fn launch_terminal(path_str: &str, shell: Option<&str>) -> Result<(), String> {
    let path = Path::new(path_str);
    let working_dir = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    #[cfg(windows)]
    {
        use std::process::Command;
        let chosen_shell = shell.unwrap_or("wt");

        // Try Windows Terminal first if requested or default
        if chosen_shell == "wt" {
            if let Ok(_) = Command::new("wt")
                .args(["-d", &working_dir.to_string_lossy()])
                .spawn()
            {
                return Ok(());
            }
        }

        // Fallback to PowerShell
        if chosen_shell == "powershell" || chosen_shell == "wt" {
            if let Ok(_) = Command::new("powershell")
                .args(["-NoExit", "-Command", &format!("Set-Location -LiteralPath '{}'", working_dir.to_string_lossy())])
                .spawn()
            {
                return Ok(());
            }
        }

        // Final fallback to CMD
        Command::new("cmd")
            .args(["/K", &format!("cd /d \"{}\"", working_dir.to_string_lossy())])
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;

        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = working_dir;
        Ok(())
    }
}

pub fn calculate_directory_size(path_str: &str) -> Result<crate::models::DirSizeInfo, String> {
    let root = Path::new(path_str);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", path_str));
    }

    let mut total_bytes = 0u64;
    let mut file_count = 0usize;
    let mut dir_count = 0usize;
    let mut inaccessible_count = 0usize;

    for entry in walkdir::WalkDir::new(root).into_iter() {
        match entry {
            Ok(e) => {
                if let Ok(metadata) = e.metadata() {
                    if metadata.is_file() {
                        total_bytes = total_bytes.saturating_add(metadata.len());
                        file_count += 1;
                    } else if metadata.is_dir() && e.path() != root {
                        dir_count += 1;
                    }
                } else {
                    inaccessible_count += 1;
                }
            }
            Err(_) => {
                inaccessible_count += 1;
            }
        }
    }

    Ok(crate::models::DirSizeInfo {
        path: path_str.to_string(),
        total_bytes,
        file_count,
        dir_count,
        inaccessible_count,
    })
}

pub fn calculate_file_hash(path_str: &str, algorithm: &str) -> Result<crate::models::HashResult, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let path = Path::new(path_str);
    if !path.is_file() {
        return Err(format!("Path is not a regular file: {}", path_str));
    }

    let mut file = fs::File::open(path).map_err(|e| format!("Cannot open file for hashing: {}", e))?;
    let mut buffer = [0u8; 64 * 1024];

    if algorithm.eq_ignore_ascii_case("sha256") || algorithm.is_empty() {
        let mut hasher = Sha256::new();
        loop {
            let bytes_read = file.read(&mut buffer).map_err(|e| format!("Read error during hash: {}", e))?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }
        let result = hasher.finalize();
        let hash_hex = format!("{:x}", result);

        Ok(crate::models::HashResult {
            path: path_str.to_string(),
            algorithm: "SHA-256".to_string(),
            hash: hash_hex,
        })
    } else {
        Err(format!("Unsupported hash algorithm: {}", algorithm))
    }
}

pub fn list_archive(path_str: &str) -> Result<Vec<crate::models::ArchiveEntryInfo>, String> {
    use std::io::BufReader;

    let path = Path::new(path_str);
    let file = fs::File::open(path).map_err(|e| format!("Cannot open archive: {}", e))?;
    let reader = BufReader::new(file);

    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Invalid ZIP archive: {}", e))?;
    let mut entries = Vec::new();

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            entries.push(crate::models::ArchiveEntryInfo {
                name: file.name().to_string(),
                size: file.size(),
                compressed_size: file.compressed_size(),
                is_dir: file.is_dir(),
            });
        }
    }

    Ok(entries)
}

pub fn extract_archive(path_str: &str, destination_str: &str) -> Result<usize, String> {
    use std::io::BufReader;

    let path = Path::new(path_str);
    let dest_path = Path::new(destination_str);
    if !dest_path.exists() {
        fs::create_dir_all(dest_path).map_err(|e| format!("Cannot create extraction directory: {}", e))?;
    }

    let file = fs::File::open(path).map_err(|e| format!("Cannot open archive: {}", e))?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Invalid ZIP archive: {}", e))?;

    let mut extracted_count = 0usize;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Corrupt entry {}: {}", i, e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => continue, // Disallow unsafe Zip slip paths
        };

        if file.is_dir() {
            let _ = fs::create_dir_all(&outpath);
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    let _ = fs::create_dir_all(p);
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| format!("Cannot create {}: {}", outpath.display(), e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Write failed for {}: {}", outpath.display(), e))?;
            extracted_count += 1;
        }
    }

    Ok(extracted_count)
}

pub fn create_zip_archive(sources: Vec<String>, dest_zip_path: &str) -> Result<String, String> {
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    let dest_path = Path::new(dest_zip_path);
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let file = fs::File::create(dest_path).map_err(|e| format!("Cannot create archive file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    for source_str in sources {
        let source_path = Path::new(&source_str);
        if !source_path.exists() {
            continue;
        }

        let base_name = source_path.file_name().unwrap_or_default().to_string_lossy().to_string();

        if source_path.is_file() {
            zip.start_file(base_name, options).map_err(|e| e.to_string())?;
            let mut f = fs::File::open(source_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        } else if source_path.is_dir() {
            for entry_res in walkdir::WalkDir::new(source_path) {
                let entry = entry_res.map_err(|e| e.to_string())?;
                let path = entry.path();
                let relative = path.strip_prefix(source_path.parent().unwrap_or(source_path)).map_err(|e| e.to_string())?;
                let path_str = relative.to_string_lossy().replace('\\', "/");

                if entry.file_type().is_dir() {
                    zip.add_directory(format!("{}/", path_str), options).map_err(|e| e.to_string())?;
                } else {
                    zip.start_file(path_str, options).map_err(|e| e.to_string())?;
                    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize archive: {}", e))?;
    Ok(dest_zip_path.to_string())
}

pub fn compare_directories(dir_a_str: &str, dir_b_str: &str) -> Result<crate::models::CompareResult, String> {
    use std::collections::HashMap;

    let path_a = Path::new(dir_a_str);
    let path_b = Path::new(dir_b_str);

    if !path_a.is_dir() {
        return Err(format!("Directory A does not exist: {}", dir_a_str));
    }
    if !path_b.is_dir() {
        return Err(format!("Directory B does not exist: {}", dir_b_str));
    }

    let mut map_a: HashMap<String, (u64, Option<i64>)> = HashMap::new();
    let mut map_b: HashMap<String, (u64, Option<i64>)> = HashMap::new();

    if let Ok(entries) = fs::read_dir(path_a) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Ok(meta) = entry.metadata() {
                let mtime = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64);
                map_a.insert(name, (meta.len(), mtime));
            }
        }
    }

    if let Ok(entries) = fs::read_dir(path_b) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Ok(meta) = entry.metadata() {
                let mtime = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64);
                map_b.insert(name, (meta.len(), mtime));
            }
        }
    }

    let mut items = Vec::new();
    let mut all_keys: Vec<String> = map_a.keys().chain(map_b.keys()).cloned().collect();
    all_keys.sort();
    all_keys.dedup();

    for key in all_keys {
        let in_a = map_a.get(&key);
        let in_b = map_b.get(&key);

        match (in_a, in_b) {
            (Some(a), None) => {
                items.push(crate::models::CompareItem {
                    name: key.clone(),
                    relative_path: key,
                    status: "onlyInLeft".to_string(),
                    size_a: Some(a.0),
                    size_b: None,
                    modified_a: a.1,
                    modified_b: None,
                });
            }
            (None, Some(b)) => {
                items.push(crate::models::CompareItem {
                    name: key.clone(),
                    relative_path: key,
                    status: "onlyInRight".to_string(),
                    size_a: None,
                    size_b: Some(b.0),
                    modified_a: None,
                    modified_b: b.1,
                });
            }
            (Some(a), Some(b)) => {
                let status = if a.0 != b.0 {
                    "differentSize"
                } else if a.1 != b.1 {
                    "differentDate"
                } else {
                    "identical"
                };

                items.push(crate::models::CompareItem {
                    name: key.clone(),
                    relative_path: key,
                    status: status.to_string(),
                    size_a: Some(a.0),
                    size_b: Some(b.0),
                    modified_a: a.1,
                    modified_b: b.1,
                });
            }
            (None, None) => {}
        }
    }

    let total_compared = items.len();

    Ok(crate::models::CompareResult {
        dir_a: dir_a_str.to_string(),
        dir_b: dir_b_str.to_string(),
        items,
        total_compared,
    })
}

pub fn batch_rename_entries(pairs: Vec<crate::models::BatchRenamePair>) -> Result<Vec<String>, String> {
    // Validate all pairs first
    for pair in &pairs {
        let old = Path::new(&pair.old_path);
        let new = Path::new(&pair.new_path);
        if !old.exists() {
            return Err(format!("Source does not exist: {}", pair.old_path));
        }
        if new.exists() && old != new {
            return Err(format!("Collision detected! Target already exists: {}", pair.new_path));
        }
    }

    let mut renamed = Vec::new();
    for pair in pairs {
        let old = Path::new(&pair.old_path);
        let new = Path::new(&pair.new_path);
        if old != new {
            fs::rename(old, new).map_err(|e| format!("Failed to rename {} -> {}: {}", pair.old_path, pair.new_path, e))?;
        }
        renamed.push(pair.new_path);
    }

    Ok(renamed)
}

pub fn get_system_folders() -> crate::models::SystemFolders {
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "C:\\Users\\diqbal".to_string());

    let onedrive_docs = dirs::home_dir().map(|h| h.join("OneDrive").join("Documents")).filter(|p| p.exists());
    let onedrive_desktop = dirs::home_dir().map(|h| h.join("OneDrive").join("Desktop")).filter(|p| p.exists());
    let onedrive_pics = dirs::home_dir().map(|h| h.join("OneDrive").join("Pictures")).filter(|p| p.exists());

    let documents = onedrive_docs
        .or_else(dirs::document_dir)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Documents", home));

    let desktop = onedrive_desktop
        .or_else(dirs::desktop_dir)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Desktop", home));

    let pictures = onedrive_pics
        .or_else(dirs::picture_dir)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Pictures", home));

    let downloads = dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Downloads", home));

    let music = dirs::audio_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Music", home));

    let videos = dirs::video_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}\\Videos", home));

    crate::models::SystemFolders {
        desktop,
        downloads,
        documents,
        pictures,
        music,
        videos,
        home,
    }
}

