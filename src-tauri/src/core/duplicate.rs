use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::Path;

use calamine::{open_workbook_auto, Data, Reader};
use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};
use chrono::Local;
use zip::ZipArchive;
use quick_xml::Reader as XmlReader;
use quick_xml::events::Event;

use crate::core::models::Employee;

#[derive(Debug, thiserror::Error)]
pub enum DuplicateError {
    #[error("failed to read workbook: {0}")]
    WorkbookRead(#[from] calamine::Error),
    #[error("input workbook contains no sheets")]
    EmptyWorkbook,
    #[error("missing header row in first sheet")]
    MissingHeader,
    #[error("column '{0}' not found in sheet headers")]
    ColumnNotFound(String),
    #[error("failed to write output workbook: {0}")]
    WorkbookWrite(#[from] rust_xlsxwriter::XlsxError),
}

#[derive(Debug, Clone)]
pub struct DuplicateCheckResult {
    pub output_path: String,
    pub total_rows: usize,
    pub duplicate_rows: usize,
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(v) => v.clone(),
        Data::Float(v) => {
            if v.fract() == 0.0 {
                (*v as i64).to_string()
            } else {
                v.to_string()
            }
        }
        Data::Int(v) => v.to_string(),
        Data::Bool(v) => v.to_string(),
        Data::DateTime(v) => v.to_string(),
        Data::DateTimeIso(v) => v.clone(),
        Data::DurationIso(v) => v.clone(),
        Data::Error(v) => v.to_string(),
    }
}

fn row_to_vec(row: &[Data], columns_len: usize) -> Vec<String> {
    (0..columns_len)
        .map(|idx| row.get(idx).map(cell_to_string).unwrap_or_default())
        .collect()
}

fn employee_from_row(headers: &[String], row: &[String]) -> Employee {
    let get = |name: &str| -> String {
        headers
            .iter()
            .position(|h| h == name)
            .and_then(|idx| row.get(idx))
            .cloned()
            .unwrap_or_default()
    };

    Employee {
        raw_name: get("الاسم"),
        cleaned_name: String::new(),
        raw_title: get("العنوان الوظيفي"),
        cleaned_title: String::new(),
        raw_grade: get("الدرجة الوظيفية"),
        cleaned_grade: String::new(),
        job_code: get("الرمز الوظيفي"),
        is_duplicate: true,
    }
}

pub fn get_hidden_columns(path: &Path) -> HashSet<usize> {
    let mut hidden_cols = HashSet::new();
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return hidden_cols,
    };
    let mut archive = match ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return hidden_cols,
    };
    let mut sheet_file = match archive.by_name("xl/worksheets/sheet1.xml") {
        Ok(f) => f,
        Err(_) => return hidden_cols,
    };
    let mut xml_content = String::new();
    if sheet_file.read_to_string(&mut xml_content).is_err() {
        return hidden_cols;
    }
    let mut reader = XmlReader::from_str(&xml_content);
    reader.trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                if e.name().as_ref() == b"col" {
                    let mut is_hidden = false;
                    let mut min_val = None;
                    let mut max_val = None;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"hidden" && attr.value.as_ref() == b"1" {
                            is_hidden = true;
                        } else if attr.key.as_ref() == b"min" {
                            if let Ok(s) = std::str::from_utf8(attr.value.as_ref()) {
                                min_val = s.parse::<usize>().ok();
                            }
                        } else if attr.key.as_ref() == b"max" {
                            if let Ok(s) = std::str::from_utf8(attr.value.as_ref()) {
                                max_val = s.parse::<usize>().ok();
                            }
                        }
                    }
                    if is_hidden {
                        if let (Some(min), Some(max)) = (min_val, max_val) {
                            for col in min..=max {
                                if col > 0 {
                                    hidden_cols.insert(col - 1);
                                }
                            }
                        }
                    }
                }
            },
            Ok(Event::Eof) | Err(_) => break,
            _ => (),
        }
        buf.clear();
    }
    hidden_cols
}

pub fn extract_duplicates_keep_false(
    input_file: impl AsRef<Path>,
    output_file: impl AsRef<Path>,
    duplicate_column_name: &str,
) -> Result<DuplicateCheckResult, DuplicateError> {
    let mut workbook = open_workbook_auto(input_file.as_ref())?;
    let first_sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or(DuplicateError::EmptyWorkbook)?;
    let range = workbook.worksheet_range(&first_sheet_name)?;

    let mut rows_iter = range.rows();
    let headers_row = rows_iter.next().ok_or(DuplicateError::MissingHeader)?;
    let headers: Vec<String> = headers_row.iter().map(cell_to_string).collect();

    let duplicate_col_idx = headers
        .iter()
        .position(|h| h == duplicate_column_name)
        .ok_or_else(|| DuplicateError::ColumnNotFound(duplicate_column_name.to_string()))?;

    let hidden_cols = get_hidden_columns(input_file.as_ref());

    let mut output_headers = Vec::new();
    let mut orig_col_mapping = Vec::new();
    let mut insert_idx = 0;

    for (i, h) in headers.iter().enumerate() {
        if !hidden_cols.contains(&i) {
            output_headers.push(h.clone());
            orig_col_mapping.push(i);
            if i == duplicate_col_idx {
                output_headers.push("الاسم المكرر".to_string());
                output_headers.push("الاسم الثلاثي المكرر".to_string());
                insert_idx = output_headers.len() - 3;
            }
        }
    }

    let mut all_rows: Vec<(Vec<String>, String, String)> = Vec::new();
    let mut grouped_original: HashMap<String, Vec<usize>> = HashMap::new();
    let mut grouped_triple: HashMap<String, Vec<usize>> = HashMap::new();

    for row in rows_iter {
        let normalized_row = row_to_vec(row, headers.len());
        let original_name = normalized_row
            .get(duplicate_col_idx)
            .cloned()
            .unwrap_or_default()
            .trim()
            .to_string();

        // توحيد الاسم العربي باستخدام خط الأنابيب المتقدم
        let normalized_name = crate::core::cleaner::normalize_arabic_name(&original_name);

        let words: Vec<&str> = normalized_name.split_whitespace().collect();
        let triple_name = words.iter().take(3).cloned().collect::<Vec<_>>().join(" ");

        let row_idx = all_rows.len();

        if !original_name.is_empty() {
            // Full name: uses normalized original (alef + whitespace normalization only)
            grouped_original.entry(normalized_name.clone()).or_default().push(row_idx);
            // Triple: first 3 words of normalized name
            grouped_triple.entry(triple_name.clone()).or_default().push(row_idx);
        }

        all_rows.push((normalized_row, normalized_name, triple_name));
    }

    let mut full_duplicate_flags = vec![false; all_rows.len()];
    let mut triple_duplicate_flags = vec![false; all_rows.len()];

    for group in grouped_original.values() {
        if group.len() > 1 {
            for &idx in group {
                full_duplicate_flags[idx] = true;
            }
        }
    }

    for group in grouped_triple.values() {
        if group.len() > 1 {
            for &idx in group {
                triple_duplicate_flags[idx] = true;
            }
        }
    }

    let total_rows_count = all_rows.len();
    let mut duplicates: Vec<(Employee, Vec<String>)> = all_rows
        .into_iter()
        .enumerate()
        .filter_map(|(i, (row, cleaned, triple))| {
            let is_full_dup = full_duplicate_flags[i];
            let is_triple_dup = triple_duplicate_flags[i];
            
            if is_full_dup || is_triple_dup {
                let mut out_row = Vec::new();
                for &orig_idx in &orig_col_mapping {
                    out_row.push(row.get(orig_idx).cloned().unwrap_or_default());
                    if orig_idx == duplicate_col_idx {
                        if is_full_dup {
                            out_row.push(cleaned.clone());
                        } else {
                            out_row.push(String::new());
                        }
                        out_row.push(triple.clone());
                    }
                }
                Some((employee_from_row(&headers, &row), out_row))
            } else {
                None
            }
        })
        .collect();

    duplicates.sort_by(|a, b| {
        let val_a1 = a.1.get(insert_idx + 1).unwrap_or(&String::new()).to_lowercase();
        let val_b1 = b.1.get(insert_idx + 1).unwrap_or(&String::new()).to_lowercase();
        
        match (val_a1.is_empty(), val_b1.is_empty()) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => {
                let cmp1 = val_a1.cmp(&val_b1);
                if cmp1 == std::cmp::Ordering::Equal {
                    let val_a2 = a.1.get(insert_idx + 2).unwrap_or(&String::new()).to_lowercase();
                    let val_b2 = b.1.get(insert_idx + 2).unwrap_or(&String::new()).to_lowercase();
                    val_a2.cmp(&val_b2)
                } else {
                    cmp1
                }
            }
        }
    });

    let mut out_wb = Workbook::new();
    let worksheet = out_wb.add_worksheet();
    worksheet.set_right_to_left(true);

    let mut col_widths: Vec<usize> = output_headers.iter().map(|h| h.chars().count()).collect();
    for (_employee, values) in &duplicates {
        for (col, value) in values.iter().enumerate() {
            let len = value.chars().count();
            if col < col_widths.len() && len > col_widths[col] {
                col_widths[col] = len;
            }
        }
    }

    for (col, width) in col_widths.iter().enumerate() {
        let excel_width = std::cmp::max(12, width + 4) as f64;
        worksheet.set_column_width(col as u16, excel_width)?;
    }

    let header_format = Format::new().set_bold().set_align(FormatAlign::Right);
    let default_format = Format::new().set_align(FormatAlign::Right);
    
    let normalized_format = Format::new()
        .set_align(FormatAlign::Right)
        .set_background_color(Color::RGB(0xE0F7FA)); // Light Blue
        
    let triple_format = Format::new()
        .set_align(FormatAlign::Right)
        .set_background_color(Color::RGB(0xE8F5E9)); // Light Green

    let header_normalized_format = Format::new().set_bold().set_align(FormatAlign::Right).set_background_color(Color::RGB(0xB2EBF2));
    let header_triple_format = Format::new().set_bold().set_align(FormatAlign::Right).set_background_color(Color::RGB(0xC8E6C9));

    for (col, header) in output_headers.iter().enumerate() {
        let mut fmt = &header_format;
        if col == insert_idx + 1 {
            fmt = &header_normalized_format;
        } else if col == insert_idx + 2 {
            fmt = &header_triple_format;
        }
        worksheet.write_string_with_format(0, col as u16, header, fmt)?;
    }

    let mut out_row = 1u32;
    for (_employee, values) in &duplicates {
        for (col, value) in values.iter().enumerate() {
            let mut fmt = &default_format;
            if col == insert_idx + 1 {
                fmt = &normalized_format;
            } else if col == insert_idx + 2 {
                fmt = &triple_format;
            }
            worksheet.write_string_with_format(out_row, col as u16, value, fmt)?;
        }
        out_row += 1;
    }

    out_wb.save(output_file.as_ref())?;

    Ok(DuplicateCheckResult {
        output_path: output_file.as_ref().to_string_lossy().to_string(),
        total_rows: total_rows_count,
        duplicate_rows: duplicates.len(),
    })
}

pub fn read_headers(file_path: impl AsRef<Path>) -> Result<Vec<String>, DuplicateError> {
    let mut workbook = open_workbook_auto(file_path)?;
    let first_sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or(DuplicateError::EmptyWorkbook)?;
    let range = workbook.worksheet_range(&first_sheet_name)?;
    let headers_row = range.rows().next().ok_or(DuplicateError::MissingHeader)?;
    let headers: Vec<String> = headers_row
        .iter()
        .map(cell_to_string)
        .filter(|h| !h.trim().is_empty())
        .collect();
    Ok(headers)
}

pub fn find_duplicates(
    input_file: impl AsRef<Path>,
    column_name: impl AsRef<str>,
) -> Result<String, DuplicateError> {
    let input = input_file.as_ref();
    let date_str = Local::now().format("%d-%m-%Y").to_string();
    let output = input.with_file_name(format!("ملف فحص التكرار {}.xlsx", date_str));

    let result = extract_duplicates_keep_false(input, &output, column_name.as_ref())?;
    Ok(result.output_path)
}
