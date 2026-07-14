use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)] pub server_url: Option<String>,
    #[serde(default)] pub session_token: Option<String>,
    #[serde(default)] pub accept_invalid_certs: bool,
}

impl Config {
    fn path() -> Result<PathBuf> {
        let dir = dirs::config_dir().context("No config directory")?.join("nexterm");
        fs::create_dir_all(&dir)?;
        Ok(dir.join("config.json"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::path()?;
        if !path.exists() { return Ok(Self::default()); }
        serde_json::from_str(&fs::read_to_string(&path)?).context("Failed to parse config")
    }

    pub fn save(&self) -> Result<()> {
        Ok(fs::write(Self::path()?, serde_json::to_string_pretty(self)?)?)
    }

    pub fn require_auth(&self) -> Result<(&str, &str)> {
        let url = self.server_url.as_deref().ok_or_else(|| anyhow::anyhow!("Not configured. Run `nt login` first"))?;
        let token = self.session_token.as_deref().ok_or_else(|| anyhow::anyhow!("Not logged in. Run `nt login` first"))?;
        Ok((url, token))
    }
}

pub fn set(key: &str, value: &str) -> Result<()> {
    let mut cfg = Config::load()?;
    match key {
        "server-url" => cfg.server_url = Some(value.to_string()),
        "accept-invalid-certs" => cfg.accept_invalid_certs = value.parse().context("Must be 'true' or 'false'")?,
        _ => bail!("Unknown key: {key}. Valid: server-url, accept-invalid-certs"),
    }
    cfg.save()?;
    println!("Set {key} = {value}");
    Ok(())
}

pub fn get(key: &str) -> Result<()> {
    let cfg = Config::load()?;
    println!("{}", match key {
        "server-url" => cfg.server_url.unwrap_or_default(),
        "accept-invalid-certs" => cfg.accept_invalid_certs.to_string(),
        "session-token" => cfg.session_token.map(|_| "(set)".into()).unwrap_or_default(),
        _ => bail!("Unknown key: {key}"),
    });
    Ok(())
}

pub fn show() -> Result<()> {
    let cfg = Config::load()?;
    println!("server-url:           {}", cfg.server_url.as_deref().unwrap_or("(not set)"));
    println!("accept-invalid-certs: {}", cfg.accept_invalid_certs);
    println!("session-token:        {}", if cfg.session_token.is_some() { "(set)" } else { "(not set)" });
    Ok(())
}
