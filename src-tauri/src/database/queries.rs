use duckdb::Connection;
use serde::{Deserialize, Serialize};
use crate::database::setup::get_db_path;

#[derive(Debug, Serialize, Deserialize)]
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
    pub total_count: i64,
    pub total_vacant: i64,
}

#[derive(Debug, Serialize)]
pub struct PieChartData {
    pub total_male: i64,
    pub total_female: i64,
    pub total_vacant: i64,
}

#[derive(Debug, Serialize)]
pub struct DatabaseSummary {
    pub ministry: Option<String>,
    pub directorate: Option<String>,
    pub approval_year: Option<i32>,
    pub records_count: i64,
    pub total_employees: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DeptInfo {
    pub dept_code: i32,
    pub dept_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct MinistryHierarchy {
    pub ministry_code: i32,
    pub ministry_name: String,
    pub departments: Vec<DeptInfo>,
}

pub fn fetch_all_metrics() -> Result<Vec<DepartmentMetric>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, ministry, directorate, approval_year, job_title, job_grade, job_code, 
                    male_count, female_count, vacant_count, total_count 
             FROM department_metrics 
             WHERE (job_title IS NULL OR (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %' AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%' AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%'))
             AND (job_grade IS NULL OR (job_grade NOT LIKE 'مجموع %' AND job_grade NOT LIKE 'المجموع %' AND job_grade != 'المجموع' AND job_grade NOT LIKE '%مجموع كلي%'))
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
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT 
            CAST(COALESCE(SUM(male_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(female_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(male_count + female_count), 0) AS BIGINT),
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT)
         FROM department_metrics
         WHERE (job_title IS NULL OR (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %' AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%' AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%'))
         AND (job_grade IS NULL OR (job_grade NOT LIKE 'مجموع %' AND job_grade NOT LIKE 'المجموع %' AND job_grade != 'المجموع' AND job_grade NOT LIKE '%مجموع كلي%'))"
    ).map_err(|e| e.to_string())?;

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let total_male: i64 = row.get(0).unwrap_or(0);
        let total_female: i64 = row.get(1).unwrap_or(0);
        let total_count: i64 = row.get(2).unwrap_or(0);
        let total_vacant: i64 = row.get(3).unwrap_or(0);

        Ok(KpiSummary {
            total_male,
            total_female,
            total_count,
            total_vacant,
        })
    } else {
        Ok(KpiSummary {
            total_male: 0,
            total_female: 0,
            total_count: 0,
            total_vacant: 0,
        })
    }
}

pub fn fetch_database_summary() -> Result<Vec<DatabaseSummary>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ministry, directorate, approval_year, CAST(COUNT(*) AS BIGINT) as records_count, CAST(COALESCE(SUM(total_count), 0) AS BIGINT) as total_employees
             FROM department_metrics 
             WHERE (job_title IS NULL OR (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %' AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%' AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%'))
             AND (job_grade IS NULL OR (job_grade NOT LIKE 'مجموع %' AND job_grade NOT LIKE 'المجموع %' AND job_grade != 'المجموع' AND job_grade NOT LIKE '%مجموع كلي%'))
             GROUP BY ministry, directorate, approval_year
             ORDER BY approval_year DESC, ministry ASC",
        )
        .map_err(|e| e.to_string())?;

    let summaries_iter = stmt
        .query_map([], |row| {
            Ok(DatabaseSummary {
                ministry: row.get(0)?,
                directorate: row.get(1)?,
                approval_year: row.get(2)?,
                records_count: row.get(3)?,
                total_employees: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for summary in summaries_iter {
        if let Ok(s) = summary {
            result.push(s);
        }
    }

    Ok(result)
}

pub fn delete_dataset(ministry: String, directorate: String, approval_year: i32) -> Result<usize, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let count = conn.execute(
        "DELETE FROM department_metrics WHERE ministry = ? AND directorate = ? AND approval_year = ?",
        duckdb::params![ministry, directorate, approval_year],
    ).map_err(|e| e.to_string())?;

    Ok(count)
}

#[derive(Debug, Serialize)]
pub struct GradeDistributionData {
    pub job_grade: String,
    pub count: i64,
    pub vacant_count: i64,
}

#[derive(Debug, Serialize)]
pub struct GenderParityData {
    pub job_title: String,
    pub males: i64,
    pub females: i64,
    pub vacancies: i64,
    pub total: i64,
}



#[derive(Debug, Serialize)]
pub struct FilterOptions {
    pub ministries: Vec<String>,
    pub directorates: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub kpis: KpiSummary,
    pub pie_chart_data: PieChartData,
    pub grade_distribution: Vec<GradeDistributionData>,
    pub gender_parity: Vec<GenderParityData>,
    pub grid_data: Vec<DepartmentMetric>,
    pub total_records: usize,
}

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

pub fn fetch_filter_options(ministry: Option<String>) -> Result<FilterOptions, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut ministries = Vec::new();
    let mut stmt = conn.prepare("SELECT DISTINCT ministry FROM department_metrics WHERE ministry IS NOT NULL ORDER BY ministry ASC").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        if let Ok(m) = row.get::<_, String>(0) {
            ministries.push(m);
        }
    }

    let mut directorates = Vec::new();
    let query = if ministry.is_some() {
        "SELECT DISTINCT directorate FROM department_metrics WHERE directorate IS NOT NULL AND ministry = ? ORDER BY directorate ASC".to_string()
    } else {
        "SELECT DISTINCT directorate FROM department_metrics WHERE directorate IS NOT NULL ORDER BY directorate ASC".to_string()
    };
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let mut rows = if let Some(ref m) = ministry {
        stmt.query([m]).map_err(|e| e.to_string())?
    } else {
        stmt.query([]).map_err(|e| e.to_string())?
    };
    
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        if let Ok(d) = row.get::<_, String>(0) {
            directorates.push(d);
        }
    }

    Ok(FilterOptions {
        ministries,
        directorates,
    })
}

pub fn fetch_filtered_analytics(
    ministry: Option<String>,
    directorate: Option<String>,
    search: Option<String>,
    page: usize,
    page_size: usize,
) -> Result<AnalyticsResponse, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut conditions = vec!["1=1".to_string()];
    let mut params: Vec<String> = Vec::new();

    let is_dept_selected = directorate.as_ref().map_or(false, |d| !d.is_empty());

    if let Some(m) = ministry {
        if !m.is_empty() {
            conditions.push("ministry = ?".to_string());
            params.push(m);
        }
    }
    
    if let Some(d) = directorate {
        if !d.is_empty() {
            conditions.push("directorate = ?".to_string());
            params.push(d);
        }
    }

    if let Some(s) = search {
        if !s.is_empty() {
            conditions.push("job_title = ?".to_string());
            params.push(s);
        }
    }

    // Exclude garbage total rows that might have been imported previously
    conditions.push("(job_title IS NULL OR (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %' AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%' AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%'))".to_string());
    conditions.push("(job_grade IS NULL OR (job_grade NOT LIKE 'مجموع %' AND job_grade NOT LIKE 'المجموع %' AND job_grade != 'المجموع' AND job_grade NOT LIKE '%مجموع كلي%'))".to_string());

    let where_clause = conditions.join(" AND ");

    // 1. Fetch KPIs
    let kpi_query = format!(
        "SELECT 
            CAST(COALESCE(SUM(male_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(female_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(male_count + female_count), 0) AS BIGINT),
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT)
         FROM department_metrics WHERE {}",
         where_clause
    );

    let mut kpi_stmt = conn.prepare(&kpi_query).map_err(|e| e.to_string())?;
    let mut kpi_rows = kpi_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    
    let mut kpis = KpiSummary {
        total_male: 0,
        total_female: 0,
        total_count: 0,
        total_vacant: 0,
    };

    if let Some(row) = kpi_rows.next().map_err(|e| e.to_string())? {
        kpis.total_male = row.get(0).unwrap_or(0);
        kpis.total_female = row.get(1).unwrap_or(0);
        kpis.total_count = row.get(2).unwrap_or(0);
        kpis.total_vacant = row.get(3).unwrap_or(0);
    }

    // 2. Grade Distribution (Grade Pyramid)
    let grade_dist_query = format!(
        "SELECT job_grade, 
            CAST(COALESCE(SUM(male_count + female_count), 0) AS BIGINT) as count,
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT) as vacant_count
         FROM department_metrics WHERE {} AND job_grade IS NOT NULL AND job_grade != ''
         GROUP BY job_grade
         ORDER BY CASE 
            WHEN TRIM(REPLACE(job_grade, 'أ', 'ا')) IN ('عليا ا', 'عليا ا ') THEN 1
            WHEN TRIM(job_grade) IN ('عليا ب', 'عليا ب ') THEN 2
            WHEN TRIM(job_grade) IN ('1', 'الاولى', 'الأولى') THEN 3
            WHEN TRIM(job_grade) IN ('2', 'الثانية') THEN 4
            WHEN TRIM(job_grade) IN ('3', 'الثالثة') THEN 5
            WHEN TRIM(job_grade) IN ('4', 'الرابعة') THEN 6
            WHEN TRIM(job_grade) IN ('5', 'الخامسة') THEN 7
            WHEN TRIM(job_grade) IN ('6', 'السادسة') THEN 8
            WHEN TRIM(job_grade) IN ('7', 'السابعة') THEN 9
            WHEN TRIM(job_grade) IN ('8', 'الثامنة') THEN 10
            WHEN TRIM(job_grade) IN ('9', 'التاسعة') THEN 11
            WHEN TRIM(job_grade) IN ('10', 'العاشرة') THEN 12
            ELSE 99 END ASC",
         where_clause
    );
    let mut grade_stmt = conn.prepare(&grade_dist_query).map_err(|e| e.to_string())?;
    let mut grade_rows = grade_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let mut grade_distribution: Vec<GradeDistributionData> = Vec::new();
    while let Some(row) = grade_rows.next().map_err(|e| e.to_string())? {
        let raw_grade: String = row.get(0).unwrap_or_default();
        let mapped_grade = map_grade_to_arabic(&raw_grade);
        let count: i64 = row.get(1).unwrap_or(0);
        let vacant_count: i64 = row.get(2).unwrap_or(0);
        
        if let Some(existing) = grade_distribution.iter_mut().find(|g| g.job_grade == mapped_grade) {
            existing.count += count;
            existing.vacant_count += vacant_count;
        } else {
            grade_distribution.push(GradeDistributionData {
                job_grade: mapped_grade,
                count,
                vacant_count,
            });
        }
    }

    // 3. Gender Parity (Top 10 Job Titles)
    let parity_query = format!(
        "SELECT job_title, 
            CAST(COALESCE(SUM(male_count), 0) AS BIGINT) as males,
            CAST(COALESCE(SUM(female_count), 0) AS BIGINT) as females,
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT) as vacancies,
            CAST(COALESCE(SUM(male_count + female_count), 0) AS BIGINT) as total
         FROM department_metrics WHERE {} AND job_title IS NOT NULL AND job_title != ''
         GROUP BY job_title
         ORDER BY total DESC
         LIMIT 10",
         where_clause
    );
    let mut parity_stmt = conn.prepare(&parity_query).map_err(|e| e.to_string())?;
    let mut parity_rows = parity_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let mut gender_parity = Vec::new();
    while let Some(row) = parity_rows.next().map_err(|e| e.to_string())? {
        gender_parity.push(GenderParityData {
            job_title: row.get(0).unwrap_or_default(),
            males: row.get(1).unwrap_or(0),
            females: row.get(2).unwrap_or(0),
            vacancies: row.get(3).unwrap_or(0),
            total: row.get(4).unwrap_or(0),
        });
    }

    // 3. Grid Data (Paginated)
    let count_query = format!("SELECT COUNT(*) FROM department_metrics WHERE {}", where_clause);
    let mut count_stmt = conn.prepare(&count_query).map_err(|e| e.to_string())?;
    let mut count_rows = count_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let total_records: usize = if let Some(row) = count_rows.next().map_err(|e| e.to_string())? {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    let offset = page * page_size;
    let grid_query = format!(
        "SELECT id, ministry, directorate, approval_year, job_title, job_grade, job_code, 
                male_count, female_count, vacant_count, total_count 
         FROM department_metrics WHERE {} 
         ORDER BY CASE 
            WHEN TRIM(REPLACE(job_grade, 'أ', 'ا')) IN ('عليا ا', 'عليا ا ') THEN 1
            WHEN TRIM(job_grade) IN ('عليا ب', 'عليا ب ') THEN 2
            WHEN TRIM(job_grade) IN ('1', 'الاولى', 'الأولى') THEN 3
            WHEN TRIM(job_grade) IN ('2', 'الثانية') THEN 4
            WHEN TRIM(job_grade) IN ('3', 'الثالثة') THEN 5
            WHEN TRIM(job_grade) IN ('4', 'الرابعة') THEN 6
            WHEN TRIM(job_grade) IN ('5', 'الخامسة') THEN 7
            WHEN TRIM(job_grade) IN ('6', 'السادسة') THEN 8
            WHEN TRIM(job_grade) IN ('7', 'السابعة') THEN 9
            WHEN TRIM(job_grade) IN ('8', 'الثامنة') THEN 10
            WHEN TRIM(job_grade) IN ('9', 'التاسعة') THEN 11
            WHEN TRIM(job_grade) IN ('10', 'العاشرة') THEN 12
            ELSE 99 END ASC, job_title ASC 
         LIMIT {} OFFSET {}",
         where_clause, page_size, offset
    );

    let mut grid_stmt = conn.prepare(&grid_query).map_err(|e| e.to_string())?;
    let mut grid_rows = grid_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let mut grid_data = Vec::new();
    
    while let Some(row) = grid_rows.next().map_err(|e| e.to_string())? {
        let raw_grade: String = row.get(5).unwrap_or_default();
        grid_data.push(DepartmentMetric {
            id: row.get(0).unwrap_or(0),
            ministry: row.get(1).unwrap_or_default(),
            directorate: row.get(2).unwrap_or_default(),
            approval_year: row.get(3).unwrap_or_default(),
            job_title: row.get(4).unwrap_or_default(),
            job_grade: Some(map_grade_to_arabic(&raw_grade)),
            job_code: row.get(6).unwrap_or_default(),
            male_count: row.get(7).unwrap_or_default(),
            female_count: row.get(8).unwrap_or_default(),
            vacant_count: row.get(9).unwrap_or_default(),
            total_count: row.get(10).unwrap_or_default(),
        });
    }

    Ok(AnalyticsResponse {
        pie_chart_data: PieChartData {
            total_male: kpis.total_male,
            total_female: kpis.total_female,
            total_vacant: kpis.total_vacant,
        },
        kpis,
        grade_distribution,
        gender_parity,
        grid_data,
        total_records,
    })
}

pub fn fetch_hierarchy_options() -> Result<Vec<MinistryHierarchy>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT ministry_code, ministry_name, dept_code, dept_name 
         FROM hierarchy_lookup 
         ORDER BY ministry_code, dept_code"
    ).map_err(|e| e.to_string())?;

    let rows_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i32>(2)?,
            row.get::<_, String>(3)?
        ))
    }).map_err(|e| e.to_string())?;

    let mut map: std::collections::BTreeMap<i32, MinistryHierarchy> = std::collections::BTreeMap::new();

    for row in rows_iter {
        if let Ok((ministry_code, ministry_name, dept_code, dept_name)) = row {
            let entry = map.entry(ministry_code).or_insert_with(|| MinistryHierarchy {
                ministry_code,
                ministry_name,
                departments: Vec::new(),
            });
            entry.departments.push(DeptInfo { dept_code, dept_name });
        }
    }

    Ok(map.into_values().collect())
}

pub fn fetch_dataset_details(ministry: String, directorate: String, approval_year: i32) -> Result<Vec<DepartmentMetric>, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, ministry, directorate, approval_year, job_title, job_grade, job_code, 
                    male_count, female_count, vacant_count, total_count 
             FROM department_metrics 
             WHERE ministry = ? AND directorate = ? AND approval_year = ?
             AND (job_title IS NULL OR (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %' AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%' AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%'))
             AND (job_grade IS NULL OR (job_grade NOT LIKE 'مجموع %' AND job_grade NOT LIKE 'المجموع %' AND job_grade != 'المجموع' AND job_grade NOT LIKE '%مجموع كلي%'))
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let metrics_iter = stmt
        .query_map(duckdb::params![ministry, directorate, approval_year], |row| {
            Ok(DepartmentMetric {
                id: row.get(0)?,
                ministry: row.get(1)?,
                directorate: row.get(2)?,
                approval_year: row.get(3)?,
                job_title: row.get(4)?,
                job_grade: row.get::<_, Option<String>>(5)?.map(|g| map_grade_to_arabic(&g)),
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

pub fn update_dataset_records(ministry: String, directorate: String, approval_year: i32, records: Vec<DepartmentMetric>) -> Result<usize, String> {
    let _lock = crate::database::setup::DB_LOCK.lock().unwrap();
    let db_path = get_db_path()?;
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 1. Delete all existing records for this dataset
    tx.execute(
        "DELETE FROM department_metrics WHERE ministry = ? AND directorate = ? AND approval_year = ?",
        duckdb::params![ministry, directorate, approval_year],
    ).map_err(|e| e.to_string())?;

    // 2. Insert all new/updated records
    let mut stmt = tx.prepare(
        "INSERT INTO department_metrics (
            ministry, directorate, approval_year,
            job_title, job_grade, job_code,
            male_count, female_count, vacant_count, total_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).map_err(|e| e.to_string())?;

    let mut inserted_count = 0;
    for record in records {
        stmt.execute(duckdb::params![
            ministry,
            directorate,
            approval_year,
            record.job_title,
            record.job_grade,
            record.job_code,
            record.male_count,
            record.female_count,
            record.vacant_count,
            record.total_count
        ]).map_err(|e| e.to_string())?;
        inserted_count += 1;
    }

    drop(stmt);
    tx.commit().map_err(|e| e.to_string())?;

    Ok(inserted_count)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fetch_hierarchy() {
        crate::database::setup::initialize_db().unwrap();
        let opts = fetch_hierarchy_options().unwrap();
        println!("Hierarchy count: {}", opts.len());
        for opt in opts.iter().take(2) {
            println!("Ministry: {} - {}", opt.ministry_code, opt.ministry_name);
            for dept in opt.departments.iter().take(2) {
                println!("  Dept: {} - {}", dept.dept_code, dept.dept_name);
            }
        }
        assert!(opts.len() > 0, "Hierarchy is empty!");
    }
}
