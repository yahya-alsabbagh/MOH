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

#[derive(Debug, Serialize)]
pub struct BarChartData {
    pub directorate: String,
    pub total_vacant: i64,
    pub total_count: i64,
}

#[derive(Debug, Serialize)]
pub struct PieChartData {
    pub total_male: i64,
    pub total_female: i64,
}

#[derive(Debug, Serialize)]
pub struct FilterOptions {
    pub ministries: Vec<String>,
    pub directorates: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub kpis: KpiSummary,
    pub bar_chart_data: Vec<BarChartData>,
    pub pie_chart_data: PieChartData,
    pub grid_data: Vec<DepartmentMetric>,
    pub total_records: usize,
}

pub fn fetch_filter_options(ministry: Option<String>) -> Result<FilterOptions, String> {
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
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut conditions = vec!["1=1".to_string()];
    let mut params: Vec<String> = Vec::new();

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
            conditions.push("job_title LIKE ?".to_string());
            params.push(format!("%{}%", s));
        }
    }

    let where_clause = conditions.join(" AND ");

    // 1. Fetch KPIs
    let kpi_query = format!(
        "SELECT 
            CAST(COALESCE(SUM(male_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(female_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT), 
            CAST(COALESCE(SUM(total_count), 0) AS BIGINT) 
         FROM department_metrics WHERE {}",
         where_clause
    );

    let mut kpi_stmt = conn.prepare(&kpi_query).map_err(|e| e.to_string())?;
    let mut kpi_rows = kpi_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    
    let mut kpis = KpiSummary {
        total_male: 0,
        total_female: 0,
        total_vacant: 0,
        total_count: 0,
    };

    if let Some(row) = kpi_rows.next().map_err(|e| e.to_string())? {
        kpis.total_male = row.get(0).unwrap_or(0);
        kpis.total_female = row.get(1).unwrap_or(0);
        kpis.total_vacant = row.get(2).unwrap_or(0);
        kpis.total_count = row.get(3).unwrap_or(0);
    }

    // 2. Bar Chart Data (grouped by directorate)
    let bar_chart_query = format!(
        "SELECT directorate, 
            CAST(COALESCE(SUM(vacant_count), 0) AS BIGINT) as total_vacant,
            CAST(COALESCE(SUM(total_count), 0) AS BIGINT) as total_count
         FROM department_metrics WHERE {} AND directorate IS NOT NULL
         GROUP BY directorate
         ORDER BY total_count DESC",
         where_clause
    );
    let mut bar_stmt = conn.prepare(&bar_chart_query).map_err(|e| e.to_string())?;
    let mut bar_rows = bar_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let mut bar_chart_data = Vec::new();
    while let Some(row) = bar_rows.next().map_err(|e| e.to_string())? {
        bar_chart_data.push(BarChartData {
            directorate: row.get(0).unwrap_or_default(),
            total_vacant: row.get(1).unwrap_or(0),
            total_count: row.get(2).unwrap_or(0),
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
         ORDER BY job_title ASC 
         LIMIT {} OFFSET {}",
         where_clause, page_size, offset
    );

    let mut grid_stmt = conn.prepare(&grid_query).map_err(|e| e.to_string())?;
    let mut grid_rows = grid_stmt.query(duckdb::params_from_iter(params.iter())).map_err(|e| e.to_string())?;
    let mut grid_data = Vec::new();
    
    while let Some(row) = grid_rows.next().map_err(|e| e.to_string())? {
        grid_data.push(DepartmentMetric {
            id: row.get(0).unwrap_or(0),
            ministry: row.get(1).unwrap_or_default(),
            directorate: row.get(2).unwrap_or_default(),
            approval_year: row.get(3).unwrap_or_default(),
            job_title: row.get(4).unwrap_or_default(),
            job_grade: row.get(5).unwrap_or_default(),
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
        },
        kpis,
        bar_chart_data,
        grid_data,
        total_records,
    })
}
