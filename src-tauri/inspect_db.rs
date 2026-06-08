use duckdb::Connection;
use directories::ProjectDirs;

fn main() {
    let proj_dirs = ProjectDirs::from("com", "moh", "auth").unwrap();
    let db_path = proj_dirs.data_dir().join("analytics.db");
    println!("DB Path: {:?}", db_path);
    
    let conn = Connection::open(&db_path).unwrap();
    let mut stmt = conn.prepare("SELECT job_title, male_count, female_count FROM department_metrics WHERE job_title LIKE '%مبرمج%' LIMIT 5").unwrap();
    
    let mut rows = stmt.query([]).unwrap();
    while let Some(row) = rows.next().unwrap() {
        let title: Option<String> = row.get(0).unwrap_or(None);
        let male: Option<i32> = row.get(1).unwrap_or(None);
        let female: Option<i32> = row.get(2).unwrap_or(None);
        println!("Title: {:?}, Male: {:?}, Female: {:?}", title, male, female);
    }
}
