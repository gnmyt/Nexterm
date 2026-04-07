use anyhow::Result;
use console::style;
use dialoguer::Select;
use crate::api::{ApiClient, flatten_entries};
use crate::entries::resolve_entry;
use crate::terminal;

fn get_terminals_and_resolve<'a>(flat: &[&'a crate::api::Entry], target: &str) -> Result<&'a crate::api::Entry> {
    resolve_entry(flat, target)
}

async fn setup(target: &str) -> Result<(ApiClient, u64, Option<u64>, String)> {
    let client = ApiClient::from_config()?;
    let entries = client.list_entries().await?;
    let flat: Vec<&_> = flatten_entries(&entries).into_iter().filter(|e| e.is_terminal()).collect();
    let entry = get_terminals_and_resolve(&flat, target)?;
    let entry_id = entry.id_num().ok_or_else(|| anyhow::anyhow!("Invalid entry"))?;
    let identity_id = pick_identity(&client, entry.identities()).await?;
    Ok((client, entry_id, identity_id, entry.name().to_string()))
}

pub async fn interactive(target: &str) -> Result<()> {
    let (client, entry_id, identity_id, name) = setup(target).await?;
    println!("Connecting to {} ...", style(&name).bold().green());
    let conn = client.create_connection(entry_id, identity_id).await?;
    terminal::run_session(&client.ws_url(&conn.session_id)?).await?;
    println!("Connection closed.");
    Ok(())
}

pub async fn exec(target: &str, command: &str) -> Result<()> {
    let (client, entry_id, identity_id, _) = setup(target).await?;
    let resp = client.exec_command(entry_id, identity_id, command).await?;
    if let Some(stdout) = &resp.stdout { if !stdout.is_empty() { print!("{stdout}"); } }
    if let Some(stderr) = &resp.stderr { if !stderr.is_empty() { eprint!("{stderr}"); } }
    let exit_code = resp.exit_code.unwrap_or(if resp.success { 0 } else { 1 });
    if exit_code != 0 {
        if let Some(err) = &resp.error_message { eprintln!("{}: {}", style("Error").red().bold(), err); }
        std::process::exit(exit_code);
    }
    Ok(())
}

async fn pick_identity(client: &ApiClient, identity_ids: &[u64]) -> Result<Option<u64>> {
    if identity_ids.len() <= 1 { return Ok(identity_ids.first().copied()); }
    let all = client.list_identities().await?;
    let matching: Vec<_> = all.iter().filter(|i| identity_ids.contains(&i.id)).collect();
    if matching.len() <= 1 { return Ok(matching.first().map(|i| i.id).or(Some(identity_ids[0]))); }
    let items: Vec<String> = matching.iter().map(|i| {
        format!("{} ({})", i.name, i.identity_type.as_deref().unwrap_or("unknown"))
    }).collect();
    let sel = Select::new().with_prompt("Select an identity").items(&items).default(0).interact()?;
    Ok(Some(matching[sel].id))
}
