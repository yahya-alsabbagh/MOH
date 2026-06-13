use calamine::{open_workbook_auto, Data, DataType, Reader};
use duckdb::Connection;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

use super::setup::get_db_path;
use crate::core::cleaner::normalize_arabic_name;

/// Converts a calamine cell to a JSON Value, preserving data types.
fn cell_to_json_value(cell: &Data) -> Value {
    match cell {
        Data::Int(v) => json!(*v),
        Data::Float(v) => {
            if v.is_finite() {
                json!(*v)
            } else {
                Value::Null
            }
        }
        Data::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                Value::Null
            } else {
                json!(trimmed)
            }
        }
        Data::Bool(b) => json!(*b),
        Data::DateTime(dt) => json!(dt.to_string()),
        Data::DateTimeIso(s) => json!(s.clone()),
        Data::DurationIso(s) => json!(s.clone()),
        Data::Empty => Value::Null,
        Data::Error(_) => Value::Null,
    }
}

/// Converts a calamine cell to a display string (for the name column).
fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.trim().to_string(),
        Data::Int(v) => v.to_string(),
        Data::Float(v) => {
            if v.fract() == 0.0 {
                (*v as i64).to_string()
            } else {
                v.to_string()
            }
        }
        Data::Bool(v) => v.to_string(),
        Data::DateTime(v) => v.to_string(),
        Data::DateTimeIso(v) => v.clone(),
        Data::DurationIso(v) => v.clone(),
        _ => String::new(),
    }
}

/// Imports an employee Excel file into the employees_master table.
///
/// - `name_column`: the exact header name of the employee name column (chosen by user).
/// - `column_mapping`: optional renaming map {original_excel_header -> final_name}.
///   If a header is in this map, the final (renamed) name is used for storage.
///   If not, the original header is used as-is.
pub fn import_employees_to_db(
    file_path: String,
    ministry: String,
    directorate: String,
    year: String,
    name_column: String,
    column_mapping: Option<HashMap<String, String>>,
) -> Result<usize, String> {
    let mapping = column_mapping.unwrap_or_default();

    // ── 1. Open Excel ──────────────────────────────────────────
    let mut workbook = open_workbook_auto(&file_path)
        .map_err(|e| format!("فشل في فتح الملف: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("ملف الإكسل فارغ".to_string());
    }

    let sheet = workbook
        .worksheet_range(&sheet_names[0])
        .map_err(|e| format!("فشل في قراءة ورقة العمل: {}", e))?;

    let mut rows = sheet.rows();
    let header_row = rows.next().ok_or("الملف لا يحتوي على صف عناوين")?;

    // ── 2. Parse headers ───────────────────────────────────────
    let headers: Vec<String> = header_row
        .iter()
        .map(|cell| {
            cell.get_string()
                .unwrap_or("")
                .trim()
                .replace('\n', " ")
                .replace("  ", " ")
        })
        .collect();

    // Find the name column index
    let name_idx = headers
        .iter()
        .position(|h| h == &name_column)
        .ok_or_else(|| format!("عمود الاسم '{}' غير موجود في الملف", name_column))?;

    // Build list of data column indices (all columns except name column)
    // Apply the mapping: if header has a mapping entry, use the mapped name
    let data_columns: Vec<(usize, String)> = headers
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != name_idx)
        .filter(|(_, h)| !h.is_empty())
        .map(|(i, h)| {
            let final_name = mapping.get(h).cloned().unwrap_or_else(|| h.clone());
            (i, final_name)
        })
        .collect();

    let parsed_year = year.parse::<i32>().unwrap_or(0);

    // ── 3. Connect to DB ───────────────────────────────────────
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("فشل في الاتصال بقاعدة البيانات: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // ── 4. Register new column names ───────────────────────────
    {
        let mut reg_stmt = tx
            .prepare("INSERT OR IGNORE INTO employee_column_registry (column_name) VALUES (?)")
            .map_err(|e| e.to_string())?;
        for (_, col_name) in &data_columns {
            reg_stmt
                .execute(duckdb::params![col_name])
                .map_err(|e| e.to_string())?;
        }
        drop(reg_stmt);
    }

    // ── 5. Insert rows (Immutable Ledger — no duplicate checks) ─
    let mut insert_stmt = tx
        .prepare(
            "INSERT INTO employees_master (
                ministry, directorate, approval_year, row_number,
                original_name, normalized_name, data_columns
            ) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .map_err(|e| e.to_string())?;

    let mut inserted_count: usize = 0;

    for (row_num, row) in rows.enumerate() {
        // Extract name (Data Assumption: Excel is 100% clean, no empty name checks)
        let original_name = row
            .get(name_idx)
            .map(cell_to_string)
            .unwrap_or_default();

        let normalized = normalize_arabic_name(&original_name);

        // Build JSON object for all other columns, preserving data types
        let mut json_map = Map::new();
        for (col_idx, col_name) in &data_columns {
            if let Some(cell) = row.get(*col_idx) {
                let val = cell_to_json_value(cell);
                if !val.is_null() {
                    json_map.insert(col_name.clone(), val);
                }
            }
        }
        let json_str = Value::Object(json_map).to_string();

        insert_stmt
            .execute(duckdb::params![
                ministry,
                directorate,
                parsed_year,
                (row_num + 1) as i32, // 1-indexed row number
                original_name,
                normalized,
                json_str
            ])
            .map_err(|e| e.to_string())?;

        inserted_count += 1;
    }

    drop(insert_stmt);
    tx.commit().map_err(|e| e.to_string())?;

    Ok(inserted_count)
}

/// Checks Excel headers against the employee_column_registry using fuzzy matching.
/// Returns a list of alignment suggestions for the frontend modal.
pub fn align_employee_columns(
    headers: Vec<String>,
    name_column: String,
) -> Result<Vec<ColumnAlignment>, String> {
    use rapidfuzz::distance::jaro_winkler;

    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Fetch all known column names from registry
    let mut stmt = conn
        .prepare("SELECT column_name FROM employee_column_registry ORDER BY column_name")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

    let mut registry: Vec<String> = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        if let Ok(name) = row.get::<_, String>(0) {
            registry.push(name);
        }
    }
    drop(rows);
    drop(stmt);

    if registry.is_empty() {
        // First upload ever — no alignment needed
        return Ok(Vec::new());
    }

    let threshold = 0.75;
    let mut results: Vec<ColumnAlignment> = Vec::new();

    for header in &headers {
        // Skip the name column — it's not a data column
        if header == &name_column || header.is_empty() {
            continue;
        }

        // Check exact match first
        if registry.iter().any(|r| r == header) {
            // Exact match — no action needed
            continue;
        }

        // Fuzzy match against all registry entries
        let mut best_match: Option<(String, f64)> = None;
        for reg_name in &registry {
            let sim = jaro_winkler::similarity(header.chars(), reg_name.chars());
            if sim >= threshold {
                if best_match.as_ref().map_or(true, |(_, s)| sim > *s) {
                    best_match = Some((reg_name.clone(), sim));
                }
            }
        }

        if let Some((suggested, similarity)) = best_match {
            results.push(ColumnAlignment {
                original: header.clone(),
                suggested: Some(suggested),
                similarity: (similarity * 100.0).round(),
                is_new: false,
            });
        }
        // If no match at all, it's a new column — no alignment needed, it'll be added fresh
    }

    Ok(results)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ColumnAlignment {
    pub original: String,
    pub suggested: Option<String>,
    pub similarity: f64,
    pub is_new: bool,
}
