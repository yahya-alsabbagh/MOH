#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![recursion_limit = "256"]

mod commands;
mod core;
mod security;
mod database;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Increment the run count. If it fails (quota exceeded / decoy missing),
            // the frontend's get_license_status() call will catch it and show the lock screen.
            let _ = crate::security::license::increment_run_count();

            // Initialize the Monotonic session timer from the saved license data.
            // This must run AFTER increment_run_count so the file is up-to-date.
            crate::commands::init_session_from_license();

            // Initialize DuckDB Database
            if let Err(e) = crate::database::setup::initialize_db() {
                eprintln!("Failed to initialize database: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_license_status,
            commands::renew_license_backdoor,
            commands::run_duplicate_check,
            commands::run_title_validation,
            commands::read_excel_headers,
            commands::get_reference_data,
            commands::run_aggregation,
            commands::toggle_admin_status,
            commands::get_admin_status,
            commands::import_data_to_db,
            commands::fetch_all_metrics,
            commands::fetch_kpi_summary,
            commands::fetch_filter_options,
            commands::fetch_filtered_analytics,
            commands::fetch_database_summary,
            commands::delete_dataset,
            commands::toggle_delete_status,
            commands::get_delete_status,
            commands::toggle_upload_status,
            commands::get_upload_status,
            commands::toggle_analytics_status,
            commands::get_analytics_status,
            commands::fetch_hierarchy_options,
            commands::fetch_dataset_details,
            commands::update_dataset_records,
            commands::export_dataset_to_excel,
            commands::run_smart_duplicate_scan,
            commands::export_smart_scan_excel,
            commands::import_employees_to_db,
            commands::align_employee_columns,
            commands::fetch_employees_summary,
            commands::fetch_employee_details,
            commands::fetch_employee_columns,
            commands::delete_employee_dataset,
            commands::export_employees_to_excel,
            commands::search_employees_globally
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}

