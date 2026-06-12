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

    conn.execute_batch(
        "DROP TABLE IF EXISTS hierarchy_lookup;
        CREATE TABLE IF NOT EXISTS hierarchy_lookup (
            ministry_code INTEGER,
            ministry_name VARCHAR,
            dept_code INTEGER,
            dept_name VARCHAR
        )",
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

        // Pass 1: Collect ministry names from قسم 1 rows.
        // قسم 1 is always the "head" of a باب.
        // If the title contains '/', the part before '/' is the ministry name.
        let mut ministry_names: std::collections::HashMap<i32, String> = std::collections::HashMap::new();
        for row in sheet.rows() {
            if row.len() >= 3 {
                let dept_code = row[0].get_int().or_else(|| row[0].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let ministry_code = row[1].get_int().or_else(|| row[1].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let title = row[2].get_string().unwrap_or("").trim().to_string();

                if dept_code == 1 && ministry_code > 0 && !title.is_empty() {
                    let min_name = if title.contains('/') {
                        title.split('/').next().unwrap_or("").trim().to_string()
                    } else {
                        title.clone()
                    };
                    ministry_names.insert(ministry_code, min_name);
                }
            }
        }

        // Pass 2: Insert rows into hierarchy_lookup.
        for row in sheet.rows() {
            if row.len() >= 3 {
                let dept_code = row[0].get_int().or_else(|| row[0].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let ministry_code = row[1].get_int().or_else(|| row[1].get_float().map(|f| f as i64)).unwrap_or(0) as i32;
                let title = row[2].get_string().unwrap_or("").trim().to_string();

                if ministry_code <= 0 || dept_code <= 0 || title.is_empty() || title == "العنــــــــــــــوان" {
                    continue;
                }

                if ministry_code == 43 {
                    // باب 43: Every row is an independent entity.
                    // Use a synthetic ministry_code (dept_code * 100 + 43) to keep them separate.
                    let synthetic_code = dept_code * 100 + 43;
                    appender.append_row(duckdb::params![
                        synthetic_code,
                        title.clone(),
                        dept_code,
                        title.clone()
                    ]).map_err(|e| e.to_string())?;
                } else {
                    // Normal باب: group under the ministry from Pass 1.
                    let min_name = ministry_names.get(&ministry_code)
                        .cloned()
                        .unwrap_or_else(|| title.clone());

                    appender.append_row(duckdb::params![
                        ministry_code,
                        min_name,
                        dept_code,
                        title
                    ]).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
