use rusqlite::{params, Connection, Result};
use std::path::PathBuf;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn init() -> Result<Self> {
        let app_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("atlas");
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("atlas.db");

        // Migrate old db if present
        if !db_path.exists() {
            if let Some(cfg) = dirs::config_dir() {
                let old_db = cfg.join("folio").join("folio.db");
                if old_db.exists() {
                    let _ = std::fs::copy(&old_db, &db_path);
                }
            }
        }

        let conn = Connection::open(db_path)?;

        // Execute migrations
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                icon TEXT
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS recent_locations (
                path TEXT PRIMARY KEY,
                last_visited INTEGER NOT NULL
            );",
            [],
        )?;

        // Section 27: Remote Storage Profiles & Connection History (Secrets stored in OS Credential Manager)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS remote_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider_type TEXT NOT NULL,
                host TEXT,
                port INTEGER,
                username TEXT,
                remote_root TEXT,
                timeout_secs INTEGER NOT NULL DEFAULT 30,
                last_connected INTEGER,
                status TEXT NOT NULL DEFAULT 'disconnected',
                error_message TEXT,
                config TEXT NOT NULL DEFAULT '{}'
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS remote_connection_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                connected_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT
            );",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2);",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn add_recent(&self, path: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT OR REPLACE INTO recent_locations (path, last_visited) VALUES (?1, ?2);",
            params![path, now],
        )?;
        Ok(())
    }

    pub fn get_recents(&self, limit: usize) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT path FROM recent_locations ORDER BY last_visited DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| row.get(0))?;
        let mut results = Vec::new();
        for r in rows {
            if let Ok(p) = r {
                results.push(p);
            }
        }
        Ok(results)
    }

    pub fn save_remote_profile(
        &self,
        id: &str,
        name: &str,
        provider_type: &str,
        host: Option<&str>,
        port: Option<u16>,
        username: Option<&str>,
        remote_root: Option<&str>,
        timeout_secs: u32,
        last_connected: Option<i64>,
        status: &str,
        error_message: Option<&str>,
        config_json: &str,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO remote_profiles (
                id, name, provider_type, host, port, username, remote_root,
                timeout_secs, last_connected, status, error_message, config
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12);",
            params![
                id,
                name,
                provider_type,
                host,
                port.map(|p| p as i64),
                username,
                remote_root,
                timeout_secs as i64,
                last_connected,
                status,
                error_message,
                config_json,
            ],
        )?;
        Ok(())
    }

    pub fn get_remote_profiles(&self) -> Result<Vec<(String, String, String, Option<String>, Option<u16>, Option<String>, Option<String>, u32, Option<i64>, String, Option<String>, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, provider_type, host, port, username, remote_root, timeout_secs, last_connected, status, error_message, config FROM remote_profiles ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let port_i64: Option<i64> = row.get(4)?;
            let timeout_i64: i64 = row.get(7)?;
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                port_i64.map(|p| p as u16),
                row.get(5)?,
                row.get(6)?,
                timeout_i64 as u32,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
            ))
        })?;

        let mut results = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                results.push(item);
            }
        }
        Ok(results)
    }

    pub fn delete_remote_profile(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM remote_profiles WHERE id = ?1", params![id])?;
        self.conn.execute("DELETE FROM remote_connection_history WHERE profile_id = ?1", params![id])?;
        Ok(())
    }

    pub fn record_connection_history(&self, profile_id: &str, status: &str, error_message: Option<&str>) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO remote_connection_history (profile_id, connected_at, status, error_message) VALUES (?1, ?2, ?3, ?4);",
            params![profile_id, now, status, error_message],
        )?;
        // Also update last_connected in remote_profiles
        if status == "connected" {
            self.conn.execute(
                "UPDATE remote_profiles SET last_connected = ?1, status = 'connected', error_message = NULL WHERE id = ?2;",
                params![now, profile_id],
            )?;
        } else if status == "error" {
            self.conn.execute(
                "UPDATE remote_profiles SET status = 'error', error_message = ?1 WHERE id = ?2;",
                params![error_message, profile_id],
            )?;
        }
        Ok(())
    }

    pub fn get_connection_history(&self, profile_id: &str, limit: usize) -> Result<Vec<(i64, String, i64, String, Option<String>)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, connected_at, status, error_message FROM remote_connection_history WHERE profile_id = ?1 ORDER BY connected_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit as i64], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })?;

        let mut results = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                results.push(item);
            }
        }
        Ok(results)
    }

    pub fn import_from_serverdock(&self) -> Result<usize, String> {
        let appdata_candidates = vec![
            dirs::config_dir().map(|p| p.join("com.serverdock.desktop").join("serverdock.db")),
            dirs::data_dir().map(|p| p.join("com.serverdock.desktop").join("serverdock.db")),
            dirs::home_dir().map(|p| p.join("AppData").join("Roaming").join("com.serverdock.desktop").join("serverdock.db")),
        ];

        let mut db_path = None;
        for c in appdata_candidates.into_iter().flatten() {
            if c.exists() {
                db_path = Some(c);
                break;
            }
        }

        let Some(path) = db_path else {
            return Err("ServerDock database not found on this system".to_string());
        };

        let ext_conn = Connection::open(&path).map_err(|e| format!("Failed to open ServerDock database: {}", e))?;
        let mut stmt = ext_conn.prepare("SELECT id, name, protocol, host, port, username, auth_type, key_path, remote_dir FROM connections")
            .map_err(|e| format!("Failed to query ServerDock connections: {}", e))?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let protocol: String = row.get(2)?;
            let host: String = row.get(3)?;
            let port: i64 = row.get(4)?;
            let username: String = row.get(5)?;
            let _auth_type: String = row.get(6)?;
            let _key_path: Option<String> = row.get(7)?;
            let remote_dir: Option<String> = row.get(8)?;
            Ok((id, name, protocol, host, port as u16, username, remote_dir))
        }).map_err(|e| format!("Query map error: {}", e))?;

        let mut count = 0;
        for item in rows {
            if let Ok((id, name, protocol, host, port, username, remote_dir)) = item {
                let provider_type = if protocol.to_lowercase() == "ftp" { "ftp" } else { "sftp" };
                let remote_root = remote_dir.unwrap_or_else(|| "/".to_string());
                
                // Migrate credentials from ServerDock keyring if present
                if let Ok(entry) = keyring::Entry::new("serverdock-credentials", &id) {
                    if let Ok(secret) = entry.get_password() {
                        let _ = crate::remote::credentials::store_secret(&id, &secret);
                    }
                }

                let _ = self.save_remote_profile(
                    &id,
                    &name,
                    provider_type,
                    Some(&host),
                    Some(port),
                    Some(&username),
                    Some(&remote_root),
                    30,
                    None,
                    "disconnected",
                    None,
                    "{}",
                );
                count += 1;
            }
        }
        Ok(count)
    }

    pub fn forget_profile_password(&self, profile_id: &str) -> Result<(), String> {
        let _ = crate::remote::credentials::delete_secret(profile_id);
        if let Ok(entry) = keyring::Entry::new("serverdock-credentials", profile_id) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}

