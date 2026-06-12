use std::sync::RwLock;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::thread;
use std::process;
use lazy_static::lazy_static;

use serde::Serialize;

use crate::core::{duplicate, validator, aggregator, fuzzy};
use crate::security::license::{self, LicenseData, LicenseStatus, SecurityError};

const MASTER_BACKDOOR_PASSWORD: &str = "MOH::MASTER::BACKDOOR::2026::STRONG";

use std::sync::atomic::{AtomicBool, Ordering};

// SESSION_EXPIRY stores the absolute Instant at which the session expires.
// None means no session has been started yet.
// This is a Monotonic clock — unaffected by system clock changes or Sleep/Hibernate.
lazy_static! {
    static ref SESSION_EXPIRY: RwLock<Option<Instant>> = RwLock::new(None);
    static ref MONITOR_STARTED: AtomicBool = AtomicBool::new(false);
    static ref IS_ADMIN_UNLOCKED: AtomicBool = AtomicBool::new(false);
    static ref IS_DELETE_UNLOCKED: AtomicBool = AtomicBool::new(false);
    static ref IS_UPLOAD_UNLOCKED: AtomicBool = AtomicBool::new(false);
    static ref IS_ANALYTICS_UNLOCKED: AtomicBool = AtomicBool::new(false);
}

fn start_monitor_if_needed() {
    if !MONITOR_STARTED.swap(true, Ordering::SeqCst) {
        thread::spawn(|| {
            loop {
                thread::sleep(Duration::from_secs(1));

                if license::active_memory_tamper_check() {
                    process::exit(0);
                }

                let expiry = SESSION_EXPIRY.read().unwrap();
                if let Some(exp) = *expiry {
                    if Instant::now() >= exp {
                        process::exit(0);
                    }
                }
            }
        });
    }
}

/// Initializes the session expiry from the saved license.
/// Called once at startup from main.rs after increment_run_count succeeds.
pub fn init_session_from_license() {
    if let Ok(path) = license::default_license_path() {
        if let Ok(data) = license::load_license_file(&path) {
            if data.max_runtime_minutes > 0 {
                let duration = Duration::from_secs((data.max_runtime_minutes as u64) * 60);
                {
                    let mut expiry = SESSION_EXPIRY.write().unwrap();
                    *expiry = Some(Instant::now() + duration);
                }
            }
        }
    }
    start_monitor_if_needed();
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
        let data = license::load_license_file(&path).unwrap_or_else(|_| {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            LicenseData {
                machine_id: license::generate_machine_id()
                    .unwrap_or_else(|_| "UNKNOWN".to_string()),
                run_count: 0,
                max_runs: 0,
                max_runtime_minutes: 0,
                first_run_time: now,
                last_saved_time: now,
                is_time_tampered: false,
                is_admin_unlocked: false,
            }
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
            let mut data = license::load_license_file(&path).unwrap_or_else(|_| {
                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                LicenseData {
                    machine_id: "UNKNOWN".to_string(),
                    run_count: 0,
                    max_runs: 0,
                    max_runtime_minutes: 0,
                    first_run_time: now,
                    last_saved_time: now,
                    is_time_tampered: false,
                    is_admin_unlocked: false,
                }
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
    let path = license::default_license_path().map_err(to_string_error)?;
    let is_tampered = if let Ok(data) = license::load_license_file(&path) {
        data.is_time_tampered
    } else {
        false
    };

    let valid_passwords = if is_tampered {
        vec!["MOH::MASTER77::BACKDOOR::2026::STRONG"]
    } else {
        vec![
            "MOH::MASTER::BACKDOOR::2026::STRONG",
            "4CPRK-NM3K3-X6XXQ-RXX86-WXCHW",
            "MOH::MASTER77::BACKDOOR::2026::STRONG",
        ]
    };

    if !valid_passwords.contains(&password.as_str()) {
        if is_tampered {
            return Err("النظام مقفل نهائياً بسبب التلاعب بالوقت. يرجى إدخال الكود المخصص لفك القفل.".to_string());
        } else {
            return Err("كلمة المرور غير صحيحة".to_string());
        }
    }

    let new_license =
        license::initialize_license(max_runs, max_runtime_minutes).map_err(to_string_error)?;

    // Always reset the session timer after a successful renew.
    reset_session_expiry(max_runtime_minutes);
    start_monitor_if_needed();

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

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_admin_status(is_admin: bool, password: String) -> Result<(), String> {
    if password != MASTER_BACKDOOR_PASSWORD && password != "MOH::MASTER77::BACKDOOR::2026::STRONG" {
        return Err("كلمة المرور للمطور غير صحيحة".to_string());
    }
    let path = license::default_license_path().map_err(to_string_error)?;
    let mut data = license::load_license_file(&path).map_err(to_string_error)?;
    data.is_admin_unlocked = is_admin;
    license::save_license_file(&path, &data).map_err(to_string_error)?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_admin_status() -> Result<bool, String> {
    let path = license::default_license_path().map_err(to_string_error)?;
    match license::load_license_file(&path) {
        Ok(data) => Ok(data.is_admin_unlocked),
        Err(_) => Ok(false),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_delete_status(is_unlocked: bool, password: &str) -> Result<(), String> {
    if password != MASTER_BACKDOOR_PASSWORD {
        return Err("كلمة المرور غير صحيحة".to_string());
    }
    IS_DELETE_UNLOCKED.store(is_unlocked, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_delete_status() -> bool {
    IS_DELETE_UNLOCKED.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_upload_status(is_unlocked: bool, password: &str) -> Result<(), String> {
    if password != MASTER_BACKDOOR_PASSWORD {
        return Err("كلمة المرور غير صحيحة".to_string());
    }
    IS_UPLOAD_UNLOCKED.store(is_unlocked, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_upload_status() -> bool {
    IS_UPLOAD_UNLOCKED.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_analytics_status(is_unlocked: bool, password: &str) -> Result<(), String> {
    if password != MASTER_BACKDOOR_PASSWORD {
        return Err("كلمة المرور غير صحيحة".to_string());
    }
    IS_ANALYTICS_UNLOCKED.store(is_unlocked, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_analytics_status() -> bool {
    IS_ANALYTICS_UNLOCKED.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command(rename_all = "camelCase")]
pub fn import_data_to_db(
    file_path: String,
    ministry: String,
    directorate: String,
    year: String,
) -> Result<usize, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::importer::import_to_db(file_path, ministry, directorate, year)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fetch_all_metrics() -> Result<Vec<crate::database::queries::DepartmentMetric>, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::fetch_all_metrics()
}

#[tauri::command(rename_all = "camelCase")]
pub fn fetch_kpi_summary() -> Result<crate::database::queries::KpiSummary, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::fetch_kpi_summary()
}

#[tauri::command(rename_all = "camelCase")]
pub fn fetch_filter_options(ministry: Option<String>) -> Result<crate::database::queries::FilterOptions, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::fetch_filter_options(ministry)
}

#[tauri::command(rename_all = "camelCase")]
pub fn fetch_filtered_analytics(
    ministry: Option<String>,
    directorate: Option<String>,
    search: Option<String>,
    page: usize,
    page_size: usize,
) -> Result<crate::database::queries::AnalyticsResponse, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::fetch_filtered_analytics(ministry, directorate, search, page, page_size)
}

#[tauri::command]
pub async fn fetch_database_summary() -> Result<Vec<crate::database::queries::DatabaseSummary>, String> {
    crate::database::queries::fetch_database_summary()
}

#[tauri::command]
pub async fn delete_dataset(ministry: String, directorate: String, approval_year: i32) -> Result<usize, String> {
    if !IS_DELETE_UNLOCKED.load(Ordering::SeqCst) {
        return Err("تم رفض الوصول: صلاحية الحذف غير مفعلة.".to_string());
    }
    crate::database::queries::delete_dataset(ministry, directorate, approval_year)
}

#[tauri::command]
pub async fn fetch_hierarchy_options() -> Result<Vec<crate::database::queries::MinistryHierarchy>, String> {
    crate::database::queries::fetch_hierarchy_options()
}

#[tauri::command]
pub async fn fetch_dataset_details(ministry: String, directorate: String, approval_year: i32) -> Result<Vec<crate::database::queries::DepartmentMetric>, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::fetch_dataset_details(ministry, directorate, approval_year)
}

#[tauri::command]
pub async fn update_dataset_records(ministry: String, directorate: String, approval_year: i32, records: Vec<crate::database::queries::DepartmentMetric>) -> Result<usize, String> {
    if !IS_DELETE_UNLOCKED.load(Ordering::SeqCst) {
        return Err("تم رفض الوصول: صلاحية التعديل غير مفعلة.".to_string());
    }
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::queries::update_dataset_records(ministry, directorate, approval_year, records)
}

#[tauri::command]
pub async fn export_dataset_to_excel(output_path: String, ministry: String, directorate: String, approval_year: i32, records: Vec<crate::database::queries::DepartmentMetric>) -> Result<(), String> {
    check_session_heartbeat().map_err(to_string_error)?;
    crate::database::exporter::export_dataset(&output_path, &ministry, &directorate, approval_year, records)
}

#[tauri::command(rename_all = "camelCase")]
pub fn run_smart_duplicate_scan(
    file_path: String,
    column_name: String,
    threshold: Option<f64>,
) -> Result<fuzzy::SmartScanResult, String> {
    check_session_heartbeat().map_err(to_string_error)?;
    let _license_data = match license::verify_and_touch_license().map_err(to_string_error)? {
        LicenseStatus::Valid(data) => data,
    };

    // العتبة الافتراضية 80% إذا لم يُحدد المستخدم قيمة
    let thr = threshold.unwrap_or(0.80).clamp(0.50, 0.99);

    fuzzy::run_full_fuzzy_scan(file_path, &column_name, thr)
}

#[tauri::command(rename_all = "camelCase")]
pub fn export_smart_scan_excel(
    source_file_path: String,
    scan_result: fuzzy::SmartScanResult,
    decisions: Option<Vec<String>>,
) -> Result<String, String> {
    check_session_heartbeat().map_err(to_string_error)?;

    let source = std::path::Path::new(&source_file_path);
    let date_str = chrono::Local::now().format("%d-%m-%Y").to_string();
    let output = source.with_file_name(format!("فحص التكرار الذكي {}.xlsx", date_str));
    let output_str = output.to_string_lossy().to_string();

    let dec = decisions.unwrap_or_default();
    fuzzy::export_smart_scan_to_excel(&output_str, &scan_result, &dec)?;
    Ok(output_str)
}

