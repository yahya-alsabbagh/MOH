use std::collections::{BinaryHeap, HashMap};
use std::cmp::Reverse;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use calamine::{open_workbook_auto, Data, Reader};
use rayon::prelude::*;
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use serde::{Deserialize, Serialize};

use crate::core::cleaner::normalize_arabic_name;

/// الحد الأقصى لعدد التطابقات الضبابية المُرجَعة (أعلى 1000 تشابهاً)
const MAX_FUZZY_RESULTS: usize = 1_000;

// ═══════════════════════════════════════════════════════════════════════
// Data Structures
// ═══════════════════════════════════════════════════════════════════════

/// ملخص بيانات الموظف للعرض في الواجهة
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EmployeeSummary {
    pub raw_name: String,
    pub cleaned_name: String,
    pub raw_title: String,
    pub raw_grade: String,
    pub job_code: String,
    /// رقم الصف في الملف الأصلي (1-indexed, بدون صف العناوين)
    pub row_index: usize,
}

/// نتيجة تطابق ضبابي بين موظفَين
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FuzzyMatchResult {
    pub employee_1: EmployeeSummary,
    pub employee_2: EmployeeSummary,
    /// نسبة التشابه (0.0 - 100.0)
    pub similarity_score: f64,
    /// نوع التطابق: "تشابه عالي جداً" / "تشابه عالي" / "تشابه متوسط"
    pub match_type: String,
}

/// مجموعة تطابق تام (أسماء متطابقة 100% بعد التنظيف)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExactDuplicateGroup {
    pub cleaned_name: String,
    pub employees: Vec<EmployeeSummary>,
}

/// النتيجة النهائية للفحص الذكي
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartScanResult {
    pub total_rows: usize,
    pub exact_duplicates: Vec<ExactDuplicateGroup>,
    pub fuzzy_matches: Vec<FuzzyMatchResult>,
    /// مدة الفحص بالمللي ثانية
    pub scan_duration_ms: u64,
}

/// بيانات تقدم الفحص — تُرسل للواجهة أثناء المعالجة
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    /// المرحلة الحالية: "reading" / "exact" / "fuzzy" / "done"
    pub phase: String,
    /// عدد العناصر المعالَجة حتى الآن
    pub processed: usize,
    /// العدد الإجمالي
    pub total: usize,
    /// عدد التطابقات المكتشفة حتى الآن
    pub found_so_far: usize,
}

/// عنصر داخلي للمقارنة في BinaryHeap (min-heap حسب score)
/// نستخدم Reverse ليصبح min-heap — نحتفظ بأعلى النتائج فقط
#[derive(Clone, PartialEq)]
struct ScoredMatch {
    score: f64,
    result: FuzzyMatchResult,
}

impl Eq for ScoredMatch {}

impl PartialOrd for ScoredMatch {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ScoredMatch {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.score
            .partial_cmp(&other.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════

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

/// تصنيف نوع التطابق بناءً على نسبة التشابه
#[inline]
fn classify_match(score_pct: f64) -> &'static str {
    if score_pct >= 95.0 {
        "تشابه عالي جداً"
    } else if score_pct >= 90.0 {
        "تشابه عالي"
    } else {
        "تشابه متوسط"
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Fuzzy Matching Algorithm — مُحسَّن للملفات الكبيرة (100K+ اسم)
// ═══════════════════════════════════════════════════════════════════════

/// عنصر داخلي يحتوي بيانات الاسم المُعالَجة مسبقاً
struct PreparedEntry {
    /// index في المصفوفة الأصلية
    idx: usize,
    /// عدد حروف الاسم المنظّف (مُحسوب مرة واحدة)
    char_count: usize,
}

/// كشف التطابقات الضبابية باستخدام Jaro-Winkler + Rayon
///
/// **تحسينات الأداء:**
/// 1. **Bucketing بأول حرفين** — تقليل فضاء المقارنة ~100x
/// 2. **Length Filter** — تخطي المقارنات المستحيلة رياضياً (60-80% تقليل)
/// 3. **Result Cap** — الاحتفاظ بأعلى MAX_FUZZY_RESULTS نتيجة فقط (min-heap)
/// 4. **Pre-computed char counts** — تجنب حساب .chars().count() المتكرر
/// 5. **score_cutoff** — الخروج المبكر من المقارنات دون العتبة
fn detect_fuzzy_duplicates(
    entries: &[(EmployeeSummary, String)],
    threshold: f64,
    progress_fn: &(dyn Fn(usize, usize, usize) + Sync),
) -> Vec<FuzzyMatchResult> {
    use rapidfuzz::distance::jaro_winkler;

    let n = entries.len();
    if n < 2 {
        return Vec::new();
    }

    // ───────────────────────────────────────────────────────
    // الخطوة 1: Pre-compute char counts
    // ───────────────────────────────────────────────────────
    let char_counts: Vec<usize> = entries
        .iter()
        .map(|(_, name)| name.chars().count())
        .collect();

    // ───────────────────────────────────────────────────────
    // الخطوة 2: Bucketing بأول حرفين
    // ───────────────────────────────────────────────────────
    // تجميع الأسماء حسب أول حرفين — المقارنة تتم فقط داخل كل مجموعة
    let mut buckets: HashMap<String, Vec<PreparedEntry>> = HashMap::new();
    for (idx, (_, cleaned)) in entries.iter().enumerate() {
        let cc = char_counts[idx];
        // تخطي الأسماء القصيرة جداً (أقل من 3 حروف)
        if cc < 3 {
            continue;
        }
        let prefix: String = cleaned.chars().take(2).collect();
        buckets
            .entry(prefix)
            .or_default()
            .push(PreparedEntry { idx, char_count: cc });
    }

    let bucket_list: Vec<Vec<PreparedEntry>> = buckets.into_values().collect();
    let total_buckets = bucket_list.len();

    // ───────────────────────────────────────────────────────
    // الخطوة 3: المقارنة المتوازية داخل كل مجموعة
    // ───────────────────────────────────────────────────────
    let args = jaro_winkler::Args::default().score_cutoff(threshold);

    // min-heap مشترك: يحتفظ بأعلى MAX_FUZZY_RESULTS نتيجة
    let global_heap: Arc<Mutex<BinaryHeap<Reverse<ScoredMatch>>>> =
        Arc::new(Mutex::new(BinaryHeap::with_capacity(MAX_FUZZY_RESULTS + 1)));
    let processed_buckets = AtomicUsize::new(0);
    let found_count = AtomicUsize::new(0);

    bucket_list.par_iter().for_each(|bucket| {
        let bn = bucket.len();
        if bn < 2 {
            processed_buckets.fetch_add(1, Ordering::Relaxed);
            return;
        }

        // نتائج محلية لهذه المجموعة (تُدمج لاحقاً)
        let mut local_matches: Vec<ScoredMatch> = Vec::new();

        for i in 0..bn - 1 {
            let pe_i = &bucket[i];
            let name_i: &str = entries[pe_i.idx].1.as_str();
            let emp_i = &entries[pe_i.idx].0;

            for j in (i + 1)..bn {
                let pe_j = &bucket[j];

                // ── Length Filter ──
                // إذا كان فرق الطول كبيراً، Jaro-Winkler لن يعطي نتيجة عالية
                let min_len = pe_i.char_count.min(pe_j.char_count);
                let max_len = pe_i.char_count.max(pe_j.char_count);
                if (min_len as f64 / max_len as f64) < threshold {
                    continue;
                }

                let name_j: &str = entries[pe_j.idx].1.as_str();

                // تخطي التطابق التام (100%) — يُعالَج بكود التكرار الأصلي
                if name_i == name_j {
                    continue;
                }

                // Jaro-Winkler مع score_cutoff
                let sim_opt = jaro_winkler::similarity_with_args(
                    name_i.chars(),
                    name_j.chars(),
                    &args,
                );

                if let Some(sim) = sim_opt {
                    if sim < 1.0 {
                        let score_pct = (sim * 10000.0).round() / 100.0;
                        local_matches.push(ScoredMatch {
                            score: score_pct,
                            result: FuzzyMatchResult {
                                employee_1: emp_i.clone(),
                                employee_2: entries[pe_j.idx].0.clone(),
                                similarity_score: score_pct,
                                match_type: classify_match(score_pct).to_string(),
                            },
                        });
                    }
                }
            }
        }

        // دمج النتائج المحلية في الـ heap العالمي
        if !local_matches.is_empty() {
            let mut heap = global_heap.lock().unwrap();
            for m in local_matches {
                heap.push(Reverse(m));
                if heap.len() > MAX_FUZZY_RESULTS {
                    heap.pop(); // إزالة الأقل تشابهاً
                }
            }
            found_count.store(heap.len(), Ordering::Relaxed);
        }

        // تحديث التقدم
        let done = processed_buckets.fetch_add(1, Ordering::Relaxed) + 1;
        if done % 20 == 0 || done == total_buckets {
            progress_fn(done, total_buckets, found_count.load(Ordering::Relaxed));
        }
    });

    // ───────────────────────────────────────────────────────
    // الخطوة 4: استخراج النتائج مرتبة تنازلياً
    // ───────────────────────────────────────────────────────
    let heap = match Arc::try_unwrap(global_heap) {
        Ok(mutex) => mutex.into_inner().unwrap(),
        Err(arc) => arc.lock().unwrap().clone(),
    }
    .into_sorted_vec();

    // Reverse<ScoredMatch>.into_sorted_vec() يعطي ترتيب تصاعدي
    // نحتاج تنازلي (الأعلى أولاً)
    heap.into_iter()
        .rev()
        .map(|Reverse(sm)| sm.result)
        .collect()
}

// ═══════════════════════════════════════════════════════════════════════
// Main Orchestrator — يقرأ الملف ويُجري الفحص الكامل
// ═══════════════════════════════════════════════════════════════════════

/// الدالة الرئيسية: تقرأ ملف Excel، تنظّف الأسماء، وتكشف التطابقات التامة والضبابية
///
/// # Arguments
/// - `file_path`: مسار ملف Excel
/// - `column_name`: اسم عمود الأسماء (مثلاً "الاسم")
/// - `threshold`: عتبة التشابه الضبابي (0.80 = 80%)
/// - `progress_fn`: دالة callback لإرسال تحديثات التقدم (يمكن أن تكون فارغة)
pub fn run_full_fuzzy_scan(
    file_path: impl AsRef<Path>,
    column_name: &str,
    threshold: f64,
    progress_fn: impl Fn(ScanProgress) + Send + Sync,
) -> Result<SmartScanResult, String> {
    let start = Instant::now();

    // ═══════════════════════════════════════════════════════════
    // الخطوة 1: قراءة ملف Excel واستخراج البيانات
    // ═══════════════════════════════════════════════════════════
    progress_fn(ScanProgress {
        phase: "reading".to_string(),
        processed: 0,
        total: 0,
        found_so_far: 0,
    });

    let mut workbook =
        open_workbook_auto(file_path.as_ref()).map_err(|e| format!("فشل قراءة الملف: {}", e))?;

    let first_sheet = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "الملف لا يحتوي على أي أوراق عمل".to_string())?;

    let range = workbook
        .worksheet_range(&first_sheet)
        .map_err(|e| format!("فشل قراءة الورقة: {}", e))?;

    let mut rows_iter = range.rows();

    let headers: Vec<String> = rows_iter
        .next()
        .ok_or_else(|| "الملف لا يحتوي على صف عناوين".to_string())?
        .iter()
        .map(cell_to_string)
        .collect();

    // البحث عن أعمدة البيانات
    let name_idx = headers
        .iter()
        .position(|h| h == column_name)
        .ok_or_else(|| format!("العمود '{}' غير موجود في الملف", column_name))?;

    let title_idx = headers.iter().position(|h| h == "العنوان الوظيفي");
    let grade_idx = headers.iter().position(|h| h == "الدرجة الوظيفية");
    let code_idx = headers.iter().position(|h| h == "الرمز الوظيفي");

    // ═══════════════════════════════════════════════════════════
    // الخطوة 2: بناء قائمة الموظفين مع تنظيف الأسماء
    // ═══════════════════════════════════════════════════════════
    let get_cell = |row: &[Data], idx: Option<usize>| -> String {
        idx.and_then(|i| row.get(i))
            .map(cell_to_string)
            .unwrap_or_default()
    };

    let mut entries: Vec<(EmployeeSummary, String)> = Vec::new();
    let mut exact_groups: HashMap<String, Vec<EmployeeSummary>> = HashMap::new();

    for (row_num, row) in rows_iter.enumerate() {
        let raw_name = row
            .get(name_idx)
            .map(cell_to_string)
            .unwrap_or_default()
            .trim()
            .to_string();

        if raw_name.is_empty() {
            continue;
        }

        let cleaned = normalize_arabic_name(&raw_name);

        let summary = EmployeeSummary {
            raw_name,
            cleaned_name: cleaned.clone(),
            raw_title: get_cell(row, title_idx),
            raw_grade: get_cell(row, grade_idx),
            job_code: get_cell(row, code_idx),
            row_index: row_num + 2, // +2: صف 1 = العناوين، الفهرسة تبدأ من 0
        };

        // تجميع التطابقات التامة
        exact_groups
            .entry(cleaned.clone())
            .or_default()
            .push(summary.clone());

        entries.push((summary, cleaned));
    }

    let total_rows = entries.len();

    progress_fn(ScanProgress {
        phase: "exact".to_string(),
        processed: total_rows,
        total: total_rows,
        found_so_far: 0,
    });

    // ═══════════════════════════════════════════════════════════
    // الخطوة 3: استخراج مجموعات التطابق التام
    // ═══════════════════════════════════════════════════════════
    let mut exact_duplicates: Vec<ExactDuplicateGroup> = exact_groups
        .into_iter()
        .filter(|(_, group)| group.len() > 1)
        .map(|(name, employees)| ExactDuplicateGroup {
            cleaned_name: name,
            employees,
        })
        .collect();

    // ترتيب حسب عدد الموظفين في كل مجموعة (تنازلي)
    exact_duplicates.sort_by(|a, b| b.employees.len().cmp(&a.employees.len()));

    // ═══════════════════════════════════════════════════════════
    // الخطوة 4: كشف التطابقات الضبابية (Jaro-Winkler + Rayon)
    //           مع Bucketing + Length Filter + Result Cap
    // ═══════════════════════════════════════════════════════════
    let fuzzy_matches = detect_fuzzy_duplicates(&entries, threshold, &|processed, total, found| {
        progress_fn(ScanProgress {
            phase: "fuzzy".to_string(),
            processed,
            total,
            found_so_far: found,
        });
    });

    let duration = start.elapsed().as_millis() as u64;

    progress_fn(ScanProgress {
        phase: "done".to_string(),
        processed: total_rows,
        total: total_rows,
        found_so_far: fuzzy_matches.len(),
    });

    Ok(SmartScanResult {
        total_rows,
        exact_duplicates,
        fuzzy_matches,
        scan_duration_ms: duration,
    })
}

// ═══════════════════════════════════════════════════════════════════════
// Excel Export — تصدير نتائج الفحص الذكي إلى ملف Excel احترافي
// ═══════════════════════════════════════════════════════════════════════

/// تصدير نتائج الفحص الذكي إلى ملف Excel متعدد الأوراق
/// `decisions` — مصفوفة متوازية مع fuzzy_matches تحتوي القرار لكل تطابق
pub fn export_smart_scan_to_excel(
    output_path: &str,
    result: &SmartScanResult,
    decisions: &[String],
) -> Result<String, String> {
    let mut wb = Workbook::new();

    // ── الأنماط (Formats) ──────────────────────────────────
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

    let data_alt_fmt = Format::new()
        .set_align(FormatAlign::Right)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0)
        .set_background_color(Color::RGB(0xF0F4FF));

    let score_high_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_bold()
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0xDC2626))
        .set_background_color(Color::RGB(0xFEF2F2));

    let score_med_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_bold()
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0xD97706))
        .set_background_color(Color::RGB(0xFFFBEB));

    let score_low_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_bold()
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0x0284C7))
        .set_background_color(Color::RGB(0xF0F9FF));

    let group_header_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Right)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0)
        .set_background_color(Color::RGB(0xDCFCE7))
        .set_font_color(Color::RGB(0x166534));

    let decision_fraud_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_bold()
        .set_font_size(10.0)
        .set_font_color(Color::White)
        .set_background_color(Color::RGB(0xDC2626));

    let decision_ignore_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0)
        .set_font_color(Color::RGB(0x6B7280))
        .set_background_color(Color::RGB(0xF3F4F6));

    // ════════════════════════════════════════════════════════
    // ورقة 1: التطابقات التامة
    // ════════════════════════════════════════════════════════
    {
        let ws = wb.add_worksheet();
        ws.set_name("التطابقات التامة")
            .map_err(|e| format!("فشل تسمية الورقة: {}", e))?;
        ws.set_right_to_left(true);

        let exact_headers = ["#", "المجموعة", "الاسم المكرر", "الاسم الأصلي", "العنوان الوظيفي", "الدرجة", "الرمز الوظيفي", "رقم الصف"];

        // عرض الأعمدة
        let widths = [5.0, 8.0, 30.0, 30.0, 25.0, 15.0, 12.0, 10.0];
        for (i, w) in widths.iter().enumerate() {
            ws.set_column_width(i as u16, *w)
                .map_err(|e| format!("خطأ عرض العمود: {}", e))?;
        }

        for (col, h) in exact_headers.iter().enumerate() {
            ws.write_string_with_format(0, col as u16, *h, &header_fmt)
                .map_err(|e| format!("خطأ كتابة العنوان: {}", e))?;
        }

        let mut row: u32 = 1;
        let mut counter: u32 = 0;
        for (g_idx, group) in result.exact_duplicates.iter().enumerate() {
            for (e_idx, emp) in group.employees.iter().enumerate() {
                counter += 1;
                let fmt = if g_idx % 2 == 0 { &data_fmt } else { &data_alt_fmt };

                ws.write_number_with_format(row, 0, counter as f64, fmt)
                    .map_err(|e| e.to_string())?;
                ws.write_number_with_format(row, 1, (g_idx + 1) as f64, fmt)
                    .map_err(|e| e.to_string())?;

                // الاسم المنظّف فقط في أول عنصر من المجموعة
                if e_idx == 0 {
                    ws.write_string_with_format(row, 2, &group.cleaned_name, &group_header_fmt)
                        .map_err(|e| e.to_string())?;
                } else {
                    ws.write_string_with_format(row, 2, "", fmt)
                        .map_err(|e| e.to_string())?;
                }

                ws.write_string_with_format(row, 3, &emp.raw_name, fmt)
                    .map_err(|e| e.to_string())?;
                ws.write_string_with_format(row, 4, &emp.raw_title, fmt)
                    .map_err(|e| e.to_string())?;
                ws.write_string_with_format(row, 5, &emp.raw_grade, fmt)
                    .map_err(|e| e.to_string())?;
                ws.write_string_with_format(row, 6, &emp.job_code, fmt)
                    .map_err(|e| e.to_string())?;
                ws.write_number_with_format(row, 7, emp.row_index as f64, fmt)
                    .map_err(|e| e.to_string())?;

                row += 1;
            }
        }
    }

    // ════════════════════════════════════════════════════════
    // ورقة 2: التطابقات الضبابية
    // ════════════════════════════════════════════════════════
    {
        let ws = wb.add_worksheet();
        ws.set_name("تطابقات الفحص الذكي")
            .map_err(|e| format!("فشل تسمية الورقة: {}", e))?;
        ws.set_right_to_left(true);

        let fuzzy_headers = [
            "#",
            "الاسم الأصلي (1)",
            "العنوان (1)",
            "الدرجة (1)",
            "صف (1)",
            "الاسم الأصلي (2)",
            "العنوان (2)",
            "الدرجة (2)",
            "صف (2)",
            "نسبة التشابه %",
            "التصنيف",
            "القرار",
        ];

        let widths = [5.0, 28.0, 22.0, 12.0, 8.0, 28.0, 22.0, 12.0, 8.0, 14.0, 16.0, 16.0];
        for (i, w) in widths.iter().enumerate() {
            ws.set_column_width(i as u16, *w)
                .map_err(|e| format!("خطأ عرض العمود: {}", e))?;
        }

        for (col, h) in fuzzy_headers.iter().enumerate() {
            ws.write_string_with_format(0, col as u16, *h, &header_fmt)
                .map_err(|e| format!("خطأ كتابة العنوان: {}", e))?;
        }

        for (i, m) in result.fuzzy_matches.iter().enumerate() {
            let row = (i + 1) as u32;
            let fmt = if i % 2 == 0 { &data_fmt } else { &data_alt_fmt };

            let s_fmt = if m.similarity_score >= 95.0 {
                &score_high_fmt
            } else if m.similarity_score >= 90.0 {
                &score_med_fmt
            } else {
                &score_low_fmt
            };

            ws.write_number_with_format(row, 0, (i + 1) as f64, fmt)
                .map_err(|e| e.to_string())?;

            // الموظف الأول
            ws.write_string_with_format(row, 1, &m.employee_1.raw_name, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_string_with_format(row, 2, &m.employee_1.raw_title, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_string_with_format(row, 3, &m.employee_1.raw_grade, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_number_with_format(row, 4, m.employee_1.row_index as f64, fmt)
                .map_err(|e| e.to_string())?;

            // الموظف الثاني
            ws.write_string_with_format(row, 5, &m.employee_2.raw_name, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_string_with_format(row, 6, &m.employee_2.raw_title, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_string_with_format(row, 7, &m.employee_2.raw_grade, fmt)
                .map_err(|e| e.to_string())?;
            ws.write_number_with_format(row, 8, m.employee_2.row_index as f64, fmt)
                .map_err(|e| e.to_string())?;

            // النسبة والتصنيف
            ws.write_number_with_format(row, 9, m.similarity_score, s_fmt)
                .map_err(|e| e.to_string())?;
            ws.write_string_with_format(row, 10, &m.match_type, s_fmt)
                .map_err(|e| e.to_string())?;

            // القرار
            let decision = decisions.get(i).map(|s| s.as_str()).unwrap_or("");
            let d_fmt = match decision {
                "تلاعب" => &decision_fraud_fmt,
                "تجاهل" => &decision_ignore_fmt,
                _ => &data_fmt,
            };
            let d_label = if decision.is_empty() { "لم يُحدد" } else { decision };
            ws.write_string_with_format(row, 11, d_label, d_fmt)
                .map_err(|e| e.to_string())?;
        }
    }

    wb.save(output_path)
        .map_err(|e| format!("فشل حفظ الملف: {}", e))?;

    Ok(output_path.to_string())
}
