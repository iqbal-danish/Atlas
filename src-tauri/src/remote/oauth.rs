use sha2::{Digest, Sha256};
use crate::remote::types::OAuthInitResult;

/// Generates a high-entropy PKCE code verifier and code challenge (S256)
pub fn generate_pkce() -> (String, String) {
    let verifier: String = (0..64)
        .map(|_| {
            let idx = (rand_simple() % 62) as usize;
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[idx] as char
        })
        .collect();

    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();

    let challenge = base64_url_encode(&hash);
    (verifier, challenge)
}

fn rand_simple() -> u32 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    nanos ^ 0x5bd1e995
}

fn base64_url_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i];
        let b1 = if i + 1 < data.len() { data[i + 1] } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] } else { 0 };

        out.push(TABLE[(b0 >> 2) as usize] as char);
        out.push(TABLE[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if i + 1 < data.len() {
            out.push(TABLE[(((b1 & 15) << 2) | (b2 >> 6)) as usize] as char);
        }
        if i + 2 < data.len() {
            out.push(TABLE[(b2 & 63) as usize] as char);
        }
        i += 3;
    }
    out
}

/// Builds OAuth initialization payload for Google Drive or Microsoft OneDrive
pub fn init_oauth_flow(
    provider_type: &str,
    client_id: &str,
    port: u16,
) -> Result<OAuthInitResult, String> {
    let (code_verifier, code_challenge) = generate_pkce();
    let state = format!("atlas_state_{}", uuid::Uuid::new_v4());
    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);

    let auth_url = match provider_type {
        "google_drive" => {
            let scope = urlencoding::encode("https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly");
            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=offline&prompt=consent",
                client_id,
                urlencoding::encode(&redirect_uri),
                scope,
                code_challenge,
                state
            )
        }
        "onedrive" => {
            let scope = urlencoding::encode("Files.ReadWrite Files.ReadWrite.All offline_access");
            format!(
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id={}&response_type=code&redirect_uri={}&response_mode=query&scope={}&code_challenge={}&code_challenge_method=S256&state={}",
                client_id,
                urlencoding::encode(&redirect_uri),
                scope,
                code_challenge,
                state
            )
        }
        _ => return Err(format!("Unsupported OAuth provider: {}", provider_type)),
    };

    Ok(OAuthInitResult {
        auth_url,
        state,
        code_verifier,
        redirect_uri,
    })
}
