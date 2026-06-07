use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use pbkdf2::pbkdf2;
use hmac::Hmac;
use sysinfo::System;
use std::sync::RwLock;
use lazy_static::lazy_static;
use std::time::SystemTime;

#[cfg(windows)]
use wmi::{COMLibrary, WMIConnection};

const LICENSE_FILENAME: &str = "system.dat";
const APP_SUBDIR: &str = "moh-auth-desktop-v2";
const NONCE_SIZE: usize = 12;

const STATIC_PASSWORD_SALT: &[u8] = b"MOH::STATIC::SALT::2026";

lazy_static! {
    static ref EXPECTED_BOOT_TIME: RwLock<u64> = RwLock::new(get_current_boot_time());
}

fn get_current_boot_time() -> u64 {
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs();
    let uptime = System::uptime();
    now.saturating_sub(uptime)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseData {
    pub machine_id: String,
    pub run_count: u32,
    pub max_runs: u32,
    pub max_runtime_minutes: u32,
    #[serde(default = "default_time")]
    pub first_run_time: u64,
    #[serde(default = "default_time")]
    pub last_saved_time: u64,
    #[serde(default)]
    pub is_time_tampered: bool,
    #[serde(default)]
    pub is_admin_unlocked: bool,
}

fn default_time() -> u64 {
    SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs()
}

#[derive(Debug, Clone)]
pub enum LicenseStatus {
    Valid(LicenseData),
}

#[derive(Debug, thiserror::Error)]
pub enum SecurityError {
    #[error("security is currently supported only on Windows targets")]
    UnsupportedPlatform,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("cryptography error")]
    Crypto,
    #[error("failed to read machine hardware info: {0}")]
    Hardware(String),
    #[error("license file is missing at: {0}")]
    LicenseMissing(String),
    #[error("machine id mismatch")]
    HwidMismatch,
    #[error("quota exceeded")]
    QuotaExceeded,
    #[error("decoy error PyQt6")]
    DecoyError,
    #[error("time tampering detected")]
    TimeTampered,
    #[error("session expired")]
    SessionExpired,
}

#[cfg(windows)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Win32BaseBoard {
    serial_number: Option<String>,
}

#[cfg(windows)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Win32Processor {
    processor_id: Option<String>,
}

fn local_app_data_dir() -> Result<PathBuf, SecurityError> {
    let root = env::var("LOCALAPPDATA")
        .or_else(|_| env::var("APPDATA"))
        .map_err(|_| SecurityError::LicenseMissing("LOCALAPPDATA/APPDATA".to_string()))?;
    let dir = Path::new(&root).join(APP_SUBDIR);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn roaming_app_data_windows_dir() -> Result<PathBuf, SecurityError> {
    let root = env::var("APPDATA").unwrap_or_else(|_| "C:\\".to_string());
    let dir = Path::new(&root).join("windows");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn default_license_path() -> Result<PathBuf, SecurityError> {
    Ok(local_app_data_dir()?.join(LICENSE_FILENAME))
}

fn lock_file_path() -> Result<PathBuf, SecurityError> {
    Ok(roaming_app_data_windows_dir()?.join("win32_telemetry.sys"))
}

fn flag_file_path() -> Result<PathBuf, SecurityError> {
    Ok(roaming_app_data_windows_dir()?.join("driver_activation_log.sys"))
}

#[cfg(windows)]
pub fn generate_machine_id() -> Result<String, SecurityError> {
    let com_con = COMLibrary::new().unwrap_or_else(|_| unsafe { COMLibrary::assume_initialized() });
    let wmi_con = WMIConnection::new(com_con).map_err(|e| SecurityError::Hardware(e.to_string()))?;

    let baseboards: Vec<Win32BaseBoard> = wmi_con
        .raw_query("SELECT SerialNumber FROM Win32_BaseBoard")
        .map_err(|e| SecurityError::Hardware(e.to_string()))?;
    let processors: Vec<Win32Processor> = wmi_con
        .raw_query("SELECT ProcessorId FROM Win32_Processor")
        .map_err(|e| SecurityError::Hardware(e.to_string()))?;

    let board_serial = baseboards
        .into_iter()
        .find_map(|b| b.serial_number)
        .unwrap_or_default()
        .trim()
        .to_string();
    let cpu_serial = processors
        .into_iter()
        .find_map(|p| p.processor_id)
        .unwrap_or_default()
        .trim()
        .to_string();

    if board_serial.is_empty() && cpu_serial.is_empty() {
        return Err(SecurityError::Hardware(
            "both BaseBoard serial and CPU ProcessorId are empty".to_string(),
        ));
    }

    let mut hasher = Sha256::new();
    hasher.update(board_serial.as_bytes());
    hasher.update(b":");
    hasher.update(cpu_serial.as_bytes());
    let digest = hasher.finalize();
    Ok(format!("{digest:x}"))
}

#[cfg(not(windows))]
pub fn generate_machine_id() -> Result<String, SecurityError> {
    Err(SecurityError::UnsupportedPlatform)
}

fn cipher() -> Result<Aes256Gcm, SecurityError> {
    let machine_id = generate_machine_id()?;
    let mut key = [0u8; 32];
    pbkdf2::<Hmac<Sha256>>(machine_id.as_bytes(), STATIC_PASSWORD_SALT, 100_000, &mut key);
    Aes256Gcm::new_from_slice(&key).map_err(|_| SecurityError::Crypto)
}

fn encrypt_license(license: &LicenseData) -> Result<Vec<u8>, SecurityError> {
    let payload = serde_json::to_vec(license)?;
    let cipher = cipher()?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, payload.as_ref())
        .map_err(|_| SecurityError::Crypto)?;

    let mut output = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&nonce);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

fn decrypt_license(encrypted: &[u8]) -> Result<LicenseData, SecurityError> {
    if encrypted.len() <= NONCE_SIZE {
        return Err(SecurityError::Crypto);
    }

    let (nonce_bytes, cipher_bytes) = encrypted.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);
    let cipher = cipher()?;
    let plain = cipher
        .decrypt(nonce, cipher_bytes)
        .map_err(|_| SecurityError::Crypto)?;
    Ok(serde_json::from_slice::<LicenseData>(&plain)?)
}

pub fn save_license_file(path: impl AsRef<Path>, license: &LicenseData) -> Result<(), SecurityError> {
    let encrypted = encrypt_license(license)?;
    fs::write(path, encrypted)?;
    Ok(())
}

pub fn load_license_file(path: impl AsRef<Path>) -> Result<LicenseData, SecurityError> {
    let path_ref = path.as_ref();
    if !path_ref.exists() {
        return Err(SecurityError::LicenseMissing(path_ref.display().to_string()));
    }
    let bytes = fs::read(path_ref)?;
    decrypt_license(&bytes)
}

pub fn set_decoy_files_blocked() {
    if let Ok(lock_path) = lock_file_path() {
        let _ = fs::write(lock_path, "BLOCKED");
    }
    if let Ok(flag_path) = flag_file_path() {
        let _ = fs::write(flag_path, r#"{"driver_log_win32": false}"#);
    }
}

pub fn set_decoy_files_allowed() {
    if let Ok(lock_path) = lock_file_path() {
        let _ = fs::write(lock_path, "win32_telemetry.sys");
    }
    if let Ok(flag_path) = flag_file_path() {
        let _ = fs::write(flag_path, r#"{"driver_log_win32": true}"#);
    }
}

pub fn check_decoy_files() -> Result<(), SecurityError> {
    let lock_path = lock_file_path()?;
    let flag_path = flag_file_path()?;

    if !lock_path.exists() || !flag_path.exists() {
        return Err(SecurityError::DecoyError);
    }

    let status = fs::read_to_string(&lock_path).unwrap_or_else(|_| "BLOCKED".to_string());
    let status = status.trim();

    if status == "BLOCKED" || status == "رمز التفعيل مطلوب" {
        return Err(SecurityError::DecoyError);
    }

    Ok(())
}

pub fn initialize_license(max_runs: u32, max_runtime_minutes: u32) -> Result<LicenseData, SecurityError> {
    let machine_id = generate_machine_id()?;
    let path = default_license_path()?;

    let existing_admin_status = if path.exists() {
        if let Ok(existing_data) = load_license_file(&path) {
            existing_data.is_admin_unlocked
        } else {
            false
        }
    } else {
        false
    };

    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs();

    let license = LicenseData {
        machine_id,
        run_count: 0,
        max_runs,
        max_runtime_minutes,
        first_run_time: now,
        last_saved_time: now,
        is_time_tampered: false,
        is_admin_unlocked: existing_admin_status,
    };

    save_license_file(&path, &license)?;
    set_decoy_files_allowed();
    Ok(license)
}

pub fn check_time_tampering_internal(license: &mut LicenseData, path: &Path) -> Result<(), SecurityError> {
    if license.is_time_tampered {
        return Err(SecurityError::TimeTampered);
    }

    let current_boot = get_current_boot_time();
    let expected = *EXPECTED_BOOT_TIME.read().unwrap();
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs();
    
    let mut tampered = false;
    
    // Check for in-memory clock drift (user changed time while app running)
    if current_boot.abs_diff(expected) > 10 {
        tampered = true;
    }
    
    // Check if time moved backwards compared to last saved time
    if now < license.last_saved_time {
        tampered = true;
    }

    if tampered {
        license.is_time_tampered = true;
        let _ = save_license_file(path, license);
        return Err(SecurityError::TimeTampered);
    }

    Ok(())
}

pub fn active_memory_tamper_check() -> bool {
    let current_boot = get_current_boot_time();
    let expected = *EXPECTED_BOOT_TIME.read().unwrap();
    
    if current_boot.abs_diff(expected) > 10 {
        if let Ok(path) = default_license_path() {
            if let Ok(mut license_data) = load_license_file(&path) {
                license_data.is_time_tampered = true;
                let _ = save_license_file(&path, &license_data);
            }
        }
        return true;
    }
    false
}

pub fn verify_and_touch_license() -> Result<LicenseStatus, SecurityError> {
    let machine_id = generate_machine_id()?;
    let path = default_license_path()?;
    
    // Check decoy files first
    if let Err(e) = check_decoy_files() {
        return Err(e);
    }

    let mut license = load_license_file(&path)?;

    check_time_tampering_internal(&mut license, &path)?;

    if license.machine_id != machine_id {
        return Err(SecurityError::HwidMismatch);
    }
    
    if license.run_count >= license.max_runs {
        set_decoy_files_blocked();
        return Err(SecurityError::DecoyError);
    }

    // Update last saved time
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs();
    license.last_saved_time = now;
    let _ = save_license_file(&path, &license);

    Ok(LicenseStatus::Valid(license))
}

pub fn increment_run_count() -> Result<LicenseData, SecurityError> {
    let path = default_license_path()?;
    let mut license = load_license_file(&path)?;
    
    check_time_tampering_internal(&mut license, &path)?;

    if license.run_count >= license.max_runs {
        set_decoy_files_blocked();
        return Err(SecurityError::DecoyError);
    }

    license.run_count += 1;
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs();
    license.last_saved_time = now;
    save_license_file(&path, &license)?;
    Ok(license)
}
