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
    let mut conn = Connection::open(&path).map_err(|e| e.to_string())?;
    
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS hierarchy_lookup (
            ministry_code INTEGER,
            ministry_name VARCHAR,
            dept_code INTEGER,
            dept_name VARCHAR
        )",
        [],
    ).map_err(|e| e.to_string())?;

    seed_hierarchy_lookup(&mut conn)?;

    Ok(())
}

fn seed_hierarchy_lookup(conn: &mut Connection) -> Result<(), String> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM hierarchy_lookup").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let count: i64 = row.get(0).unwrap_or(0);
        if count > 0 {
            return Ok(());
        }
    }

    let bytes = include_bytes!("../../data/Administrative_tab.xlsx");
    let cursor = std::io::Cursor::new(bytes);
    
    use calamine::{Reader, open_workbook_auto_from_rs, DataType};
    let mut workbook = open_workbook_auto_from_rs(cursor).map_err(|e| e.to_string())?;
    
    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("No sheets found in Administrative_tab.xlsx".to_string());
    }

    let sheet = workbook.worksheet_range(&sheet_names[0]).map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    {
        let mut appender = tx.appender("hierarchy_lookup").map_err(|e| e.to_string())?;
        
        // Pass 1: Collect ministry names (where dept_code/Qism == 1)
        let mut ministry_names = std::collections::HashMap::new();
        for row in sheet.rows() {
            if row.len() >= 3 {
                let dept_code = row[0].get_int().or_else(|| row[0].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let ministry_code = row[1].get_int().or_else(|| row[1].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let title = row[2].get_string().unwrap_or("").trim().to_string();
                
                if dept_code == 1 && !title.is_empty() {
                    // Split by slash if needed, e.g. "وزارة المالية/مركز الوزارة" -> "وزارة المالية"
                    let parts: Vec<&str> = title.split('/').collect();
                    ministry_names.insert(ministry_code, parts[0].trim().to_string());
                }
            }
        }

        // Pass 2: Insert rows
        for row in sheet.rows() {
            if row.len() >= 3 {
                let dept_code = row[0].get_int().or_else(|| row[0].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let ministry_code = row[1].get_int().or_else(|| row[1].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let dept_name = row[2].get_string().unwrap_or("").trim().to_string();
                
                if ministry_code > 0 && dept_code > 0 && !dept_name.is_empty() && dept_name != "العنــــــــــــــوان" {
                    let min_name = ministry_names.get(&ministry_code)
                        .cloned()
                        .unwrap_or_else(|| "جهة غير معروفة".to_string());
                    
                    appender.append_row(duckdb::params![
                        ministry_code,
                        min_name,
                        dept_code,
                        dept_name
                    ]).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
