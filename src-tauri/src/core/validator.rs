use std::collections::HashMap;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use std::io::Cursor;
use calamine::{open_workbook_auto, open_workbook_auto_from_rs, Data, Reader};
use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};
use chrono::Local;

use crate::core::cleaner::{clean_job_grade_column, clean_job_title_column};
use crate::core::models::Employee;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceJob {
    pub title: String,
    pub grade: String,
    #[serde(rename = "jobCode")]
    pub job_code: String,
}

pub const EMBEDDED_JOB_TITLES: &[u8] = include_bytes!("../../data/job_titles.xlsx");

pub fn get_embedded_reference_jobs() -> Result<Vec<ReferenceJob>, String> {
    let cursor = Cursor::new(EMBEDDED_JOB_TITLES);
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .map_err(|e| format!("Failed to open embedded workbook: {}", e))?;
        
    let first_sheet = workbook.sheet_names().first().cloned()
        .ok_or("No sheets in embedded workbook".to_string())?;
        
    let range = workbook.worksheet_range(&first_sheet)
        .map_err(|e| format!("Failed to read sheet: {}", e))?;
        
    let mut rows = range.rows();
    let header = rows.next().ok_or("No header row")?;
    
    let headers: Vec<String> = header.iter().map(cell_to_string).collect();
    
    let title_idx = headers.iter().position(|h| h == "العنوان الوظيفي").ok_or("Missing 'العنوان الوظيفي' column")?;
    let grade_idx = headers.iter().position(|h| h == "الدرجة الوظيفية").ok_or("Missing 'الدرجة الوظيفية' column")?;
    // Code is optional
    let code_idx = headers.iter().position(|h| h == "الرمز الوظيفي");
    
    let mut jobs = Vec::new();
    for row in rows {
        let title = row.get(title_idx).map(cell_to_string).unwrap_or_default();
        let grade = row.get(grade_idx).map(cell_to_string).unwrap_or_default();
        let job_code = code_idx.and_then(|idx| row.get(idx)).map(cell_to_string).unwrap_or_default();
        
        if !title.is_empty() {
            jobs.push(ReferenceJob {
                title,
                grade,
                job_code,
            });
        }
    }
    
    Ok(jobs)
}



#[derive(Debug, thiserror::Error)]
pub enum ValidatorError {
    #[error("failed to read workbook: {0}")]
    WorkbookRead(#[from] calamine::Error),
    #[error("input workbook contains no sheets")]
    EmptyWorkbook,
    #[error("missing header row in first sheet")]
    MissingHeader,
    #[error("column '{0}' not found in sheet headers")]
    ColumnNotFound(String),
    #[error("cleaning failed: {0}")]
    Cleaning(String),
    #[error("failed to write output workbook: {0}")]
    WorkbookWrite(#[from] rust_xlsxwriter::XlsxError),
}

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub output_path: String,
    pub total_rows: usize,
    pub title_mismatches: usize,
    pub grade_mismatches: usize,
    pub fully_matched_rows: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationProgress {
    pub phase: String,
    pub processed: usize,
    pub total: usize,
}

struct ValidationRow {
    original_row: Vec<String>,
    employee: Employee,
    highlight_title: bool,
    highlight_grade: bool,
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

fn read_sheet_as_strings(path: &Path) -> Result<(Vec<String>, Vec<Vec<String>>), ValidatorError> {
    let mut workbook = open_workbook_auto(path)?;
    let first_sheet = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or(ValidatorError::EmptyWorkbook)?;
    let range = workbook.worksheet_range(&first_sheet)?;

    let mut rows = range.rows();
    let headers = rows
        .next()
        .ok_or(ValidatorError::MissingHeader)?
        .iter()
        .map(cell_to_string)
        .collect::<Vec<_>>();

    let data_rows = rows
        .map(|row| {
            (0..headers.len())
                .map(|idx| row.get(idx).map(cell_to_string).unwrap_or_default())
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    Ok((headers, data_rows))
}

pub fn validate_titles_and_grades(
    work_file_path: impl AsRef<Path>,
    output_file_path: impl AsRef<Path>,
    title_col: &str,
    grade_col: &str,
    progress_fn: &(dyn Fn(ValidationProgress) + Sync),
) -> Result<ValidationResult, ValidatorError> {
    progress_fn(ValidationProgress {
        phase: "reading".to_string(),
        processed: 0,
        total: 0,
    });

    let file_name = work_file_path.as_ref().file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let is_military = file_name.contains("عسكري");

    let (work_headers, work_rows) = read_sheet_as_strings(work_file_path.as_ref())?;
    let total_rows = work_rows.len();

    let title_idx = work_headers
        .iter()
        .position(|h| h == title_col)
        .ok_or_else(|| ValidatorError::ColumnNotFound(title_col.to_string()))?;
    let grade_idx = work_headers
        .iter()
        .position(|h| h == grade_col)
        .ok_or_else(|| ValidatorError::ColumnNotFound(grade_col.to_string()))?;

    let reference_jobs = get_embedded_reference_jobs().unwrap_or_default();

    let mut primary_titles: HashMap<String, Vec<(String, String)>> = HashMap::new();
    for job in reference_jobs {
        primary_titles
            .entry(job.title)
            .or_default()
            .push((job.grade, job.job_code));
    }

    let mut validated_rows: Vec<ValidationRow> = Vec::with_capacity(work_rows.len());
    let mut title_mismatches = 0usize;
    let mut grade_mismatches = 0usize;
    let mut fully_matched_rows = 0usize;

    for (idx, row) in work_rows.iter().enumerate() {
        if idx % 100 == 0 || idx == total_rows - 1 {
            progress_fn(ValidationProgress {
                phase: "validating".to_string(),
                processed: idx + 1,
                total: total_rows,
            });
        }

        let raw_title = row.get(title_idx).cloned().unwrap_or_default();
        let raw_grade = row.get(grade_idx).cloned().unwrap_or_default();

        let cleaned_title =
            clean_job_title_column(&raw_title, is_military).map_err(|e| ValidatorError::Cleaning(e.to_string()))?;
        let cleaned_grade =
            clean_job_grade_column(&raw_grade).map_err(|e| ValidatorError::Cleaning(e.to_string()))?;

        let mut employee = Employee::new(String::new(), raw_title, raw_grade, "");
        employee.cleaned_title = cleaned_title.clone();
        employee.cleaned_grade = cleaned_grade.clone();

        let mut highlight_title = false;
        let mut highlight_grade = false;

        match primary_titles.get(&cleaned_title) {
            None => {
                highlight_title = true;
                title_mismatches += 1;
            }
            Some(candidates) => {
                if let Some((_, code)) = candidates.iter().find(|(grade, _)| grade == &cleaned_grade) {
                    employee.job_code = code.clone();
                    fully_matched_rows += 1;
                } else {
                    highlight_grade = true;
                    grade_mismatches += 1;
                }
            }
        }

        validated_rows.push(ValidationRow {
            original_row: row.clone(),
            employee,
            highlight_title,
            highlight_grade,
        });
    }

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_right_to_left(true);

    let hidden_cols = crate::core::duplicate::get_hidden_columns(work_file_path.as_ref());

    let mut output_headers = Vec::new();
    let mut orig_col_mapping = Vec::new();

    for (i, h) in work_headers.iter().enumerate() {
        if !hidden_cols.contains(&i) {
            output_headers.push(h.clone());
            orig_col_mapping.push(i);
        }
    }

    output_headers.push("العنوان الوظيفي المعدل".to_string());
    output_headers.push("الدرجة الوظيفية المعدلة".to_string());
    output_headers.push("الرمز الوظيفي".to_string());

    validated_rows.sort_by_key(|row| !(row.highlight_title || row.highlight_grade));

    let header_format = Format::new().set_bold().set_align(FormatAlign::Right);
    let default_format = Format::new().set_align(FormatAlign::Right);
    let grade_format = Format::new().set_bold().set_align(FormatAlign::Center);

    let title_mismatch_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xFFFF00))
        .set_align(FormatAlign::Right);

    let grade_mismatch_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xFF5555))
        .set_align(FormatAlign::Center);

    let mut col_widths: Vec<usize> = output_headers.iter().map(|h| h.chars().count()).collect();
    let out_orig_cols = orig_col_mapping.len();

    for row in &validated_rows {
        for (out_col_idx, &orig_idx) in orig_col_mapping.iter().enumerate() {
            let val = row.original_row.get(orig_idx).cloned().unwrap_or_default();
            let len = val.chars().count();
            if out_col_idx < col_widths.len() && len > col_widths[out_col_idx] {
                col_widths[out_col_idx] = len;
            }
        }
        let t_len = row.employee.cleaned_title.chars().count();
        if t_len > col_widths[out_orig_cols] {
            col_widths[out_orig_cols] = t_len;
        }
        let g_len = row.employee.cleaned_grade.chars().count();
        if g_len > col_widths[out_orig_cols + 1] {
            col_widths[out_orig_cols + 1] = g_len;
        }
        let c_len = row.employee.job_code.chars().count();
        if c_len > col_widths[out_orig_cols + 2] {
            col_widths[out_orig_cols + 2] = c_len;
        }
    }
    for (col, width) in col_widths.iter().enumerate() {
        let excel_width = std::cmp::max(12, width + 4) as f64;
        worksheet.set_column_width(col as u16, excel_width)?;
    }

    for (col, header) in output_headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, header, &header_format)?;
    }

    for (idx, row) in validated_rows.iter().enumerate() {
        if idx % 100 == 0 || idx == total_rows - 1 {
            progress_fn(ValidationProgress {
                phase: "writing".to_string(),
                processed: idx + 1,
                total: total_rows,
            });
        }

        let excel_row = (idx + 1) as u32;
        
        for (out_col_idx, &orig_idx) in orig_col_mapping.iter().enumerate() {
            let val = row.original_row.get(orig_idx).cloned().unwrap_or_default();
            worksheet.write_string_with_format(excel_row, out_col_idx as u16, &val, &default_format)?;
        }

        let title_fmt = if row.highlight_title {
            &title_mismatch_format
        } else {
            &default_format
        };
        worksheet.write_string_with_format(excel_row, out_orig_cols as u16, &row.employee.cleaned_title, title_fmt)?;

        let grade_fmt = if row.highlight_grade {
            &grade_mismatch_format
        } else {
            &grade_format
        };
        worksheet.write_string_with_format(excel_row, (out_orig_cols + 1) as u16, &row.employee.cleaned_grade, grade_fmt)?;

        worksheet.write_string_with_format(excel_row, (out_orig_cols + 2) as u16, &row.employee.job_code, &default_format)?;
    }

    workbook.save(output_file_path.as_ref())?;

    progress_fn(ValidationProgress {
        phase: "done".to_string(),
        processed: total_rows,
        total: total_rows,
    });

    Ok(ValidationResult {
        output_path: output_file_path.as_ref().to_string_lossy().to_string(),
        total_rows: validated_rows.len(),
        title_mismatches,
        grade_mismatches,
        fully_matched_rows,
    })
}

pub fn validate_titles_and_grades_file(
    work_file_path: impl AsRef<Path>,
    title_col: &str,
    grade_col: &str,
    progress_fn: impl Fn(ValidationProgress) + Send + Sync,
) -> Result<String, ValidatorError> {
    let input = work_file_path.as_ref();
    let date_str = Local::now().format("%d-%m-%Y").to_string();
    let output = input.with_file_name(format!("ملف المطابقة {}.xlsx", date_str));

    let result = validate_titles_and_grades(
        input,
        &output,
        title_col,
        grade_col,
        &|p| progress_fn(p),
    )?;
    Ok(result.output_path)
}
