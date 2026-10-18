use std::sync::Mutex;

const SERVICE: &str = "com.mesomya.openusage.provider-api-key";
static CREDENTIAL_LOCK: Mutex<()> = Mutex::new(());

fn validate_provider(provider_id: &str) -> Result<(), String> {
    match provider_id {
        "openrouter" | "cheaperinference" => Ok(()),
        _ => Err("This provider does not support API key settings.".into()),
    }
}

fn validate_api_key(api_key: &str) -> Result<&str, String> {
    let value = api_key.trim();
    if value.is_empty() || value.len() > 2048 || !value.bytes().all(|b| b.is_ascii_graphic()) {
        return Err("Enter a valid API key without spaces or line breaks.".into());
    }
    Ok(value)
}

fn entry(provider_id: &str) -> Result<keyring::Entry, String> {
    validate_provider(provider_id)?;
    // Never silently fall back to keyring's in-memory mock on unsupported OSes.
    if !cfg!(any(target_os = "windows", target_os = "macos")) && !cfg!(test) {
        return Err("API key storage is supported on Windows and macOS.".into());
    }
    keyring::Entry::new(SERVICE, provider_id)
        .map_err(|_| "Could not access the system credential store.".into())
}

pub(crate) fn read_api_key(provider_id: &str) -> Result<Option<String>, String> {
    let _guard = CREDENTIAL_LOCK
        .lock()
        .map_err(|_| "Credential store is busy.")?;
    match entry(provider_id)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read the API key from the system credential store.".into()),
    }
}

#[tauri::command]
pub(crate) fn has_provider_api_key(provider_id: String) -> Result<bool, String> {
    Ok(read_api_key(&provider_id)?.is_some())
}

#[tauri::command]
pub(crate) fn set_provider_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    let value = validate_api_key(&api_key)?;
    let _guard = CREDENTIAL_LOCK
        .lock()
        .map_err(|_| "Credential store is busy.")?;
    entry(&provider_id)?
        .set_password(value)
        .map_err(|_| "Could not save the API key in the system credential store.")?;
    crate::local_http_api::cache::invalidate_provider(&provider_id);
    Ok(())
}

#[tauri::command]
pub(crate) fn delete_provider_api_key(provider_id: String) -> Result<(), String> {
    let _guard = CREDENTIAL_LOCK
        .lock()
        .map_err(|_| "Credential store is busy.")?;
    match entry(&provider_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            crate::local_http_api::cache::invalidate_provider(&provider_id);
            Ok(())
        }
        Err(_) => Err("Could not remove the API key from the system credential store.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_provider_and_header_safe_keys() {
        assert!(validate_provider("openrouter").is_ok());
        assert!(validate_provider("cheaperinference").is_ok());
        assert!(validate_provider("../openrouter").is_err());
        assert_eq!(
            validate_api_key("  example-test-key  ").unwrap(),
            "example-test-key"
        );
        for value in ["", "  ", "a b", "a\r\nb", "a\0b", "é"] {
            assert!(validate_api_key(value).is_err());
        }
        assert!(validate_api_key(&"a".repeat(2049)).is_err());
    }

    #[test]
    fn unsupported_providers_cannot_access_credentials() {
        assert!(read_api_key("claude").is_err());
        assert!(has_provider_api_key("../openrouter".into()).is_err());
        assert!(set_provider_api_key("codex".into(), "example-test-key".into()).is_err());
        assert!(delete_provider_api_key("openrouter/other".into()).is_err());
    }
}
