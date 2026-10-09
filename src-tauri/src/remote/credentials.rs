use keyring::Entry;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const SERVICE_NAME: &str = "AtlasFileManager";
const LEGACY_SERVICE_NAME: &str = "FolioFileManager";

fn get_fallback() -> &'static Mutex<HashMap<String, String>> {
    static STORE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Stores a secret (password, OAuth refresh token, private key passphrase)
/// in Windows Credential Manager with secure in-memory session protection.
pub fn store_secret(profile_id: &str, secret: &str) -> Result<(), String> {
    // Keep in session store
    {
        let mut guard = get_fallback().lock().unwrap();
        guard.insert(profile_id.to_string(), secret.to_string());
    }

    // Persist to Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, profile_id) {
        let _ = entry.set_password(secret);
    }

    Ok(())
}

/// Retrieves a secret from Windows Credential Manager or session store.
pub fn get_secret(profile_id: &str) -> Result<Option<String>, String> {
    // Try Atlas Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, profile_id) {
        if let Ok(pass) = entry.get_password() {
            return Ok(Some(pass));
        }
    }

    // Try Legacy Folio Windows Credential Manager
    if let Ok(entry) = Entry::new(LEGACY_SERVICE_NAME, profile_id) {
        if let Ok(pass) = entry.get_password() {
            return Ok(Some(pass));
        }
    }

    // Try ServerDock Windows Credential Manager
    if let Ok(entry) = Entry::new("serverdock-credentials", profile_id) {
        if let Ok(pass) = entry.get_password() {
            return Ok(Some(pass));
        }
    }

    // Fall back to session store
    let guard = get_fallback().lock().unwrap();
    Ok(guard.get(profile_id).cloned())
}

/// Deletes a secret from Windows Credential Manager and session store.
pub fn delete_secret(profile_id: &str) -> Result<(), String> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, profile_id) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new("serverdock-credentials", profile_id) {
        let _ = entry.delete_credential();
    }
    let mut guard = get_fallback().lock().unwrap();
    guard.remove(profile_id);
    Ok(())
}

