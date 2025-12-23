use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{Mutex, RwLock};
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelConfig {
    pub id: String,
    pub server_url: String,
    pub token: String,
    pub entry_id: i64,
    pub identity_id: i64,
    pub remote_host: String,
    pub remote_port: u16,
    pub local_port: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct TunnelStatus {
    pub id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub entry_id: i64,
    pub status: String,
    pub error: Option<String>,
}

struct TunnelHandle {
    status: Arc<Mutex<TunnelStatus>>,
    cancel_tx: tokio::sync::broadcast::Sender<()>,
}

pub struct TunnelManager {
    tunnels: RwLock<HashMap<String, TunnelHandle>>,
}

impl TunnelManager {
    pub fn new() -> Self {
        Self { tunnels: RwLock::new(HashMap::new()) }
    }

    pub async fn start_tunnel(&self, config: TunnelConfig) -> Result<TunnelStatus, String> {
        if self.tunnels.read().await.contains_key(&config.id) {
            return Err("Tunnel with this ID already exists".to_string());
        }

        let status = Arc::new(Mutex::new(TunnelStatus {
            id: config.id.clone(),
            local_port: config.local_port,
            remote_host: config.remote_host.clone(),
            remote_port: config.remote_port,
            entry_id: config.entry_id,
            status: "starting".to_string(),
            error: None,
        }));

        let (cancel_tx, _) = tokio::sync::broadcast::channel::<()>(1);
        let handle = TunnelHandle { status: status.clone(), cancel_tx: cancel_tx.clone() };
        
        self.tunnels.write().await.insert(config.id.clone(), handle);

        let status_clone = status.clone();
        let cancel_rx = cancel_tx.subscribe();
        
        tokio::spawn(async move {
            if let Err(e) = run_tunnel(config, status_clone.clone(), cancel_rx).await {
                let mut s = status_clone.lock().await;
                s.status = "error".to_string();
                s.error = Some(e);
            }
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let result = status.lock().await.clone();
        Ok(result)
    }

    pub async fn stop_tunnel(&self, id: &str) -> Result<(), String> {
        match self.tunnels.write().await.remove(id) {
            Some(handle) => { let _ = handle.cancel_tx.send(()); Ok(()) }
            None => Err("Tunnel not found".to_string())
        }
    }

    pub async fn list_tunnels(&self) -> Vec<TunnelStatus> {
        let mut result = Vec::new();
        for handle in self.tunnels.read().await.values() {
            result.push(handle.status.lock().await.clone());
        }
        result
    }

    pub async fn get_tunnel_status(&self, id: &str) -> Option<TunnelStatus> {
        let tunnels = self.tunnels.read().await;
        match tunnels.get(id) {
            Some(handle) => Some(handle.status.lock().await.clone()),
            None => None
        }
    }
}

async fn run_tunnel(
    config: TunnelConfig,
    status: Arc<Mutex<TunnelStatus>>,
    mut cancel_rx: tokio::sync::broadcast::Receiver<()>,
) -> Result<(), String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", config.local_port))
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", config.local_port, e))?;

    status.lock().await.status = "listening".to_string();

    loop {
        tokio::select! {
            _ = cancel_rx.recv() => {
                status.lock().await.status = "stopped".to_string();
                break;
            }
            accept_result = listener.accept() => {
                match accept_result {
                    Ok((tcp_stream, _)) => {
                        let config = config.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(tcp_stream, &config).await {
                                eprintln!("Tunnel error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        let mut s = status.lock().await;
                        s.status = "error".to_string();
                        s.error = Some(format!("Accept error: {}", e));
                        return Err(format!("Accept error: {}", e));
                    }
                }
            }
        }
    }
    Ok(())
}

async fn handle_connection(tcp_stream: tokio::net::TcpStream, config: &TunnelConfig) -> Result<(), String> {
    let ws_url = build_ws_url(config)?;
    let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
        .await
        .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    let (mut ws_write, mut ws_read) = ws_stream.split();
    let (mut tcp_read, mut tcp_write) = tcp_stream.into_split();

    match ws_read.next().await {
        Some(Ok(Message::Text(text))) => {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                if json.get("type").and_then(|v| v.as_str()) != Some("ready") {
                    return Err(format!("Unexpected message: {}", text));
                }
            }
        }
        Some(Ok(Message::Close(frame))) => {
            return Err(format!("WebSocket closed: {}", frame.map(|f| f.reason.to_string()).unwrap_or_default()));
        }
        Some(Err(e)) => return Err(format!("WebSocket error: {}", e)),
        None => return Err("WebSocket closed unexpectedly".to_string()),
        _ => {}
    }

    let tcp_to_ws = async move {
        let mut buf = [0u8; 8192];
        loop {
            match tcp_read.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => if ws_write.send(Message::Binary(buf[..n].to_vec())).await.is_err() { break; }
            }
        }
        let _ = ws_write.close().await;
    };

    let ws_to_tcp = async move {
        while let Some(msg) = ws_read.next().await {
            match msg {
                Ok(Message::Binary(data)) => if tcp_write.write_all(&data).await.is_err() { break; },
                Ok(Message::Text(text)) => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if json.get("type").and_then(|v| v.as_str()) == Some("pong") { continue; }
                    }
                    if tcp_write.write_all(text.as_bytes()).await.is_err() { break; }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    };

    tokio::select! { _ = tcp_to_ws => {} _ = ws_to_tcp => {} }
    Ok(())
}

fn build_ws_url(config: &TunnelConfig) -> Result<String, String> {
    let base = &config.server_url;
    let ws_base = match () {
        _ if base.starts_with("https://") => base.replace("https://", "wss://"),
        _ if base.starts_with("http://") => base.replace("http://", "ws://"),
        _ if base.starts_with("ws://") || base.starts_with("wss://") => base.clone(),
        _ => return Err("Invalid server URL".to_string()),
    };

    Ok(format!(
        "{}/api/ws/tunnel?sessionToken={}&entryId={}&identityId={}&remoteHost={}&remotePort={}",
        ws_base.trim_end_matches('/'),
        crate::urlencoding::encode(&config.token),
        config.entry_id,
        config.identity_id,
        crate::urlencoding::encode(&config.remote_host),
        config.remote_port
    ))
}
