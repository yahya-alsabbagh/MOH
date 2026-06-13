use duckdb::Connection;
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::database::setup::get_db_path;

// ═══════════════════════════════════════════════════════════════
// Data Structures
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmployeeSummary {
    pub ministry: String,
    pub directorate: String,
    pub approval_year: i32,
    pub employee_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmployeeRecord {
    pub id: i64,
    pub row_number: Option<i32>,
    pub original_name: String,
    pub normalized_name: String,
    pub audit_status: String,
    pub data_columns: serde_json::Map<String, Value>,
}

#[derive(Debug, Serialize)]
pub struct EmployeeDetailsResponse {
    pub records: Vec<EmployeeRecord>,
    pub total_records: usize,
    pub page: usize,
    pub page_size: usize,
    pub all_columns: Vec<String>,
    /// Normalized names that appear more than once (duplicates within this dataset)
    pub duplicate_names: Vec<DuplicateGroup>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DuplicateGroup {
    pub normalized_name: String,
    pub count: i64,
}

/// Result for global cross-department name search
#[derive(Debug, Serialize, Clone)]
pub struct GlobalSearchResult {
    pub normalized_name: String,
    pub occurrences: Vec<GlobalSearchOccurrence>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlobalSearchOccurrence {
    pub ministry: String,
    pub directorate: String,
    pub approval_year: i32,
    pub original_name: String,
    pub row_number: Option<i32>,
    pub data_columns: serde_json::Map<String, Value>,
}

// ═══════════════════════════════════════════════════════════════
// Helper: move الملاحظات to end of column list
// ═══════════════════════════════════════════════════════════════
fn push_notes_column_to_end(columns: &mut Vec<String>) {
    if let Some(pos) = columns.iter().position(|c| c.contains("ملاحظات")) {
        let notes = columns.remove(pos);
        columns.push(notes);
    }
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

pub fn fetch_employees_summary() -> Result<Vec<EmployeeSummary>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ministry, directorate, approval_year,
                    CAST(COUNT(*) AS BIGINT) as employee_count
             FROM employees_master
             GROUP BY ministry, directorate, approval_year
             ORDER BY approval_year DESC, ministry ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(EmployeeSummary {
                ministry: row.get(0)?,
                directorate: row.get(1)?,
                approval_year: row.get(2)?,
                employee_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for item in iter {
        if let Ok(s) = item {
            result.push(s);
        }
    }

    Ok(result)
}

/// Returns paginated employee details + duplicate detection.
pub fn fetch_employee_details(
    ministry: String,
    directorate: String,
    approval_year: i32,
    page: usize,
    page_size: usize,
    search_column: Option<String>,
    search_term: Option<String>,
) -> Result<EmployeeDetailsResponse, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let has_search = search_column.is_some()
        && search_term.as_ref().map_or(false, |t| !t.trim().is_empty());

    let search_col = search_column.unwrap_or_default();
    let search_val = search_term.unwrap_or_default();
    let like_pattern = format!("%{}%", search_val);

    // ── Duplicate detection ──
    let mut dup_stmt = conn
        .prepare(
            "SELECT normalized_name, CAST(COUNT(*) AS BIGINT) as cnt
             FROM employees_master
             WHERE ministry = ? AND directorate = ? AND approval_year = ?
             GROUP BY normalized_name
             HAVING COUNT(*) > 1
             ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;

    let dup_iter = dup_stmt
        .query_map(
            duckdb::params![ministry, directorate, approval_year],
            |row| {
                Ok(DuplicateGroup {
                    normalized_name: row.get(0)?,
                    count: row.get(1)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut duplicate_names = Vec::new();
    for item in dup_iter {
        if let Ok(d) = item {
            duplicate_names.push(d);
        }
    }

    // ── Total count ──
    let total_records: usize = if has_search {
        if search_col == "original_name" || search_col == "normalized_name" {
            let mut stmt = conn.prepare(
                "SELECT COUNT(*) FROM employees_master
                 WHERE ministry = ? AND directorate = ? AND approval_year = ?
                 AND (original_name LIKE ? OR normalized_name LIKE ?)"
            ).map_err(|e| e.to_string())?;
            stmt.query_row(
                duckdb::params![ministry, directorate, approval_year, like_pattern, like_pattern],
                |row| row.get(0),
            ).unwrap_or(0)
        } else {
            let mut stmt = conn.prepare(
                "SELECT COUNT(*) FROM employees_master
                 WHERE ministry = ? AND directorate = ? AND approval_year = ?
                 AND data_columns LIKE ?"
            ).map_err(|e| e.to_string())?;
            stmt.query_row(
                duckdb::params![ministry, directorate, approval_year, like_pattern],
                |row| row.get(0),
            ).unwrap_or(0)
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM employees_master
             WHERE ministry = ? AND directorate = ? AND approval_year = ?"
        ).map_err(|e| e.to_string())?;
        stmt.query_row(
            duckdb::params![ministry, directorate, approval_year],
            |row| row.get(0),
        ).unwrap_or(0)
    };

    // ── Paginated data ──
    let offset = page * page_size;

    let query = if has_search {
        if search_col == "original_name" || search_col == "normalized_name" {
            "SELECT id, row_number, original_name, normalized_name, audit_status, data_columns
             FROM employees_master
             WHERE ministry = ? AND directorate = ? AND approval_year = ?
             AND (original_name LIKE ? OR normalized_name LIKE ?)
             ORDER BY row_number ASC
             LIMIT ? OFFSET ?".to_string()
        } else {
            "SELECT id, row_number, original_name, normalized_name, audit_status, data_columns
             FROM employees_master
             WHERE ministry = ? AND directorate = ? AND approval_year = ?
             AND data_columns LIKE ?
             ORDER BY row_number ASC
             LIMIT ? OFFSET ?".to_string()
        }
    } else {
        "SELECT id, row_number, original_name, normalized_name, audit_status, data_columns
         FROM employees_master
         WHERE ministry = ? AND directorate = ? AND approval_year = ?
         ORDER BY row_number ASC
         LIMIT ? OFFSET ?".to_string()
    };

    let mut data_stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let parse_row = |row: &duckdb::Row| -> duckdb::Result<EmployeeRecord> {
        let json_str: Option<String> = row.get(5)?;
        let data_cols: serde_json::Map<String, Value> = json_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Ok(EmployeeRecord {
            id: row.get(0)?,
            row_number: row.get(1)?,
            original_name: row.get(2)?,
            normalized_name: row.get(3)?,
            audit_status: row.get(4)?,
            data_columns: data_cols,
        })
    };

    let iter = if has_search {
        if search_col == "original_name" || search_col == "normalized_name" {
            data_stmt.query_map(
                duckdb::params![ministry, directorate, approval_year, like_pattern, like_pattern, page_size as i64, offset as i64],
                parse_row,
            ).map_err(|e| e.to_string())?
        } else {
            data_stmt.query_map(
                duckdb::params![ministry, directorate, approval_year, like_pattern, page_size as i64, offset as i64],
                parse_row,
            ).map_err(|e| e.to_string())?
        }
    } else {
        data_stmt.query_map(
            duckdb::params![ministry, directorate, approval_year, page_size as i64, offset as i64],
            parse_row,
        ).map_err(|e| e.to_string())?
    };

    let mut records = Vec::new();
    let mut all_columns: Vec<String> = Vec::new();
    let mut seen_columns = std::collections::HashSet::new();

    for item in iter {
        if let Ok(rec) = item {
            for key in rec.data_columns.keys() {
                if seen_columns.insert(key.clone()) {
                    all_columns.push(key.clone());
                }
            }
            records.push(rec);
        }
    }

    // Always push الملاحظات to end
    push_notes_column_to_end(&mut all_columns);

    Ok(EmployeeDetailsResponse {
        records,
        total_records,
        page,
        page_size,
        all_columns,
        duplicate_names,
    })
}

/// Global search: searches for a name across ALL departments.
pub fn search_employees_globally(
    search_term: String,
) -> Result<Vec<GlobalSearchResult>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let like_pattern = format!("%{}%", search_term);

    let mut stmt = conn
        .prepare(
            "SELECT ministry, directorate, approval_year, row_number,
                    original_name, normalized_name, data_columns
             FROM employees_master
             WHERE original_name LIKE ? OR normalized_name LIKE ?
             ORDER BY normalized_name, ministry, directorate
             LIMIT 500",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(duckdb::params![like_pattern, like_pattern], |row| {
            let json_str: Option<String> = row.get(6)?;
            let data_cols: serde_json::Map<String, Value> = json_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            Ok((
                row.get::<_, String>(0)?,  // ministry
                row.get::<_, String>(1)?,  // directorate
                row.get::<_, i32>(2)?,     // approval_year
                row.get::<_, Option<i32>>(3)?, // row_number
                row.get::<_, String>(4)?,  // original_name
                row.get::<_, String>(5)?,  // normalized_name
                data_cols,
            ))
        })
        .map_err(|e| e.to_string())?;

    // Group by normalized_name
    let mut groups: indexmap::IndexMap<String, Vec<GlobalSearchOccurrence>> =
        indexmap::IndexMap::new();

    for item in iter {
        if let Ok((ministry, directorate, year, row_num, orig_name, norm_name, data_cols)) = item {
            groups
                .entry(norm_name.clone())
                .or_default()
                .push(GlobalSearchOccurrence {
                    ministry,
                    directorate,
                    approval_year: year,
                    original_name: orig_name,
                    row_number: row_num,
                    data_columns: data_cols,
                });
        }
    }

    let results: Vec<GlobalSearchResult> = groups
        .into_iter()
        .map(|(name, occurrences)| GlobalSearchResult {
            normalized_name: name,
            occurrences,
        })
        .collect();

    Ok(results)
}

/// Returns all known column names from the registry.
pub fn fetch_employee_columns() -> Result<Vec<String>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT column_name FROM employee_column_registry ORDER BY column_name")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        if let Ok(name) = row.get::<_, String>(0) {
            result.push(name);
        }
    }

    Ok(result)
}

/// Deletes an employee dataset.
pub fn delete_employee_dataset(
    ministry: String,
    directorate: String,
    approval_year: i32,
) -> Result<usize, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let count = conn
        .execute(
            "DELETE FROM employees_master
             WHERE ministry = ? AND directorate = ? AND approval_year = ?",
            duckdb::params![ministry, directorate, approval_year],
        )
        .map_err(|e| e.to_string())?;

    Ok(count)
}

/// Exports visible employee data to Excel (with search filters applied).
pub fn export_employees_to_excel(
    output_path: String,
    ministry: String,
    directorate: String,
    approval_year: i32,
    search_column: Option<String>,
    search_term: Option<String>,
    page: Option<usize>,
    page_size: Option<usize>,
) -> Result<String, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let has_search = search_column.is_some()
        && search_term.as_ref().map_or(false, |t| !t.trim().is_empty());
    let search_col = search_column.unwrap_or_default();
    let search_val = search_term.unwrap_or_default();
    let like_pattern = format!("%{}%", search_val);

    // Build query — if page/pageSize provided, use them (export visible only)
    let use_pagination = page.is_some() && page_size.is_some();
    let p = page.unwrap_or(0);
    let ps = page_size.unwrap_or(1000000);
    let offset = p * ps;

    let base_where = "WHERE ministry = ? AND directorate = ? AND approval_year = ?";
    let search_clause = if has_search {
        if search_col == "original_name" || search_col == "normalized_name" {
            " AND (original_name LIKE ? OR normalized_name LIKE ?)"
        } else {
            " AND data_columns LIKE ?"
        }
    } else {
        ""
    };

    let pagination_clause = if use_pagination {
        format!(" LIMIT {} OFFSET {}", ps, offset)
    } else {
        String::new()
    };

    let query = format!(
        "SELECT id, row_number, original_name, normalized_name, audit_status, data_columns
         FROM employees_master
         {} {}
         ORDER BY row_number ASC{}",
        base_where, search_clause, pagination_clause
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let parse_row = |row: &duckdb::Row| -> duckdb::Result<EmployeeRecord> {
        let json_str: Option<String> = row.get(5)?;
        let data_cols: serde_json::Map<String, Value> = json_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Ok(EmployeeRecord {
            id: row.get(0)?,
            row_number: row.get(1)?,
            original_name: row.get(2)?,
            normalized_name: row.get(3)?,
            audit_status: row.get(4)?,
            data_columns: data_cols,
        })
    };

    let iter = if has_search {
        if search_col == "original_name" || search_col == "normalized_name" {
            stmt.query_map(
                duckdb::params![ministry, directorate, approval_year, like_pattern, like_pattern],
                parse_row,
            ).map_err(|e| e.to_string())?
        } else {
            stmt.query_map(
                duckdb::params![ministry, directorate, approval_year, like_pattern],
                parse_row,
            ).map_err(|e| e.to_string())?
        }
    } else {
        stmt.query_map(
            duckdb::params![ministry, directorate, approval_year],
            parse_row,
        ).map_err(|e| e.to_string())?
    };

    let mut records = Vec::new();
    let mut all_columns: Vec<String> = Vec::new();
    let mut seen_columns = std::collections::HashSet::new();

    for item in iter {
        if let Ok(rec) = item {
            for key in rec.data_columns.keys() {
                if seen_columns.insert(key.clone()) {
                    all_columns.push(key.clone());
                }
            }
            records.push(rec);
        }
    }

    push_notes_column_to_end(&mut all_columns);

    // ── Build Excel ──────────────────────────────────────────────
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_right_to_left(true);

    let header_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_background_color(Color::RGB(0x1A3A6E))
        .set_font_color(Color::White)
        .set_font_size(11.0);

    let data_fmt = Format::new()
        .set_align(FormatAlign::Right)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);

    let data_num_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);

    ws.set_column_width(0, 5.0).ok();
    ws.write_string_with_format(0, 0, "ت", &header_fmt).ok();
    ws.set_column_width(1, 35.0).ok();
    ws.write_string_with_format(0, 1, "الاسم", &header_fmt).ok();

    for (i, col_name) in all_columns.iter().enumerate() {
        let col = (i + 2) as u16;
        ws.set_column_width(col, 18.0).ok();
        ws.write_string_with_format(0, col, col_name, &header_fmt).ok();
    }

    for (row_idx, rec) in records.iter().enumerate() {
        let r = (row_idx + 1) as u32;
        ws.write_number_with_format(r, 0, rec.row_number.unwrap_or((row_idx + 1) as i32) as f64, &data_num_fmt).ok();
        ws.write_string_with_format(r, 1, &rec.normalized_name, &data_fmt).ok();

        for (col_i, col_name) in all_columns.iter().enumerate() {
            let col = (col_i + 2) as u16;
            if let Some(val) = rec.data_columns.get(col_name) {
                match val {
                    Value::Number(n) => {
                        if let Some(f) = n.as_f64() {
                            ws.write_number_with_format(r, col, f, &data_num_fmt).ok();
                        }
                    }
                    Value::String(s) => {
                        ws.write_string_with_format(r, col, s, &data_fmt).ok();
                    }
                    _ => {
                        ws.write_string_with_format(r, col, &val.to_string(), &data_fmt).ok();
                    }
                }
            }
        }
    }

    wb.save(&output_path)
        .map_err(|e| format!("فشل في حفظ ملف الإكسل: {}", e))?;

    Ok(output_path)
}
