use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, Emitter};

#[tauri::command]
async fn open_popout(app: tauri::AppHandle, session_id: String) -> Result<(), String> {
    let window_label = format!("popout_{}", session_id);
    let url = format!("/popout/{}", session_id);
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    
    let window = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title("Nexterm - Session")
        .inner_size(1024.0, 768.0)
        .min_inner_size(640.0, 480.0)
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;
    
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let _ = app_clone.emit_to("main", "popout_closed", &session_id_clone);
        }
    });
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![open_popout])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
