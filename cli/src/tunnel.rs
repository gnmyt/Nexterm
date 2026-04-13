use anyhow::{Result, bail};
use console::style;
use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::api::{ApiClient, flatten_entries};
use crate::connect::pick_identity;
use crate::entries::resolve_entry;

pub async fn forward(target: &str, local_port: u16, remote_host: &str, remote_port: u16) -> Result<()> {
    let client = ApiClient::from_config()?;
    let entries = client.list_entries().await?;
    let flat: Vec<&_> = flatten_entries(&entries).into_iter().filter(|e| e.is_terminal()).collect();
    let entry = resolve_entry(&flat, target)?;
    let entry_id = entry.id_num().ok_or_else(|| anyhow::anyhow!("Invalid entry"))?;
    let identity_id = pick_identity(&client, entry.identities()).await?;

    let listener = TcpListener::bind(format!("127.0.0.1:{local_port}")).await
        .map_err(|e| anyhow::anyhow!("Failed to bind port {local_port}: {e}"))?;

    println!(
        "{} Forwarding {} -> {}:{} via {}",
        style("✓").green().bold(),
        style(format!("127.0.0.1:{local_port}")).cyan(),
        style(remote_host).cyan(),
        style(remote_port).cyan(),
        style(entry.name()).bold().green(),
    );
    println!("Press {} to stop.", style("Ctrl+C").bold());

    loop {
        let (tcp_stream, peer) = listener.accept().await?;
        let ws_url = client.tunnel_ws_url(entry_id, identity_id, remote_host, remote_port)?;
        tokio::spawn(async move {
            if let Err(e) = handle_connection(tcp_stream, &ws_url).await {
                eprintln!("{} Connection from {}: {}", style("✗").red(), peer, e);
            }
        });
    }
}

async fn handle_connection(tcp_stream: tokio::net::TcpStream, ws_url: &str) -> Result<()> {
    let (ws_stream, _) = connect_async(ws_url).await?;
    let (mut ws_tx, mut ws_rx) = ws_stream.split();
    let (mut tcp_rx, mut tcp_tx) = tcp_stream.into_split();

    match ws_rx.next().await {
        Some(Ok(Message::Text(text))) => {
            let json: serde_json::Value = serde_json::from_str(&text)?;
            if json.get("type").and_then(|v| v.as_str()) != Some("ready") {
                bail!("Unexpected: {text}");
            }
        }
        Some(Ok(Message::Close(f))) => bail!("Closed: {}", f.map(|f| f.reason.to_string()).unwrap_or_default()),
        Some(Err(e)) => bail!("WebSocket error: {e}"),
        None => bail!("WebSocket closed"),
        _ => {}
    }

    let tcp_to_ws = async move {
        let mut buf = [0u8; 8192];
        loop {
            match tcp_rx.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => if ws_tx.send(Message::Binary(buf[..n].to_vec())).await.is_err() { break; }
            }
        }
        let _ = ws_tx.close().await;
    };

    let ws_to_tcp = async move {
        while let Some(msg) = ws_rx.next().await {
            match msg {
                Ok(Message::Binary(data)) => if tcp_tx.write_all(&data).await.is_err() { break; },
                Ok(Message::Text(text)) => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if json.get("type").and_then(|v| v.as_str()) == Some("pong") { continue; }
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    };

    tokio::select! { _ = tcp_to_ws => {} _ = ws_to_tcp => {} }
    Ok(())
}
