use anyhow::{Result, bail};
use console::style;
use dialoguer::{Input, Select};
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;
use crate::api::ApiClient;
use crate::config::Config;

pub async fn login() -> Result<()> {
    let mut cfg = Config::load()?;

    let server_url: String = if let Some(ref url) = cfg.server_url {
        println!("Current server: {}", style(url).cyan());
        let choice = Select::new().with_prompt("Server URL")
            .items(&["Keep current server", "Enter a new server URL"]).default(0).interact()?;
        if choice == 0 { url.clone() } else { Input::new().with_prompt("Server URL").interact_text()? }
    } else {
        Input::new().with_prompt("Server URL (e.g. https://nexterm.example.com)").interact_text()?
    };

    let server_url = server_url.trim_end_matches('/').to_string();
    cfg.server_url = Some(server_url.clone());
    cfg.save()?;

    let client = ApiClient::from_url(&server_url, cfg.accept_invalid_certs)?;
    let method = Select::new().with_prompt("How would you like to authenticate?")
        .items(&["Login with a code (display a code to enter in the web UI)", "Login with browser (opens your default browser)"])
        .default(0).interact()?;

    let resp = client.device_create().await?;

    if method == 0 {
        println!("\n  Open your Nexterm web UI and go to {} > {}\n  Your one-time code: {}\n  This code expires in 10 minutes.\n",
            style("Servers").bold(), style("Connect Device").bold(), style(&resp.code).bold().green());
    } else {
        let link_url = format!("{}/link?code={}", server_url, resp.code);
        if open::that(&link_url).is_err() {
            println!("Could not open browser. Please visit: {}", style(&link_url).underlined().cyan());
        } else {
            println!("If the browser didn't open, visit: {}", style(&link_url).underlined().cyan());
        }
        println!();
    }

    let spinner = ProgressBar::new_spinner();
    spinner.set_style(ProgressStyle::default_spinner().template("{spinner:.green} {msg}").unwrap());
    spinner.set_message("Waiting for authorization...");
    spinner.enable_steady_tick(Duration::from_millis(100));

    let session_token = loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let poll = client.device_poll(&resp.token).await?;
        match poll.status.as_str() {
            "pending" => continue,
            "authorized" => break poll.token.ok_or_else(|| anyhow::anyhow!("Authorized but no token"))?,
            "invalid" => { spinner.finish_and_clear(); bail!("Device code expired or rejected"); }
            other => { spinner.finish_and_clear(); bail!("Unexpected status: {other}"); }
        }
    };
    spinner.finish_and_clear();

    cfg.session_token = Some(session_token);
    cfg.save()?;

    let verified = ApiClient::new(&server_url, cfg.session_token.as_deref(), cfg.accept_invalid_certs)?;
    match verified.whoami().await {
        Ok(account) => println!("{} Logged in as {}", style("✓").green().bold(), style(&account.username).cyan().bold()),
        Err(_) => println!("{} Authenticated successfully", style("✓").green().bold()),
    }
    Ok(())
}

pub fn logout() -> Result<()> {
    let mut cfg = Config::load()?;
    if cfg.session_token.is_none() { println!("Not logged in."); return Ok(()); }
    cfg.session_token = None;
    cfg.save()?;
    println!("{} Logged out successfully", style("✓").green().bold());
    Ok(())
}
