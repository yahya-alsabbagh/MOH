use calamine::{open_workbook_auto, Data, Reader, DataType};
use duckdb::Connection;
use std::collections::HashMap;

use super::setup::get_db_path;

pub fn import_to_db(
    file_path: String,
    ministry: String,
    directorate: String,
    year: String,
) -> Result<usize, String> {
    let mut workbook = open_workbook_auto(&file_path).map_err(|e| format!("فشل في فتح الملف: {}", e))?;
    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("ملف الإكسل فارغ".to_string());
    }

    let sheet = workbook
        .worksheet_range(&sheet_names[0])
        .map_err(|e| format!("فشل في قراءة ورقة العمل: {}", e))?;

    let mut rows = sheet.rows();
    let header_row = rows.next().ok_or("الملف لا يحتوي على صف عناوين")?;

    // Map headers to indices
    let mut header_map = HashMap::new();
    for (i, cell) in header_row.iter().enumerate() {
        if let Some(text) = cell.get_string() {
            let normalized = text.trim().replace("\n", " ").replace("  ", " ");
            header_map.insert(normalized, i);
        }
    }

    // Helper to find column index by possible names
    let find_col = |names: &[&str]| -> Option<usize> {
        for name in names {
            for (header, idx) in &header_map {
                if header.contains(name) {
                    return Some(*idx);
                }
            }
        }
        None
    };

    let title_idx = find_col(&["العنوان الوظيفي", "المسمى الوظيفي"]);
    let grade_idx = find_col(&["الدرجة", "الدرجة الوظيفية"]);
    let code_idx = find_col(&["الرمز", "الرمز الوظيفي"]);
    let male_idx = find_col(&["ذكور", "ذكر", "الذكور"]);
    let female_idx = find_col(&["اناث", "إناث", "الاناث", "الإناث", "انثى", "أنثى"]);
    let vacant_idx = find_col(&["شاغر", "الشواغر", "الشاغر", "شواغر"]);
    let total_idx = find_col(&["مجموع", "المجموع", "الكلي"]);

    // If critical columns are missing, we can still proceed with nulls, but ideally we should have them.
    // Let's just proceed and extract what we can.

    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let mut conn = Connection::open(&db_path).map_err(|e| format!("فشل في الاتصال بقاعدة البيانات: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Delete existing records for the same ministry/directorate/year to prevent duplicates
    let parsed_year_check = year.parse::<i32>().unwrap_or(0);
    tx.execute(
        "DELETE FROM department_metrics WHERE ministry = ? AND directorate = ? AND approval_year = ?",
        duckdb::params![ministry, directorate, parsed_year_check],
    ).map_err(|e| e.to_string())?;

    let mut stmt = tx.prepare(
        "INSERT INTO department_metrics (
            ministry, directorate, approval_year,
            job_title, job_grade, job_code,
            male_count, female_count, vacant_count, total_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).map_err(|e| e.to_string())?;

    let parsed_year = parsed_year_check;
    let mut inserted_count = 0;

    let parse_int = |cell: Option<&Data>| -> Option<i32> {
        match cell {
            Some(Data::Int(v)) => Some(*v as i32),
            Some(Data::Float(v)) => Some(*v as i32),
            Some(Data::String(s)) => {
                let trimmed = s.trim();
                if trimmed.is_empty() || trimmed == "-" {
                    Some(0)
                } else {
                    trimmed.parse::<i32>().ok().or(Some(0))
                }
            },
            Some(Data::Empty) => Some(0),
            _ => Some(0),
        }
    };

    let parse_str = |cell: Option<&Data>| -> Option<String> {
        match cell {
            Some(Data::String(s)) => Some(s.trim().to_string()),
            Some(Data::Int(v)) => Some(v.to_string()),
            Some(Data::Float(v)) => Some(v.to_string()),
            _ => None,
        }
    };

    for row in rows {
        let job_title = title_idx.and_then(|i| parse_str(row.get(i)));
        let job_grade = grade_idx.and_then(|i| parse_str(row.get(i)));
        let job_code = code_idx.and_then(|i| parse_str(row.get(i)));
        let male_count = male_idx.and_then(|i| parse_int(row.get(i)));
        let female_count = female_idx.and_then(|i| parse_int(row.get(i)));
        let vacant_count = vacant_idx.and_then(|i| parse_int(row.get(i)));
        let total_count = total_idx.and_then(|i| parse_int(row.get(i)));

        // Skip completely empty rows
        if job_title.is_none() && job_grade.is_none() && job_code.is_none() {
            continue;
        }

        stmt.execute(duckdb::params![
            ministry,
            directorate,
            parsed_year,
            job_title,
            job_grade,
            job_code,
            male_count,
            female_count,
            vacant_count,
            total_count
        ]).map_err(|e| e.to_string())?;

        inserted_count += 1;
    }

    drop(stmt);
    tx.commit().map_err(|e| e.to_string())?;

    Ok(inserted_count)
}
