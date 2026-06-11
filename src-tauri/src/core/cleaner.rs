use lazy_static::lazy_static;
use regex::Regex;

#[derive(Debug, thiserror::Error)]
pub enum CleanerError {
    #[error("failed to build regex: {0}")]
    Regex(#[from] regex::Error),
}

lazy_static! {
    static ref RE_MULTI_SPACE: Regex = Regex::new(r"\s+").expect("valid regex");
    static ref RE_ALEF_NORMALIZE: Regex = Regex::new(r"[أإآ]").expect("valid regex");
    static ref RE_SINGLE_R: Regex = Regex::new(r"\bر\b").expect("valid regex");
    static ref RE_RAEES_VARIANT_1: Regex = Regex::new(r"\S*ئيس\S*").expect("valid regex");
    static ref RE_RAEES_VARIANT_2: Regex = Regex::new(r"\S*رئي\S*").expect("valid regex");
    static ref RE_SINGLE_M: Regex = Regex::new(r"\bم\b").expect("valid regex");
    static ref RE_SINGLE_M_WITH_SPACE: Regex = Regex::new(r"\bم\s+").expect("valid regex");
    static ref RE_HA_END: Regex = Regex::new(r"ه\b").expect("valid regex");
    static ref RE_TA_NO_SPACE: Regex = Regex::new(r"ة([^\s])").expect("valid regex");
    static ref RE_HAMZA_NO_SPACE: Regex = Regex::new(r"ء([^\s])").expect("valid regex");
    static ref RE_WORD_AJHIZA: Regex = Regex::new(r"\bاجهزة\b").expect("valid regex");
    static ref RE_DUP_AJHIZA: Regex = Regex::new(r"\bاجهزة طبية طبية\b").expect("valid regex");
    static ref RE_ANY_TAFNI: Regex = Regex::new(r"\S*تفني\S*").expect("valid regex");
    static ref RE_ANY_MA3LO: Regex = Regex::new(r"\S*معلو\S*").expect("valid regex");
    static ref RE_ANY_KEEM: Regex = Regex::new(r"\S*كيم\S*").expect("valid regex");
    static ref RE_ANY_KEMI: Regex = Regex::new(r"\S*كمي\S*").expect("valid regex");
    static ref RE_ANY_FEYZ: Regex = Regex::new(r"\S*فيز\S*").expect("valid regex");
    static ref RE_ANY_EKHT: Regex = Regex::new(r"\S*اخت\S*").expect("valid regex");
    static ref RE_ANY_EHSA: Regex = Regex::new(r"\S*احصا\S*").expect("valid regex");
    static ref RE_ANY_MHAQ: Regex = Regex::new(r"\S*محق\S*").expect("valid regex");
    static ref RE_ANY_TEQN: Regex = Regex::new(r"\S*تقن\S*").expect("valid regex");
    static ref RE_ANY_MSHGH: Regex = Regex::new(r"\S*مشغ\S*").expect("valid regex");
    static ref RE_ANY_FNY_ALEF: Regex = Regex::new(r"\S*فنى\S*").expect("valid regex");
    static ref RE_ANY_FNY_YA: Regex = Regex::new(r"\S*فنيي\S*").expect("valid regex");
    static ref RE_ANY_FNY_N: Regex = Regex::new(r"\S*فنين\S*").expect("valid regex");
    static ref RE_ANY_TEBY_Y: Regex = Regex::new(r"\S*طبيي\S*").expect("valid regex");
    static ref RE_ANY_MOHNDSI: Regex = Regex::new(r"\S*مهندسي\S*").expect("valid regex");
    static ref RE_ANY_MDRBI: Regex = Regex::new(r"\S*مدربي\S*").expect("valid regex");
    static ref RE_ANY_JELO: Regex = Regex::new(r"\S*جيلو\S*").expect("valid regex");
    static ref RE_ANY_JIO: Regex = Regex::new(r"\S*جيو\S*").expect("valid regex");
    static ref RE_ANY_AWAL: Regex = Regex::new(r"\S*اول\S*").expect("valid regex");
    static ref RE_ANY_BAY: Regex = Regex::new(r"\S*باي\S*").expect("valid regex");
    static ref RE_ANY_BIO: Regex = Regex::new(r"\S*بيو\S*").expect("valid regex");
    static ref RE_ANY_BET: Regex = Regex::new(r"\S*بيط\S*").expect("valid regex");
    static ref RE_ANY_MBR: Regex = Regex::new(r"\S*مبر\S*").expect("valid regex");
    static ref RE_ANY_MMAR: Regex = Regex::new(r"\S*ممار\S*").expect("valid regex");
    static ref RE_ANY_BKT: Regex = Regex::new(r"\S*بكت\S*").expect("valid regex");
    static ref RE_ANY_AAQDAM: Regex = Regex::new(r"\S*ااقدم\S*").expect("valid regex");
    static ref RE_ANY_MHL: Regex = Regex::new(r"\S*محل\S*").expect("valid regex");
    static ref RE_ANY_MSO: Regex = Regex::new(r"\S*مصو\S*").expect("valid regex");
    static ref RE_ANY_SHA3: Regex = Regex::new(r"\S*شع\S*").expect("valid regex");
    static ref RE_ANY_HASIB: Regex = Regex::new(r"\S*الحاسب\S*").expect("valid regex");
    static ref RE_ANY_M3AL: Regex = Regex::new(r"\S*معال\S*").expect("valid regex");
    static ref RE_ANY_TABEE: Regex = Regex::new(r"\S*طبيع\S*").expect("valid regex");
    static ref RE_ANY_MLAH: Regex = Regex::new(r"\S*ملاح\S*").expect("valid regex");
    static ref RE_ANY_THAN: Regex = Regex::new(r"\S*ثان\S*").expect("valid regex");
    static ref RE_ANY_AMNA: Regex = Regex::new(r"\S*امنا\S*").expect("valid regex");
    static ref RE_ANY_MAKTB: Regex = Regex::new(r"\S*مكتب\S*").expect("valid regex");
    static ref RE_ANY_M3ON: Regex = Regex::new(r"\S*معون\S*").expect("valid regex");
    static ref RE_ANY_QDMY: Regex = Regex::new(r"\S*قدمى\S*").expect("valid regex");
    static ref RE_ANY_QDMI: Regex = Regex::new(r"\S*قدمي\S*").expect("valid regex");
    static ref RE_ANY_MSHH: Regex = Regex::new(r"\S*مصح\S*").expect("valid regex");
    static ref RE_ANY_HRF: Regex = Regex::new(r"\S*حرف\S*").expect("valid regex");
    static ref RE_ANY_MKHAZ: Regex = Regex::new(r"\S*مخاز\S*").expect("valid regex");
    static ref RE_ANY_MHND: Regex = Regex::new(r"\S*مهند\S*").expect("valid regex");
    static ref RE_ANY_HNDSI: Regex = Regex::new(r"\S*هندسي\S*").expect("valid regex");
    static ref RE_ANY_BEA: Regex = Regex::new(r"\S*بيئ\S*").expect("valid regex");
    static ref RE_ANY_SAE: Regex = Regex::new(r"\S*صائ\S*").expect("valid regex");
    static ref RE_ANY_SWA: Regex = Regex::new(r"\S*سوا\S*").expect("valid regex");
    static ref RE_ANY_HRQ: Regex = Regex::new(r"\S*حرق\S*").expect("valid regex");
    static ref RE_ANY_MTR: Regex = Regex::new(r"\S*متر\S*").expect("valid regex");
    static ref RE_ANY_MMREDI: Regex = Regex::new(r"\S*ممرضي\S*").expect("valid regex");
    static ref RE_ANY_MRDA: Regex = Regex::new(r"\S*مرضا\S*").expect("valid regex");
    static ref RE_ANY_ZR: Regex = Regex::new(r"\S*زر\S*").expect("valid regex");
    static ref RE_ANY_RZ: Regex = Regex::new(r"\S*رز\S*").expect("valid regex");
    static ref RE_ANY_MDRB: Regex = Regex::new(r"\S*مدرب\S*").expect("valid regex");
    static ref RE_ANY_RYAD: Regex = Regex::new(r"\S*رياض\S*").expect("valid regex");
    static ref RE_ANY_ATHA: Regex = Regex::new(r"\S*اثا\S*").expect("valid regex");
    static ref RE_ANY_RSA: Regex = Regex::new(r"\S*رسا\S*").expect("valid regex");
    static ref RE_ANY_A3L: Regex = Regex::new(r"\S*اعل\S*").expect("valid regex");
    static ref RE_ANY_SAYD: Regex = Regex::new(r"\S*صيد\S*").expect("valid regex");
    static ref RE_ANY_JAMEI: Regex = Regex::new(r"\S*جامعي\S*").expect("valid regex");
    static ref RE_ANY_MRSH: Regex = Regex::new(r"\S*مرش\S*").expect("valid regex");
    static ref RE_ANY_GHZ: Regex = Regex::new(r"\S*غذ\S*").expect("valid regex");
    static ref RE_ANY_QABL: Regex = Regex::new(r"\S*قابل\S*").expect("valid regex");
    static ref RE_ANY_MAHRA: Regex = Regex::new(r"\S*ماهرا\S*").expect("valid regex");
    static ref RE_ANY_MHA: Regex = Regex::new(r"\S*مها\S*").expect("valid regex");
    static ref RE_ANY_3MO: Regex = Regex::new(r"\S*عمو\S*").expect("valid regex");
    static ref RE_ANY_MKHM: Regex = Regex::new(r"\S*مخم\S*").expect("valid regex");
    static ref RE_ANY_MSHRF: Regex = Regex::new(r"\S*مشرف\S*").expect("valid regex");
    static ref RE_ANY_SNAD: Regex = Regex::new(r"\S*صناد\S*").expect("valid regex");
    static ref RE_HEAD_TABA3A: Regex =
        Regex::new(r"\b(رئيس)\b \S* (\bطابعة\b)").expect("valid regex");
    static ref RE_HEAD_MLAHZIN: Regex = Regex::new(r"\b رئيس\b \S*ملاحظ\S*").expect("valid regex");
    static ref RE_WORD_W_BEA: Regex = Regex::new(r"\b\S*و\S*بيئة\b").expect("valid regex");
    static ref RE_MOAWEN_MOHANDIS_ZRAI: Regex =
        Regex::new(r"\bمعاون\b \s*مهن\S* \bزرا\b").expect("valid regex");
    static ref RE_RAEES_MOHANDSIN: Regex =
        Regex::new(r"(\bرئيس\b) (\s* مهن \s*)").expect("valid regex");
    static ref RE_MOKHTABAR_TEBBI: Regex = Regex::new(r".*مختبر طبي.*").expect("valid regex");
    static ref RE_MOFAWADH: Regex = Regex::new(r"مفوض\s*(?:الدرجة|درجة|در|د)?\s*(\d+)").expect("valid regex");
    static ref RE_GRADE_B: Regex = Regex::new(r"\bب\b|\(\s*ب\s*\)").expect("valid regex");
    static ref RE_GRADE_A: Regex = Regex::new(r"\b[اأ]\b|\(\s*[اأ]\s*\)").expect("valid regex");
    static ref RE_REMOVE_RAJ: Regex = Regex::new(r"\S*رج\S*").expect("valid regex");
    static ref RE_NON_WORD_SPLIT: Regex = Regex::new(r"\W+").expect("valid regex");
    static ref RE_GRADE_1: Regex = Regex::new(r"ول\S*").expect("valid regex");
    static ref RE_GRADE_2: Regex = Regex::new(r"ثان\S*").expect("valid regex");
    static ref RE_GRADE_3: Regex = Regex::new(r"ثال\S*").expect("valid regex");
    static ref RE_GRADE_4: Regex = Regex::new(r"را\S*").expect("valid regex");
    static ref RE_GRADE_5: Regex = Regex::new(r"خام\S*").expect("valid regex");
    static ref RE_GRADE_6: Regex = Regex::new(r"ساد\S*").expect("valid regex");
    static ref RE_GRADE_7: Regex = Regex::new(r"ساب\S*").expect("valid regex");
    static ref RE_GRADE_8: Regex = Regex::new(r"ثام\S*").expect("valid regex");
    static ref RE_GRADE_9: Regex = Regex::new(r"تاس\S*").expect("valid regex");
    static ref RE_GRADE_10: Regex = Regex::new(r"عا\S*").expect("valid regex");
}

fn has(word: &str, needle: &str) -> bool {
    word.contains(needle)
}

fn replace_literal_chain(mut text: String, pairs: &[(&str, &str)]) -> String {
    for (from, to) in pairs {
        text = text.replace(from, to);
    }
    text
}

fn replace_regex_chain<'a>(mut text: String, pairs: &[(&'a Regex, &'a str)]) -> String {
    for (re, to) in pairs {
        text = re.replace_all(&text, *to).into_owned();
    }
    text
}

pub fn clean_job_grade_column(text: &str) -> Result<String, CleanerError> {
    if RE_GRADE_B.is_match(text) {
        return Ok("عليا ب".to_string());
    }
    if RE_GRADE_A.is_match(text) {
        return Ok("عليا ا".to_string());
    }

    let mut cleaned = RE_REMOVE_RAJ.replace_all(text, "").trim().to_string();
    cleaned = replace_literal_chain(
        cleaned,
        &[("علياب", "عليا ب"), ("علياا", "عليا ا"), ("علياأ", "عليا ا")],
    );

    let first_word = RE_NON_WORD_SPLIT
        .split(cleaned.trim())
        .find(|part| !part.is_empty())
        .unwrap_or("");

    if RE_GRADE_1.is_match(first_word) {
        Ok("1".to_string())
    } else if RE_GRADE_2.is_match(first_word) {
        Ok("2".to_string())
    } else if RE_GRADE_3.is_match(first_word) {
        Ok("3".to_string())
    } else if RE_GRADE_4.is_match(first_word) {
        Ok("4".to_string())
    } else if RE_GRADE_5.is_match(first_word) {
        Ok("5".to_string())
    } else if RE_GRADE_6.is_match(first_word) {
        Ok("6".to_string())
    } else if RE_GRADE_7.is_match(first_word) {
        Ok("7".to_string())
    } else if RE_GRADE_8.is_match(first_word) {
        Ok("8".to_string())
    } else if RE_GRADE_9.is_match(first_word) {
        Ok("9".to_string())
    } else if RE_GRADE_10.is_match(first_word) {
        Ok("10".to_string())
    } else {
        Ok(cleaned)
    }
}

pub fn clean_job_title_column(text: &str, is_military: bool) -> Result<String, CleanerError> {
    let mut cleaned = replace_literal_chain(
        text.to_string(),
        &[
            (".", " "),
            (",", " "),
            ("-", " "),
            ("/", " "),
            ("ى", "ي"),
            ("ـ", ""),
            ("0", " "),
            ("ر ئيس", "رئيس"),
            ("مديراقدم", "مدير اقدم"),
            ("مديرتدقيق", "مدير تدقيق"),
            ("اختصاص نظم و معلومات", "اختصاص نظم ومعلومات"),
            ("سايق", "سائق"),
            ("و بيئة", "بيئة"),
            ("وبيئة", "بيئة"),
            ("بينات", "بيانات"),
            ("طابعةاقدم", "طابعة اقدم"),
            ("مديرحسابات", "مدير حسابات"),
            ("استاد", "استاذ"),
            ("ثاتي", "ثاني"),
            ("رئس", "رئيس"),
            ("ريئس", "رئيس"),
            ("نقني", "تقني"),
            ("مديرفني", "مدير فني"),
            ("مدبر", "مدير"),
            ("المدير", "مدير"),
            ("المديرالعام", "مدير عام"),
            ("مديرالعام", "مدير عام"),
            ("مدير العام", "مدير عام"),
            ("معاون تدقيق", "معاون مدقق"),
            ("مغاون", "معاون"),
            ("موضف", "موظف"),
            ("باجث", "باحث"),
            ("باخث", "باحث"),
            ("مكاتب", "مكتبة"),
            ("كاتبة", "كاتب"),
            ("معاون باحث سياسي", "مساعد باحث سياسي"),
            ("مدريب", "مدرب"),
            ("طبين", "طبي"),
            ("طبيين", "طبي"),
            ("ممر ضة", "ممرضة"),
            ("امينة", "امين"),
            ("افدم", "اقدم"),
            ("شرطي مشاة", "شرطي مشاة وطالب اعدادية شرطة"),
            ("مشاورقانوني", "مشاور قانوني"),
            ("مستشار قانوني في الوزارة", "مستشار قانوني للوزارة"),
        ],
    );

    cleaned = replace_regex_chain(
        cleaned,
        &[
            (&RE_ALEF_NORMALIZE, "ا"),
            (&RE_SINGLE_R, "رئيس"),
            (&RE_RAEES_VARIANT_1, "رئيس"),
            (&RE_RAEES_VARIANT_2, "رئيس"),
            (&RE_SINGLE_M, "معاون"),
            (&RE_SINGLE_M_WITH_SPACE, "معاون "),
            (&RE_MULTI_SPACE, " "),
            (&RE_MULTI_SPACE, " "),
            (&RE_HA_END, "ة"),
            (&RE_TA_NO_SPACE, "ة ${1}"),
            (&RE_HAMZA_NO_SPACE, "ء ${1}"),
            (&RE_WORD_AJHIZA, "اجهزة طبية"),
            (&RE_DUP_AJHIZA, "اجهزة طبية"),
            (&RE_ANY_TAFNI, "تقني"),
            (&RE_ANY_MA3LO, "معلومات"),
            (&RE_ANY_KEEM, "كيمياوي"),
            (&RE_ANY_KEMI, "كيمياوي"),
            (&RE_ANY_FEYZ, "فيزياوي"),
            (&RE_ANY_EKHT, "اختصاص"),
            (&RE_ANY_EHSA, "احصائي"),
            (&RE_ANY_MHAQ, "محقق"),
            (&RE_ANY_TEQN, "تقني"),
            (&RE_ANY_MSHGH, "مشغل"),
            (&RE_ANY_FNY_ALEF, "فني"),
            (&RE_ANY_FNY_YA, "فني"),
            (&RE_ANY_FNY_N, "فني"),
            (&RE_ANY_TEBY_Y, "طبي"),
            (&RE_ANY_MOHNDSI, "مهندسين"),
            (&RE_ANY_MDRBI, "مدربين"),
            (&RE_ANY_JELO, "جيولوجي"),
            (&RE_ANY_JIO, "جيولوجي"),
            (&RE_ANY_AWAL, "اول"),
            (&RE_ANY_BAY, "بايولوجي"),
            (&RE_ANY_BIO, "بايولوجي"),
            (&RE_ANY_BET, "بيطري"),
            (&RE_ANY_MBR, "مبرمج"),
            (&RE_ANY_MMAR, "ممارس"),
            (&RE_ANY_BKT, "بكتريولوجي"),
            (&RE_ANY_AAQDAM, "اقدم"),
            (&RE_ANY_MHL, "محلل"),
            (&RE_ANY_MSO, "مصور"),
            (&RE_ANY_SHA3, "شعاعي"),
            (&RE_ANY_HASIB, "حاسبة"),
            (&RE_ANY_M3AL, "معالج"),
            (&RE_ANY_TABEE, "طبيعي"),
            (&RE_ANY_MLAH, "ملاحظ"),
            (&RE_ANY_THAN, "ثاني"),
            (&RE_ANY_AMNA, "امين"),
            (&RE_ANY_MAKTB, "مكتبة"),
            (&RE_ANY_M3ON, "معاون"),
            (&RE_ANY_QDMY, "اقدم"),
            (&RE_ANY_QDMI, "اقدم"),
            (&RE_ANY_MSHH, "مصحح"),
            (&RE_ANY_HRF, "حرفي"),
            (&RE_ANY_MKHAZ, "مخزن"),
            (&RE_ANY_MHND, "مهندس"),
            (&RE_ANY_HNDSI, "هندسي"),
            (&RE_ANY_BEA, "بيئة"),
            (&RE_ANY_SAE, "احصائي"),
            (&RE_ANY_SWA, "سواق"),
            (&RE_ANY_HRQ, "حرفي"),
            (&RE_ANY_MTR, "مترجم"),
            (&RE_ANY_MMREDI, "ممرض"),
            (&RE_ANY_MRDA, "ممرضة"),
            (&RE_ANY_ZR, "زراعي"),
            (&RE_ANY_RZ, "زراعي"),
            (&RE_ANY_MDRB, "مدرب"),
            (&RE_ANY_RYAD, "رياضي"),
            (&RE_ANY_ATHA, "اثار"),
            (&RE_ANY_RSA, "رسام"),
            (&RE_ANY_A3L, "اعلامي"),
            (&RE_ANY_SAYD, "صيدلي"),
            (&RE_ANY_JAMEI, "جامعي"),
            (&RE_ANY_MRSH, "مرشد"),
            (&RE_ANY_GHZ, "اغذية"),
            (&RE_ANY_QABL, "قابلة"),
            (&RE_ANY_MAHRA, "ماهرة"),
            (&RE_ANY_MHA, "ماهرة"),
            (&RE_ANY_3MO, "عمومي"),
            (&RE_ANY_MKHM, "مخمن"),
            (&RE_ANY_MSHRF, "مشرف"),
            (&RE_ANY_SNAD, "صندوق"),
            (&RE_HEAD_TABA3A, "$1 كتاب $2"),
            (&RE_HEAD_MLAHZIN, "رئيس ملاحظين"),
            (&RE_WORD_W_BEA, "بيئة"),
            (&RE_MOAWEN_MOHANDIS_ZRAI, "معاون مهندس زراعي"),
            (&RE_RAEES_MOHANDSIN, "$1 مهندسين"),
            (&RE_MOKHTABAR_TEBBI, "معاون طبي/معاون مختبر طبي"),
            (&RE_MOFAWADH, "مفوض ${1}"),
        ],
    );

    cleaned = cleaned.replace("ة  ", "ة ").replace("ء  ", "ء ");
    cleaned = cleaned.trim().to_string();

    let words: Vec<&str> = cleaned.split_whitespace().collect();
    let normalized = match words.as_slice() {
        [w0, w1] if has(w0, "ممر") && has(w1, "فني") => Some("ممرض فني"),
        [w0, w1, w2, w3] if has(w0, "ممر") && has(w1, "و") && has(w2, "ممر") && has(w3, "فن") => {
            Some("ممرض فني")
        }
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "فني") && has(w2, "قدم") => Some("ممرض فني اقدم"),
        [w0, w1, w2, w3, w4]
            if has(w0, "ممر") && has(w1, "و") && has(w2, "ممر") && has(w3, "فني") && has(w4, "قدم") =>
        {
            Some("ممرض فني اقدم")
        }
        [w0, w1, w2, w3] if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "فني") => {
            Some("معاون رئيس ممرض او ممرضة فني")
        }
        [w0, w1, w2, w3, w4, w5]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "و") && has(w4, "ممر") && has(w5, "فني") =>
        {
            Some("معاون رئيس ممرض او ممرضة فني")
        }
        [w0, w1, w2] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "فني") => Some("رئيس ممرض او ممرضة فني"),
        [w0, w1, w2, w3, w4]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "و") && has(w3, "ممر") && has(w4, "فن") =>
        {
            Some("رئيس ممرض او ممرضة فني")
        }
        [w0, w1, w2, w3] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "فني") && has(w3, "قدم") => {
            Some("رئيس ممرض او ممرضة فني اقدم")
        }
        [w0, w1, w2, w3] if has(w0, "ممر") && has(w1, "و") && has(w2, "ممر") && has(w3, "قدم") => {
            Some("ممرض او ممرضة اقدم")
        }
        [w0, w1] if has(w0, "ممر") && has(w1, "قدم") => Some("ممرض او ممرضة اقدم"),
        [w0, w1] if has(w0, "ئيس") && has(w1, "ممر") => Some("رئيس ممرض او ممرضة"),
        [w0, w1, w2, w3, w4]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "و") && has(w3, "ئيس") && has(w4, "ممر") =>
        {
            Some("رئيس ممرض او ممرضة")
        }
        [w0, w1, w2] if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") => {
            Some("معاون رئيس ممرض او رئيس ممرضة")
        }
        [w0, w1, w2, w3, w4, w5]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "و") && has(w4, "ئيس") && has(w5, "ممر") =>
        {
            Some("معاون رئيس ممرض او رئيس ممرضة")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "و") && has(w4, "ممر") =>
        {
            Some("معاون رئيس ممرض او رئيس ممرضة")
        }
        [w0, w1, w2] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "قدم") => {
            Some("رئيس ممرض او رئيس ممرضة اقدم")
        }
        [w0, w1, w2, w3, w4, w5, w6]
            if has(w0, "ئيس")
                && has(w1, "ممر")
                && has(w2, "قد")
                && has(w3, "و")
                && has(w4, "ئيس")
                && has(w5, "ممر")
                && has(w6, "قد") =>
        {
            Some("رئيس ممرض او رئيس ممرضة اقدم")
        }
        [w0, w1] if has(w0, "ممر") && has(w1, "اه") => Some("ممرض او ممرضة ماهرة"),
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "اه") && has(w2, "قدم") => Some("ممرض او ممرضة ماهرة اقدم"),
        [w0, w1, w2, w3] if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "اه") => {
            Some("معاون رئيس ممرض او ممرضة ماهرة")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "ممر") && has(w4, "اه") =>
        {
            Some("معاون رئيس ممرض او ممرضة ماهرة")
        }
        [w0, w1, w2, w3, w4, w5]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "و") && has(w4, "ممر") && has(w5, "اه") =>
        {
            Some("معاون رئيس ممرض او ممرضة ماهرة")
        }
        [w0, w1, w2] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "اه") => Some("رئيس ممرض او ممرضة ماهرة"),
        [w0, w1, w2, w3] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "ممر") && has(w3, "اه") => {
            Some("رئيس ممرض او ممرضة ماهرة")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "و") && has(w3, "ممر") && has(w4, "اه") =>
        {
            Some("رئيس ممرض او ممرضة ماهرة")
        }
        [w0, w1, w2, w3] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "اه") && has(w3, "قدم") => {
            Some("رئيس ممرض او ممرضة ماهرة اقدم")
        }
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "جا") && has(w2, "تدر") => Some("ممرض وممرضة جامعي متدرب"),
        [w0, w1, w2, w3] if has(w0, "ممر") && has(w1, "ممر") && has(w2, "جا") && has(w3, "تدر") => {
            Some("ممرض وممرضة جامعي متدرب")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "ممر") && has(w1, "و") && has(w2, "ممر") && has(w3, "جا") && has(w4, "تدر") =>
        {
            Some("ممرض وممرضة جامعي متدرب")
        }
        [w0, w1] if has(w0, "ممر") && has(w1, "جا") => Some("ممرض وممرضة جامعي"),
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "ممر") && has(w2, "جا") => Some("ممرض وممرضة جامعي"),
        [w0, w1, w2, w3] if has(w0, "ممر") && has(w1, "و") && has(w2, "ممر") && has(w3, "جا") => {
            Some("ممرض وممرضة جامعي")
        }
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "جا") && has(w2, "قدم") => Some("ممرض او ممرضة جامعي اقدم"),
        [w0, w1, w2, w3] if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "جا") => {
            Some("معاون رئيس ممرض وممرضة جامعي")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "ممر") && has(w4, "جا") =>
        {
            Some("معاون رئيس ممرض وممرضة جامعي")
        }
        [w0, w1, w2, w3, w4, w5]
            if has(w0, "عا") && has(w1, "ئيس") && has(w2, "ممر") && has(w3, "و") && has(w4, "ممر") && has(w5, "جا") =>
        {
            Some("معاون رئيس ممرض وممرضة جامعي")
        }
        [w0, w1, w2] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "جا") => Some("رئيس ممرض وممرضة جامعي"),
        [w0, w1, w2, w3] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "ممر") && has(w3, "جا") => {
            Some("رئيس ممرض وممرضة جامعي")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "و") && has(w3, "ممر") && has(w4, "جا") =>
        {
            Some("رئيس ممرض وممرضة جامعي")
        }
        [w0, w1, w2, w3] if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "جا") && has(w3, "قدم") => {
            Some("رئيس ممرض وممرضة جامعي اقدم")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "ممر") && has(w3, "جا") && has(w4, "قد") =>
        {
            Some("رئيس ممرض وممرضة جامعي اقدم")
        }
        [w0, w1, w2] if has(w0, "ممر") && has(w1, "جا") && has(w2, "متدرب") => Some("ممرض وممرضة جامعي متدرب"),
        [w0, w1, w2, w3] if has(w0, "ممر") && has(w1, "ممر") && has(w2, "جا") && has(w3, "قدم") => {
            Some("ممرض او ممرضة جامعي اقدم")
        }
        [w0, w1, w2, w3]
            if has(w0, "ئيس") && has(w1, "ممر") && has(w2, "جا") && has(w3, "قدم") =>
        {
            Some("رئيس ممرض وممرضة جامعي اقدم")
        }
        [w0, w1, w2, w3, w4]
            if has(w0, "عا") && has(w1, "قن") && has(w2, "هز") && has(w3, "بي") && has(w4, "قد") =>
        {
            Some("معاون تقني اقدم اجهزة طبية")
        }
        _ => None,
    };

    let mut final_title = normalized.unwrap_or(&cleaned).to_string();
    if is_military && final_title.trim() == "عميد" {
        final_title = "عميد عسكري".to_string();
    }
    Ok(final_title)
}
