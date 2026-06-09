use rust_xlsxwriter::{Workbook, Format, Color, FormatAlign, FormatBorder};
use crate::database::queries::DepartmentMetric;

fn map_grade_to_arabic(grade: &str) -> String {
    let g = grade.trim();
    match g {
        "1" => "الأولى".to_string(),
        "2" => "الثانية".to_string(),
        "3" => "الثالثة".to_string(),
        "4" => "الرابعة".to_string(),
        "5" => "الخامسة".to_string(),
        "6" => "السادسة".to_string(),
        "7" => "السابعة".to_string(),
        "8" => "الثامنة".to_string(),
        "9" => "التاسعة".to_string(),
        "10" => "العاشرة".to_string(),
        _ => g.to_string(),
    }
}

pub fn export_dataset(
    output_path: &str,
    _ministry: &str,
    _directorate: &str,
    _approval_year: i32,
    records: Vec<DepartmentMetric>,
) -> Result<(), String> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    
    // Set Right-to-Left
    worksheet.set_right_to_left(true);

    // Formats
    let header_format = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_background_color(Color::RGB(0xFFFF00)) // Yellow
        .set_border(FormatBorder::Thin);

    let cell_format = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin);
        
    let cell_format_title = Format::new()
        .set_align(FormatAlign::Right)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin);

    let subtotal_format = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_background_color(Color::RGB(0xFFFF00)) // Yellow
        .set_border(FormatBorder::Thin);

    // Set column widths
    worksheet.set_column_width(0, 45.0).unwrap(); // Job Title
    worksheet.set_column_width(1, 15.0).unwrap(); // Grade
    worksheet.set_column_width(2, 15.0).unwrap(); // Code
    worksheet.set_column_width(3, 10.0).unwrap(); // Males
    worksheet.set_column_width(4, 10.0).unwrap(); // Females
    worksheet.set_column_width(5, 10.0).unwrap(); // Vacants
    worksheet.set_column_width(6, 15.0).unwrap(); // Total (M+F+V)

    // Write headers (Row 0)
    let headers = [
        "العنوان الوظيفي", "الدرجة الوظيفية", "الرمز الوظيفي", 
        "ذكور", "اناث", "شاغر", "المجموع الكلي"
    ];
    for (col_num, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col_num as u16, *header, &header_format).unwrap();
    }

    let mut current_row = 1;
    
    // Accumulators for the current grade
    let mut grade_males = 0;
    let mut grade_females = 0;
    let mut grade_vacants = 0;
    let mut grade_total = 0;
    let mut current_grade = String::new();

    // Accumulators for the grand total
    let mut grand_males = 0;
    let mut grand_females = 0;
    let mut grand_vacants = 0;
    let mut grand_total = 0;

    for record in records.iter() {
        let rec_grade = record.job_grade.clone().unwrap_or_default();
        
        // If grade changed and we have a previous grade, output subtotal
        if !current_grade.is_empty() && rec_grade != current_grade {
            let grade_label = format!("مجموع الدرجة {}", map_grade_to_arabic(&current_grade));
            worksheet.merge_range(current_row, 0, current_row, 2, &grade_label, &subtotal_format).unwrap();
            worksheet.write_number_with_format(current_row, 3, grade_males as f64, &subtotal_format).unwrap();
            worksheet.write_number_with_format(current_row, 4, grade_females as f64, &subtotal_format).unwrap();
            worksheet.write_number_with_format(current_row, 5, grade_vacants as f64, &subtotal_format).unwrap();
            worksheet.write_number_with_format(current_row, 6, grade_total as f64, &subtotal_format).unwrap();
            current_row += 1;

            // Reset grade accumulators
            grade_males = 0;
            grade_females = 0;
            grade_vacants = 0;
            grade_total = 0;
        }

        current_grade = rec_grade;

        let males = record.male_count.unwrap_or(0);
        let females = record.female_count.unwrap_or(0);
        let vacants = record.vacant_count.unwrap_or(0);
        let total = males + females + vacants;

        // Write row
        worksheet.write_string_with_format(current_row, 0, record.job_title.as_deref().unwrap_or(""), &cell_format_title).unwrap();
        worksheet.write_string_with_format(current_row, 1, record.job_grade.as_deref().unwrap_or(""), &cell_format).unwrap();
        worksheet.write_string_with_format(current_row, 2, record.job_code.as_deref().unwrap_or(""), &cell_format).unwrap();
        worksheet.write_number_with_format(current_row, 3, males as f64, &cell_format).unwrap();
        worksheet.write_number_with_format(current_row, 4, females as f64, &cell_format).unwrap();
        worksheet.write_number_with_format(current_row, 5, vacants as f64, &cell_format).unwrap();
        worksheet.write_number_with_format(current_row, 6, total as f64, &cell_format).unwrap();

        // Accumulate
        grade_males += males;
        grade_females += females;
        grade_vacants += vacants;
        grade_total += total;

        grand_males += males;
        grand_females += females;
        grand_vacants += vacants;
        grand_total += total;

        current_row += 1;
    }

    // Output final subtotal for the last grade group if exists
    if !current_grade.is_empty() {
        let grade_label = format!("مجموع الدرجة {}", map_grade_to_arabic(&current_grade));
        worksheet.merge_range(current_row, 0, current_row, 2, &grade_label, &subtotal_format).unwrap();
        worksheet.write_number_with_format(current_row, 3, grade_males as f64, &subtotal_format).unwrap();
        worksheet.write_number_with_format(current_row, 4, grade_females as f64, &subtotal_format).unwrap();
        worksheet.write_number_with_format(current_row, 5, grade_vacants as f64, &subtotal_format).unwrap();
        worksheet.write_number_with_format(current_row, 6, grade_total as f64, &subtotal_format).unwrap();
        current_row += 1;
    }

    // Write Grand Total row
    worksheet.merge_range(current_row, 0, current_row, 2, "المجموع الكلي", &subtotal_format).unwrap();
    worksheet.write_number_with_format(current_row, 3, grand_males as f64, &subtotal_format).unwrap();
    worksheet.write_number_with_format(current_row, 4, grand_females as f64, &subtotal_format).unwrap();
    worksheet.write_number_with_format(current_row, 5, grand_vacants as f64, &subtotal_format).unwrap();
    worksheet.write_number_with_format(current_row, 6, grand_total as f64, &subtotal_format).unwrap();

    workbook.save(output_path).map_err(|e| e.to_string())?;

    Ok(())
}
