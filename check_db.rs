use duckdb::{Connection, Result};

fn main() -> Result<()> {
    let path = r"C:\Users\LENOVO\AppData\Roaming\moh\auth\data\analytics.db";
    let conn = Connection::open(path)?;
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM hierarchy_lookup")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let count: i64 = row.get(0).unwrap_or(0);
        println!("Count: {}", count);
    }
    
    let mut stmt = conn.prepare("SELECT * FROM hierarchy_lookup LIMIT 5")?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let min_code: i32 = row.get(0).unwrap_or(0);
        let min_name: String = row.get(1).unwrap_or("".to_string());
        let dept_code: i32 = row.get(2).unwrap_or(0);
        let dept_name: String = row.get(3).unwrap_or("".to_string());
        println!("{} | {} | {} | {}", min_code, min_name, dept_code, dept_name);
    }
    Ok(())
}
