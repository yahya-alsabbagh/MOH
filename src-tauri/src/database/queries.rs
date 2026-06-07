use duckdb::Connection;
use serde::Serialize;
use crate::database::setup::get_db_path;

#[derive(Debug, Serialize)]
pub struct DepartmentMetric {
    pub id: i64,
    pub ministry: Option<String>,
    pub directorate: Option<String>,
    pub approval_year: Option<i32>,
    pub job_title: Option<String>,
    pub job_grade: Option<String>,
    pub job_code: Option<String>,
    pub male_count: Option<i32>,
    pub female_count: Option<i32>,
    pub vacant_count: Option<i32>,
    pub total_count: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct KpiSummary {
    pub total_male: i64,
    pub total_female: i64,
    pub total_vacant: i64,
    pub total_count: i64,
}

pub fn fetch_all_metrics() -> Result<Vec<DepartmentMetric>, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, ministry, directorate, approval_year, job_title, job_grade, job_code, 
                    male_count, female_count, vacant_count, total_count 
             FROM department_metrics 
             ORDER BY job_title ASC",
        )
        .map_err(|e| e.to_string())?;

    let metrics_iter = stmt
        .query_map([], |row| {
            Ok(DepartmentMetric {
                id: row.get(0)?,
                ministry: row.get(1)?,
                directorate: row.get(2)?,
                approval_year: row.get(3)?,
                job_title: row.get(4)?,
                job_grade: row.get(5)?,
                job_code: row.get(6)?,
                male_count: row.get(7)?,
                female_count: row.get(8)?,
                vacant_count: row.get(9)?,
                total_count: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for metric in metrics_iter {
        if let Ok(m) = metric {
            result.push(m);
        }
    }

    Ok(result)
}

pub fn fetch_kpi_summary() -> Result<KpiSummary, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT 
                CAST(COALESCE(SUM(male_count), 0) AS BIGINT), 
                CAST(COALESCE(SUM(female_count), 0) AS BIGINT), 
                CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT), 
                CAST(COALESCE(SUM(total_count), 0) AS BIGINT) 
             FROM department_metrics",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let total_male: i64 = row.get(0).unwrap_or(0);
        let total_female: i64 = row.get(1).unwrap_or(0);
        let total_vacant: i64 = row.get(2).unwrap_or(0);
        let total_count: i64 = row.get(3).unwrap_or(0);

        Ok(KpiSummary {
            total_male,
            total_female,
            total_vacant,
            total_count,
        })
    } else {
        Ok(KpiSummary {
            total_male: 0,
            total_female: 0,
            total_vacant: 0,
            total_count: 0,
        })
    }
}
