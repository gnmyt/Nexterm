use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_LENGTH};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::{Duration, Instant};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;
use tokio::sync::{mpsc, Mutex};
use tokio::task::{AbortHandle, JoinHandle};

const PROGRESS_EVENT: &str = "transfer-progress";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(150);
const UPLOAD_QUEUE_CHUNKS: usize = 4;
const ERROR_BODY_LIMIT: usize = 64 * 1024;
const CANCELLED: &str = "Transfer cancelled";
const TRANSFER_ID_HEADER: &str = "x-transfer-id";

#[derive(Clone, Serialize)]
struct ProgressEvent {
    id: String,
    transferred: u64,
    total: u64,
}

#[derive(Serialize)]
pub struct UploadResponse {
    status: u16,
    body: String,
}

struct UploadHandle {
    sender: mpsc::Sender<Vec<u8>>,
    task: JoinHandle<Result<UploadResponse, String>>,
}

#[derive(Default)]
pub struct TransferState {
    downloads: Mutex<HashMap<String, AbortHandle>>,
    uploads: Mutex<HashMap<String, UploadHandle>>,
}

struct PartialFileGuard {
    path: PathBuf,
    keep: bool,
}

impl PartialFileGuard {
    fn keep(&mut self) {
        self.keep = true;
    }
}

impl Drop for PartialFileGuard {
    fn drop(&mut self) {
        if !self.keep {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

struct ProgressReporter {
    app: AppHandle,
    id: String,
    total: u64,
    last_emit: Option<Instant>,
}

impl ProgressReporter {
    fn new(app: AppHandle, id: String, total: u64) -> Self {
        Self { app, id, total, last_emit: None }
    }

    fn report(&mut self, transferred: u64, force: bool) {
        let due = match self.last_emit {
            Some(last) => last.elapsed() >= PROGRESS_INTERVAL,
            None => true,
        };
        if !force && !due {
            return;
        }
        self.last_emit = Some(Instant::now());
        let _ = self.app.emit(PROGRESS_EVENT, ProgressEvent {
            id: self.id.clone(),
            transferred,
            total: self.total,
        });
    }
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(crate::user_agent_string())
        .build()
        .map_err(|e| e.to_string())
}

fn build_headers(headers: &HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut map = HeaderMap::new();
    for (name, value) in headers {
        let name = HeaderName::from_str(name).map_err(|e| format!("invalid header {}: {}", name, e))?;
        let value = HeaderValue::from_str(value).map_err(|e| format!("invalid header value: {}", e))?;
        map.insert(name, value);
    }
    Ok(map)
}

async fn error_from_response(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.bytes().await.unwrap_or_default();
    let text = String::from_utf8_lossy(&body[..body.len().min(ERROR_BODY_LIMIT)]);
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|json| json.get("error").and_then(|e| e.as_str()).map(String::from))
        .unwrap_or_else(|| format!("Request failed ({})", status.as_u16()))
}

async fn run_download(
    app: AppHandle,
    id: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    destination: PathBuf,
) -> Result<u64, String> {
    let client = build_client()?;
    let method = reqwest::Method::from_str(&method).map_err(|e| e.to_string())?;
    let mut request = client.request(method, &url).headers(build_headers(&headers)?);
    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(error_from_response(response).await);
    }

    let total = response.content_length().unwrap_or(0);
    let mut reporter = ProgressReporter::new(app, id, total);
    reporter.report(0, true);

    let mut guard = PartialFileGuard { path: destination.clone(), keep: false };
    let mut file = tokio::fs::File::create(&destination).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut transferred: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        transferred += chunk.len() as u64;
        reporter.report(transferred, false);
    }

    file.flush().await.map_err(|e| e.to_string())?;
    if total > 0 && transferred != total {
        return Err(format!("Download incomplete ({} of {} bytes)", transferred, total));
    }

    guard.keep();
    reporter.report(transferred, true);
    Ok(transferred)
}

#[tauri::command]
pub async fn transfer_download(
    app: AppHandle,
    state: State<'_, TransferState>,
    id: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    destination: String,
) -> Result<u64, String> {
    let task = tokio::spawn(run_download(
        app, id.clone(), url, method, headers, body, PathBuf::from(destination),
    ));
    state.downloads.lock().await.insert(id.clone(), task.abort_handle());

    let result = match task.await {
        Ok(result) => result,
        Err(err) if err.is_cancelled() => Err(CANCELLED.to_string()),
        Err(err) => Err(err.to_string()),
    };
    state.downloads.lock().await.remove(&id);
    result
}

#[tauri::command]
pub async fn transfer_upload_begin(
    app: AppHandle,
    state: State<'_, TransferState>,
    id: String,
    url: String,
    headers: HashMap<String, String>,
    total: u64,
) -> Result<(), String> {
    let client = build_client()?;
    let header_map = build_headers(&headers)?;
    let (sender, receiver) = mpsc::channel::<Vec<u8>>(UPLOAD_QUEUE_CHUNKS);

    let mut reporter = ProgressReporter::new(app, id.clone(), total);
    reporter.report(0, true);

    let body_stream = futures_util::stream::unfold(
        (receiver, reporter, 0u64),
        |(mut receiver, mut reporter, mut transferred)| async move {
            let chunk = receiver.recv().await?;
            transferred += chunk.len() as u64;
            reporter.report(transferred, false);
            Some((Ok::<_, std::io::Error>(bytes::Bytes::from(chunk)), (receiver, reporter, transferred)))
        },
    );

    let task = tokio::spawn(async move {
        let response = client
            .post(&url)
            .headers(header_map)
            .header(CONTENT_LENGTH, total)
            .body(reqwest::Body::wrap_stream(body_stream))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = response.status().as_u16();
        let body = response.text().await.map_err(|e| e.to_string())?;
        Ok(UploadResponse { status, body })
    });

    state.uploads.lock().await.insert(id, UploadHandle { sender, task });
    Ok(())
}

#[tauri::command]
pub async fn transfer_upload_chunk(
    state: State<'_, TransferState>,
    request: Request<'_>,
) -> Result<(), String> {
    let id = request
        .headers()
        .get(TRANSFER_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| format!("missing {} header", TRANSFER_ID_HEADER))?
        .to_string();

    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        InvokeBody::Json(_) => return Err("upload chunks must be sent as raw bytes".to_string()),
    };

    let sender = {
        let uploads = state.uploads.lock().await;
        uploads.get(&id).map(|handle| handle.sender.clone())
    }
    .ok_or_else(|| "unknown upload".to_string())?;

    sender.send(bytes).await.map_err(|_| "Upload aborted".to_string())
}

#[tauri::command]
pub async fn transfer_upload_finish(
    state: State<'_, TransferState>,
    id: String,
) -> Result<UploadResponse, String> {
    let handle = state
        .uploads
        .lock()
        .await
        .remove(&id)
        .ok_or_else(|| "unknown upload".to_string())?;
    drop(handle.sender);

    match handle.task.await {
        Ok(result) => result,
        Err(err) if err.is_cancelled() => Err(CANCELLED.to_string()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub async fn transfer_cancel(state: State<'_, TransferState>, id: String) -> Result<bool, String> {
    if let Some(handle) = state.downloads.lock().await.remove(&id) {
        handle.abort();
        return Ok(true);
    }
    if let Some(handle) = state.uploads.lock().await.remove(&id) {
        handle.task.abort();
        return Ok(true);
    }
    Ok(false)
}
