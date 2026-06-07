use std::collections::HashMap;
use std::path::Path;
use calamine::{open_workbook_auto, Data, Reader};
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use chrono::Local;

#[derive(Debug, thiserror::Error)]
pub enum AggregatorError {
    #[error("failed to read workbook: {0}")]
    WorkbookRead(#[from] calamine::Error),
    #[error("input workbook contains no sheets")]
    EmptyWorkbook,
    #[error("missing header row in first sheet")]
    MissingHeader,
    #[error("failed to write output workbook: {0}")]
    WorkbookWrite(#[from] rust_xlsxwriter::XlsxError),
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

fn grade_sort_key(grade: &str) -> u32 {
    let g = grade.trim();
    if g.contains("عليا ا") || g.contains("عليا أ") { return 0; }
    if g.contains("عليا ب") { return 1; }
    if g == "1" { return 2; }
    if g == "2" { return 3; }
    if g == "3" { return 4; }
    if g == "4" { return 5; }
    if g == "5" { return 6; }
    if g == "6" { return 7; }
    if g == "7" { return 8; }
    if g == "8" { return 9; }
    if g == "9" { return 10; }
    if g == "10" { return 11; }
    
    // Attempt to parse as number
    if let Ok(num) = g.parse::<u32>() {
        return num + 10; 
    }
    100
}

pub fn run_aggregation_file(file_path: impl AsRef<Path>) -> Result<String, AggregatorError> {
    let input = file_path.as_ref();
    let date_str = Local::now().format("%d-%m-%Y").to_string();
    let output = input.with_file_name(format!("فرز الملاكات {}.xlsx", date_str));

    let mut workbook = open_workbook_auto(input)?;
    let first_sheet = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or(AggregatorError::EmptyWorkbook)?;
    let range = workbook.worksheet_range(&first_sheet)?;

    let mut rows = range.rows();
    let headers = rows
        .next()
        .ok_or(AggregatorError::MissingHeader)?
        .iter()
        .map(cell_to_string)
        .collect::<Vec<_>>();

    let title_idx = headers.iter().position(|h| h == "العنوان الوظيفي المعدل")
        .or_else(|| headers.iter().position(|h| h == "العنوان الوظيفي"));
        
    let grade_idx = headers.iter().position(|h| h == "الدرجة الوظيفية المعدلة")
        .or_else(|| headers.iter().position(|h| h == "الدرجة الوظيفية"));
        
    let code_idx = headers.iter().position(|h| h == "الرمز الوظيفي");

    let mut counts: HashMap<(String, String, String), u32> = HashMap::new();

    for row in rows {
        let title = title_idx.and_then(|i| row.get(i)).map(cell_to_string).unwrap_or_default().trim().to_string();
        let grade = grade_idx.and_then(|i| row.get(i)).map(cell_to_string).unwrap_or_default().trim().to_string();
        let code = code_idx.and_then(|i| row.get(i)).map(cell_to_string).unwrap_or_default().trim().to_string();
        
        // Skip empty rows
        if title.is_empty() && grade.is_empty() && code.is_empty() {
            continue;
        }

        *counts.entry((grade, title, code)).or_insert(0) += 1;
    }

    let mut grades_map: HashMap<String, Vec<(String, String, u32)>> = HashMap::new();
    for ((grade, title, code), count) in counts {
        grades_map.entry(grade).or_default().push((title, code, count));
    }

    let mut grade_keys: Vec<String> = grades_map.keys().cloned().collect();
    grade_keys.sort_by_key(|g| grade_sort_key(g));

    let mut out_wb = Workbook::new();
    let worksheet = out_wb.add_worksheet();
    worksheet.set_right_to_left(true);

    let output_headers = vec![
        "العنوان الوظيفي",
        "الدرجة الوظيفية",
        "الرمز الوظيفي",
        "ذكور",
        "اناث",
        "شاغر",
        "العدد",
        "المجموع الكلي"
    ];

    let header_format = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_background_color(Color::RGB(0xFFFF00)); // Yellow header

    let data_format = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin);

    let summary_format = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_background_color(Color::RGB(0xFFFF00));

    // Write Headers
    for (col, header) in output_headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format)?;
    }

    // Adjust column widths
    worksheet.set_column_width(0, 30.0)?; // Title
    worksheet.set_column_width(1, 20.0)?; // Grade
    worksheet.set_column_width(2, 15.0)?; // Code
    worksheet.set_column_width(3, 10.0)?; // Males
    worksheet.set_column_width(4, 10.0)?; // Females
    worksheet.set_column_width(5, 10.0)?; // Vacant
    worksheet.set_column_width(6, 12.0)?; // Count
    worksheet.set_column_width(7, 15.0)?; // Total

    let mut current_row = 1;
    let mut summary_rows: Vec<u32> = Vec::new();

    for grade in grade_keys {
        if let Some(mut items) = grades_map.remove(&grade) {
            items.sort_by(|a, b| a.0.cmp(&b.0));

            let start_excel_row = current_row + 1;

            for (title, code, count) in items {
                let excel_row = current_row + 1;
                worksheet.write_string_with_format(current_row, 0, &title, &data_format)?;
                worksheet.write_string_with_format(current_row, 1, &grade, &data_format)?;
                worksheet.write_string_with_format(current_row, 2, &code, &data_format)?;
                
                // Males (Col D)
                worksheet.write_number_with_format(current_row, 3, 0.0, &data_format)?; 
                
                // Count (Col G) - Static number
                worksheet.write_number_with_format(current_row, 6, count as f64, &data_format)?; 
                
                // Vacant (Col F) - Write blank to avoid formula errors
                worksheet.write_blank(current_row, 5, &data_format)?; 
                
                // Females (Col E) = Count (G) - Males (D)
                worksheet.write_formula_with_format(current_row, 4, format!("=G{}-D{}", excel_row, excel_row).as_str(), &data_format)?;
                
                // Total (Col H) = Count (G) + Vacant (F)
                worksheet.write_formula_with_format(current_row, 7, format!("=G{}+F{}", excel_row, excel_row).as_str(), &data_format)?;
                
                current_row += 1;
            }

            let end_excel_row = current_row; // Last data row
            let summary_excel_row = current_row + 1; // The row we are writing the sum to
            summary_rows.push(summary_excel_row);

            // Summary Row
            let summary_text = format!("مجموع الدرجة {}", grade);
            worksheet.merge_range(
                current_row, 0, 
                current_row, 2, 
                &summary_text, 
                &summary_format
            )?;
            
            for col_idx in 3..=7 {
                let col_letter = (b'A' + col_idx as u8) as char;
                let formula = format!("=SUM({}{}:{}{})", col_letter, start_excel_row, col_letter, end_excel_row);
                worksheet.write_formula_with_format(current_row, col_idx as u16, formula.as_str(), &summary_format)?;
            }
            
            current_row += 1;
        }
    }

    // Grand Total Row
    if !summary_rows.is_empty() {
        let grand_total_text = "المجموع الكلي النهائي";
        worksheet.merge_range(
            current_row, 0, 
            current_row, 2, 
            grand_total_text, 
            &summary_format
        )?;
        
        for col_idx in 3..=7 {
            let col_letter = (b'A' + col_idx as u8) as char;
            let parts: Vec<String> = summary_rows.iter().map(|r| format!("{}{}", col_letter, r)).collect();
            let formula = format!("={}", parts.join("+"));
            worksheet.write_formula_with_format(current_row, col_idx as u16, formula.as_str(), &summary_format)?;
        }
    }

    out_wb.save(&output)?;

    Ok(output.to_string_lossy().to_string())
}
