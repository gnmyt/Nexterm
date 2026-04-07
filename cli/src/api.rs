use anyhow::{Result, bail};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::config::Config;

pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

#[derive(Deserialize)]
pub struct DeviceCreateResponse { pub code: String, pub token: String }

#[derive(Deserialize)]
pub struct DevicePollResponse { pub status: String, pub token: Option<String> }

#[derive(Deserialize)]
pub struct AccountInfo { pub username: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tag { pub id: u64, pub name: String, pub color: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Entry {
    #[serde(rename = "server")]
    Server {
        id: u64, name: String,
        #[serde(default)] renderer: Option<String>,
        #[serde(default)] protocol: Option<String>,
        #[serde(default)] ip: Option<String>,
        #[serde(default)] identities: Option<Vec<u64>>,
        #[serde(default)] tags: Option<Vec<Tag>>,
    },
    #[serde(rename = "folder")]
    Folder { id: serde_json::Value, name: String, #[serde(default)] entries: Vec<Entry> },
    #[serde(rename = "organization")]
    Organization { id: String, name: String, #[serde(default)] entries: Vec<Entry> },
    #[serde(rename = "pve-lxc")]
    PveLxc { id: u64, name: String, #[serde(default)] tags: Option<Vec<Tag>> },
    #[serde(rename = "pve-qemu")]
    PveQemu { id: u64, name: String, #[serde(default)] tags: Option<Vec<Tag>> },
    #[serde(rename = "pve-shell")]
    PveShell { id: u64, name: String, #[serde(default)] tags: Option<Vec<Tag>> },
}

impl Entry {
    pub fn name(&self) -> &str {
        match self {
            Self::Server { name, .. } | Self::Folder { name, .. } | Self::Organization { name, .. }
            | Self::PveLxc { name, .. } | Self::PveQemu { name, .. } | Self::PveShell { name, .. } => name,
        }
    }

    pub fn id_num(&self) -> Option<u64> {
        match self {
            Self::Server { id, .. } | Self::PveLxc { id, .. }
            | Self::PveQemu { id, .. } | Self::PveShell { id, .. } => Some(*id),
            _ => None,
        }
    }

    pub fn is_terminal(&self) -> bool {
        match self {
            Self::Server { renderer, .. } => renderer.as_deref() != Some("rdp") && renderer.as_deref() != Some("vnc"),
            Self::PveLxc { .. } | Self::PveShell { .. } => true,
            _ => false,
        }
    }

    pub fn is_container(&self) -> bool {
        matches!(self, Self::Folder { .. } | Self::Organization { .. })
    }

    pub fn children(&self) -> Option<&[Entry]> {
        match self {
            Self::Folder { entries, .. } | Self::Organization { entries, .. } => Some(entries),
            _ => None,
        }
    }

    pub fn protocol(&self) -> &str {
        match self {
            Self::Server { protocol, .. } => protocol.as_deref().unwrap_or("ssh"),
            Self::PveLxc { .. } => "pve-lxc",
            Self::PveQemu { .. } => "pve-qemu",
            Self::PveShell { .. } => "pve-shell",
            _ => "unknown",
        }
    }

    pub fn ip(&self) -> &str {
        match self {
            Self::Server { ip, .. } => ip.as_deref().unwrap_or(""),
            _ => "",
        }
    }

    pub fn tags(&self) -> &[Tag] {
        match self {
            Self::Server { tags, .. } | Self::PveLxc { tags, .. }
            | Self::PveQemu { tags, .. } | Self::PveShell { tags, .. } => tags.as_deref().unwrap_or(&[]),
            _ => &[],
        }
    }

    pub fn identities(&self) -> &[u64] {
        match self {
            Self::Server { identities, .. } => identities.as_deref().unwrap_or(&[]),
            _ => &[],
        }
    }
}

pub fn flatten_entries(entries: &[Entry]) -> Vec<&Entry> {
    let mut out = Vec::new();
    for e in entries {
        match e {
            Entry::Folder { entries, .. } | Entry::Organization { entries, .. } => {
                out.extend(flatten_entries(entries));
            }
            _ => out.push(e),
        }
    }
    out
}

#[derive(Deserialize)]
pub struct CreateConnectionResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Deserialize, Debug)]
pub struct ExecResponse {
    pub success: bool,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Deserialize)]
pub struct Identity { pub id: u64, pub name: String, #[serde(rename = "type")] pub identity_type: Option<String> }

impl ApiClient {
    pub fn new(base_url: &str, token: Option<&str>, accept_invalid_certs: bool) -> Result<Self> {
        Ok(Self {
            client: Client::builder().danger_accept_invalid_certs(accept_invalid_certs).build()?,
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.map(|t| t.to_string()),
        })
    }

    pub fn from_config() -> Result<Self> {
        let cfg = Config::load()?;
        let (url, token) = cfg.require_auth()?;
        Self::new(url, Some(token), cfg.accept_invalid_certs)
    }

    pub fn from_url(url: &str, accept_invalid_certs: bool) -> Result<Self> {
        Self::new(url, None, accept_invalid_certs)
    }

    fn url(&self, path: &str) -> String { format!("{}/api{}", self.base_url, path) }
    fn auth(&self) -> Result<String> {
        self.token.as_deref().map(|t| format!("Bearer {t}")).ok_or_else(|| anyhow::anyhow!("Not authenticated"))
    }

    async fn post_json<B: Serialize, R: for<'de> Deserialize<'de>>(&self, path: &str, body: &B) -> Result<R> {
        let resp = self.client.post(self.url(path)).json(body).send().await?;
        if !resp.status().is_success() { bail!("Request failed: {}", resp.status()); }
        Ok(resp.json().await?)
    }

    async fn get_authed<R: for<'de> Deserialize<'de>>(&self, path: &str) -> Result<R> {
        let resp = self.client.get(self.url(path)).header("Authorization", self.auth()?).send().await?;
        if !resp.status().is_success() { bail!("Request failed: {}", resp.status()); }
        Ok(resp.json().await?)
    }

    pub async fn device_create(&self) -> Result<DeviceCreateResponse> {
        self.post_json("/auth/device/create", &serde_json::json!({"clientType": "connector"})).await
    }

    pub async fn device_poll(&self, token: &str) -> Result<DevicePollResponse> {
        self.post_json("/auth/device/poll", &serde_json::json!({"token": token})).await
    }

    pub async fn whoami(&self) -> Result<AccountInfo> { self.get_authed("/accounts/me").await }
    pub async fn list_entries(&self) -> Result<Vec<Entry>> { self.get_authed("/entries/list").await }
    pub async fn list_identities(&self) -> Result<Vec<Identity>> { self.get_authed("/identities/list").await }

    pub async fn create_connection(&self, entry_id: u64, identity_id: Option<u64>) -> Result<CreateConnectionResponse> {
        let resp = self.client.post(self.url("/connections"))
            .header("Authorization", self.auth()?)
            .json(&serde_json::json!({"entryId": entry_id, "identityId": identity_id}))
            .send().await?;
        if !resp.status().is_success() { bail!("Failed to create connection: {}", resp.status()); }
        Ok(resp.json().await?)
    }

    pub async fn exec_command(&self, entry_id: u64, identity_id: Option<u64>, command: &str) -> Result<ExecResponse> {
        let mut url = format!("/connections/{}/exec", entry_id);
        if let Some(iid) = identity_id { url = format!("{url}?identityId={iid}"); }
        let resp = self.client.post(self.url(&url))
            .header("Authorization", self.auth()?)
            .json(&serde_json::json!({"command": command}))
            .send().await?;
        if !resp.status().is_success() { bail!("Exec failed: {}", resp.status()); }
        Ok(resp.json().await?)
    }

    pub fn ws_url(&self, session_id: &str) -> Result<String> {
        let token = self.token.as_deref().ok_or_else(|| anyhow::anyhow!("Not authenticated"))?;
        let base = self.base_url.replacen("https://", "wss://", 1).replacen("http://", "ws://", 1);
        Ok(format!("{base}/api/ws/term?sessionToken={token}&sessionId={session_id}"))
    }
}
