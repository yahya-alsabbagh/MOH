use duckdb::{Connection, Result as DbResult};
use std::path::PathBuf;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    pub static ref DB_LOCK: Mutex<()> = Mutex::new(());
}

pub fn get_db_path() -> Result<PathBuf, String> {
    // We use the same app_data_dir location as our license
    // We can rely on tauri's app_data_dir or hardcode similar to license.rs for now.
    // For consistency with license.rs:
    use tauri::utils::platform::current_exe;
    
    // Instead of using project directories which can be complex,
    // let's use the local AppData folder via standard env or similar to license:
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "moh", "auth") {
        let db_dir = proj_dirs.data_dir();
        std::fs::create_dir_all(db_dir).map_err(|e| e.to_string())?;
        Ok(db_dir.join("analytics.db"))
    } else {
        Err("Could not determine app data directory".to_string())
    }
}

pub fn initialize_db() -> Result<(), String> {
    let _lock = DB_LOCK.lock().unwrap();
    let path = get_db_path()?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE SEQUENCE IF NOT EXISTS seq_department_metrics_id;",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS department_metrics (
            id BIGINT PRIMARY KEY DEFAULT nextval('seq_department_metrics_id'),
            ministry VARCHAR,
            directorate VARCHAR,
            approval_year INTEGER,
            job_title VARCHAR,
            job_grade VARCHAR,
            job_code VARCHAR,
            male_count INTEGER,
            female_count INTEGER,
            vacant_count INTEGER,
            total_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
