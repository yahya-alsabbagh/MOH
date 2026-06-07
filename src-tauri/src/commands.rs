use std::sync::RwLock;
use std::time::{Duration, Instant};
use std::thread;
use std::process;
use lazy_static::lazy_static;

use serde::Serialize;

use crate::core::{duplicate, validator, aggregator};
use crate::security::license::{self, LicenseData, LicenseStatus, SecurityError};

const MASTER_BACKDOOR_PASSWORD: &str = "MOH::MASTER::BACKDOOR::2026::STRONG";

// SESSION_EXPIRY stores the absolute Instant at which the session expires.
// None means no session has been started yet.
// This is a Monotonic clock — unaffected by system clock changes or Sleep/Hibernate.
lazy_static! {
    static ref SESSION_EXPIRY: RwLock<Option<Instant>> = RwLock::new(None);
}

/// Initializes the session expiry from the saved license.
/// Called once at startup from main.rs after increment_run_count succeeds.
/// Also spawns a background thread that closes the app when time is up.
pub fn init_session_from_license() {
    if let Ok(path) = license::default_license_path() {
        if let Ok(data) = license::load_license_file(&path) {
            if data.max_runtime_minutes > 0 {
                let duration = Duration::from_secs((data.max_runtime_minutes as u64) * 60);
                {
                    let mut expiry = SESSION_EXPIRY.write().unwrap();
                    *expiry = Some(Instant::now() + duration);
                }
                // Background thread: sleeps exactly for the session duration
                // then forces the app to exit cleanly.
                thread::spawn(move || {
                    thread::sleep(duration);
                    process::exit(0);
                });
            }
        }
    }
}

/// Resets the session to a new expiry (used after renew_license_backdoor).
fn reset_session_expiry(minutes: u32) {
    let mut expiry = SESSION_EXPIRY.write().unwrap();
    if minutes > 0 {
        *expiry = Some(Instant::now() + Duration::from_secs((minutes as u64) * 60));
    } else {
        // 0 minutes means no time limit — clear any previous expiry
        *expiry = None;
    }
}

/// Returns Err(SessionExpired) if the session timer has run out.
/// If no session has been initialized yet, it passes through (no restriction).
fn check_session_heartbeat() -> Result<(), SecurityError> {
    let expiry = SESSION_EXPIRY.read().unwrap();
    if let Some(exp) = *expiry {
        if Instant::now() > exp {
            return Err(SecurityError::SessionExpired);
        }
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct LicenseStatusResponse {
    pub is_valid: bool,
    pub machine_id: String,
    pub run_count: u32,
    pub max_runs: u32,
    pub max_runtime_minutes: u32,
    pub error_msg: Option<String>,
    pub is_decoy_error: bool,
    /// Remaining session seconds (-1 if no limit set)
    pub session_remaining_secs: i64,
}

fn to_string_error(err: SecurityError) -> String {
    err.to_string()
}

fn build_remaining_secs() -> i64 {
    let expiry = SESSION_EXPIRY.read().unwrap();
    match *expiry {
        None => -1, // no time limit
        Some(exp) => {
            let now = Instant::now();
            if now >= exp {
                0
            } else {
                exp.duration_since(now).as_secs() as i64
            }
        }
    }
}

fn locked_response(data: LicenseData, msg: String, is_decoy: bool) -> LicenseStatusResponse {
    LicenseStatusResponse {
        is_valid: false,
        machine_id: data.machine_id,
        run_count: data.run_count,
        max_runs: data.max_runs,
        max_runtime_minutes: data.max_runtime_minutes,
        error_msg: Some(msg),
        is_decoy_error: is_decoy,
        session_remaining_secs: 0,
    }
}

#[tauri::command]
pub fn get_license_status() -> Result<LicenseStatusResponse, String> {
    let path = license::default_license_path().map_err(to_string_error)?;

    // 1. Check session heartbeat first (Monotonic — catches Sleep/Hibernate)
    if let Err(session_err) = check_session_heartbeat() {
        let data = license::load_license_file(&path).unwrap_or_else(|_| LicenseData {
            machine_id: license::generate_machine_id()
                .unwrap_or_else(|_| "UNKNOWN".to_string()),
            run_count: 0,
            max_runs: 0,
            max_runtime_minutes: 0,
        });
        return Ok(locked_response(data, session_err.to_string(), false));
    }

    // 2. Verify license file integrity (HWID, decoy files, quota)
    match license::verify_and_touch_license() {
        Ok(LicenseStatus::Valid(data)) => Ok(LicenseStatusResponse {
            is_valid: true,
            machine_id: data.machine_id,
            run_count: data.run_count,
            max_runs: data.max_runs,
            max_runtime_minutes: data.max_runtime_minutes,
            error_msg: None,
            is_decoy_error: false,
            session_remaining_secs: build_remaining_secs(),
        }),
        Err(e) => {
            let is_decoy = matches!(e, SecurityError::DecoyError);
            let mut data = license::load_license_file(&path).unwrap_or_else(|_| LicenseData {
                machine_id: "UNKNOWN".to_string(),
                run_count: 0,
                max_runs: 0,
                max_runtime_minutes: 0,
            });
            if data.machine_id == "UNKNOWN" {
                if let Ok(hwid) = license::generate_machine_id() {
                    data.machine_id = hwid;
                }
            }
            Ok(locked_response(data, e.to_string(), is_decoy))
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn renew_license_backdoor(
    password: String,
    max_runs: u32,
    max_runtime_minutes: u32,
) -> Result<LicenseStatusResponse, String> {
    if password != MASTER_BACKDOOR_PASSWORD && password != "4CPRK-NM3K3-X6XXQ-RXX86-WXCHW" {
        return Err("invalid master password".to_string());
    }

    let new_license =
        license::initialize_license(max_runs, max_runtime_minutes).map_err(to_string_error)?;

    // Always reset the session timer after a successful renew.
    // Also respawn the shutdown thread for the new duration.
    reset_session_expiry(max_runtime_minutes);
    if max_runtime_minutes > 0 {
        let duration = Duration::from_secs((max_runtime_minutes as u64) * 60);
        thread::spawn(move || {
            thread::sleep(duration);
            process::exit(0);
        });
    }

    Ok(LicenseStatusResponse {
        is_valid: true,
        machine_id: new_license.machine_id,
        run_count: new_license.run_count,
        max_runs: new_license.max_runs,
        max_runtime_minutes: new_license.max_runtime_minutes,
        error_msg: None,
        is_decoy_error: false,
        session_remaining_secs: build_remaining_secs(),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn run_duplicate_check(file_path: String, column_name: String) -> Result<String, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    let _license_data = match license::verify_and_touch_license().map_err(to_string_error)? {
        LicenseStatus::Valid(data) => data,
    };
    duplicate::find_duplicates(file_path, column_name).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn run_title_validation(
    work_file: String,
    title_col: String,
    grade_col: String,
) -> Result<String, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    let _license_data = match license::verify_and_touch_license().map_err(to_string_error)? {
        LicenseStatus::Valid(data) => data,
    };
    validator::validate_titles_and_grades_file(work_file, &title_col, &grade_col)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn read_excel_headers(file_path: String) -> Result<Vec<String>, String> {
    duplicate::read_headers(file_path).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_reference_data() -> Result<Vec<validator::ReferenceJob>, String> {
    validator::get_embedded_reference_jobs()
}

#[tauri::command(rename_all = "camelCase")]
pub fn run_aggregation(file_path: String) -> Result<String, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    let _license_data = match license::verify_and_touch_license().map_err(to_string_error)? {
        LicenseStatus::Valid(data) => data,
    };
    aggregator::run_aggregation_file(file_path).map_err(|e| e.to_string())
}
