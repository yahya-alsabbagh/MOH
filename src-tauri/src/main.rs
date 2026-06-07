#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![recursion_limit = "256"]

mod commands;
mod core;
mod security;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            // Increment the run count. If it fails (quota exceeded / decoy missing),
            // the frontend's get_license_status() call will catch it and show the lock screen.
            let _ = crate::security::license::increment_run_count();

            // Initialize the Monotonic session timer from the saved license data.
            // This must run AFTER increment_run_count so the file is up-to-date.
            crate::commands::init_session_from_license();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_license_status,
            commands::renew_license_backdoor,
            commands::run_duplicate_check,
            commands::run_title_validation,
            commands::read_excel_headers,
            commands::get_reference_data,
            commands::run_aggregation
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
