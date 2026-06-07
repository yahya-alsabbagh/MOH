use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Employee {
    pub raw_name: String,
    pub cleaned_name: String,
    pub raw_title: String,
    pub cleaned_title: String,
    pub raw_grade: String,
    pub cleaned_grade: String,
    pub job_code: String,
    pub is_duplicate: bool,
}

impl Employee {
    pub fn new(
        raw_name: impl Into<String>,
        raw_title: impl Into<String>,
        raw_grade: impl Into<String>,
        job_code: impl Into<String>,
    ) -> Self {
        let raw_name = raw_name.into();
        let raw_title = raw_title.into();
        let raw_grade = raw_grade.into();

        Self {
            cleaned_name: raw_name.clone(),
            cleaned_title: raw_title.clone(),
            cleaned_grade: raw_grade.clone(),
            raw_name,
            raw_title,
            raw_grade,
            job_code: job_code.into(),
            is_duplicate: false,
        }
    }
}
