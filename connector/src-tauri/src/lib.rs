use tauri::{WebviewUrl, WebviewWindowBuilder, Emitter};
use std::sync::Arc;

mod tunnel;
use tunnel::{TunnelConfig, TunnelManager, TunnelStatus};

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

#[tauri::command]
async fn open_tunnel_window(app: tauri::AppHandle, entry_id: i64, entry_name: String) -> Result<(), String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let window_label = format!("tunnel_{}_{}", entry_id, timestamp);
    let url = format!("/tunnel/{}?name={}", entry_id, urlencoding::encode(&entry_name));
    
    WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title(format!("Port Forward - {}", entry_name))
        .inner_size(500.0, 600.0)
        .resizable(false)
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn start_tunnel(
    state: tauri::State<'_, Arc<TunnelManager>>,
    config: TunnelConfig,
) -> Result<TunnelStatus, String> {
    state.start_tunnel(config).await
}

#[tauri::command]
async fn stop_tunnel(
    state: tauri::State<'_, Arc<TunnelManager>>,
    id: String,
) -> Result<(), String> {
    state.stop_tunnel(&id).await
}

#[tauri::command]
async fn list_tunnels(
    state: tauri::State<'_, Arc<TunnelManager>>,
) -> Result<Vec<TunnelStatus>, String> {
    Ok(state.list_tunnels().await)
}

#[tauri::command]
async fn get_tunnel_status(
    state: tauri::State<'_, Arc<TunnelManager>>,
    id: String,
) -> Result<Option<TunnelStatus>, String> {
    Ok(state.get_tunnel_status(&id).await)
}

pub mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tunnel_manager = Arc::new(TunnelManager::new());
    
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(tunnel_manager)
        .invoke_handler(tauri::generate_handler![
            open_popout,
            open_tunnel_window,
            start_tunnel,
            stop_tunnel,
            list_tunnels,
            get_tunnel_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
