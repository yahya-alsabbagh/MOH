use calamine::{open_workbook_auto, Data, Reader, DataType};
use duckdb::Connection;

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

    // Map headers to indices.
    // A Vec (not a HashMap) so the lookup order is the sheet's column order and
    // therefore deterministic — a HashMap made the same file import differently
    // between runs whenever two headers both matched a keyword.
    let headers: Vec<(String, usize)> = header_row
        .iter()
        .enumerate()
        .filter_map(|(i, cell)| {
            let text = cell.get_string()?;
            let normalized = crate::core::cleaner::normalize_header(text);
            if normalized.is_empty() { None } else { Some((normalized, i)) }
        })
        .collect();

    // Finds a column by name. Exact match wins over a substring match, and
    // `skip_totals` excludes summary headers such as "مجموع الذكور" from
    // matching the plain "ذكور" keyword.
    fn find_col(headers: &[(String, usize)], names: &[&str], skip_totals: bool) -> Option<usize> {
        let eligible = |h: &str| !skip_totals || !h.contains("مجموع");

        // Pass 1: exact match
        for name in names {
            for (header, idx) in headers {
                if header == name && eligible(header) {
                    return Some(*idx);
                }
            }
        }
        // Pass 2: substring fallback
        for name in names {
            for (header, idx) in headers {
                if header.contains(name) && eligible(header) {
                    return Some(*idx);
                }
            }
        }
        None
    }

    let title_idx = find_col(&headers, &["العنوان الوظيفي", "المسمى الوظيفي"], true);
    let grade_idx = find_col(&headers, &["الدرجة الوظيفية", "الدرجة"], true);
    let code_idx = find_col(&headers, &["الرمز الوظيفي", "الرمز"], true);
    let male_idx = find_col(&headers, &["الذكور", "ذكور", "ذكر"], true);
    let female_idx = find_col(&headers, &["الإناث", "الاناث", "إناث", "اناث", "أنثى", "انثى"], true);
    let vacant_idx = find_col(&headers, &["الشواغر", "شواغر", "الشاغر", "شاغر"], true);
    let total_idx = find_col(&headers, &["المجموع", "مجموع", "الكلي"], false);

    // If critical columns are missing, we can still proceed with nulls, but ideally we should have them.
    // Let's just proceed and extract what we can.

    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let mut conn = Connection::open(&db_path).map_err(|e| format!("فشل في الاتصال بقاعدة البيانات: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Check if records for the same ministry/directorate/year already exist
    let parsed_year_check = year.parse::<i32>().unwrap_or(0);
    
    let mut check_stmt = tx.prepare(
        "SELECT COUNT(*) FROM department_metrics WHERE ministry = ? AND directorate = ? AND approval_year = ?"
    ).map_err(|e| e.to_string())?;
    
    let existing_count: i64 = check_stmt.query_row(
        duckdb::params![ministry, directorate, parsed_year_check],
        |row| row.get(0)
    ).unwrap_or(0);
    
    drop(check_stmt);

    if existing_count > 0 {
        return Err("هذه الدائرة لا يمكن ادخالها لانه تم ادخالها مسبقا!".to_string());
    }

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

        // Skip "Total" summary rows by checking EVERY cell in the row (useful for merged cells)
        let skip_keywords = [
            "مجموع كلي", "مجموع درجة", "المجموع الكلي", "المجموع العام", 
            "مجموع الدرجة", "المجموع", "مجموع الدرجه", "مجموع درجه"
        ];
        let mut has_skip_keyword = false;
        for cell in row {
            if let Some(s) = cell.get_string() {
                let clean_s = s.replace("   ", " ").replace("  ", " ").trim().to_string();
                
                // If it is exactly "المجموع"
                if clean_s == "المجموع" {
                    has_skip_keyword = true;
                    break;
                }
                
                // Check if it contains any of the summary phrases
                for kw in skip_keywords.iter() {
                    if clean_s.contains(kw) {
                        has_skip_keyword = true;
                        break;
                    }
                }
                
                // If it starts with "مجموع " (with space) to catch "مجموع التاسعة" etc.
                if clean_s.starts_with("مجموع ") || clean_s.starts_with("المجموع ") {
                    has_skip_keyword = true;
                    break;
                }
            }
            if has_skip_keyword { break; }
        }

        if has_skip_keyword {
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
