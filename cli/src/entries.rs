use anyhow::{Result, bail};
use console::style;
use dialoguer::{FuzzySelect, Select};
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config as MatcherConfig, Matcher};
use crate::api::{ApiClient, Entry, flatten_entries};
use crate::connect;

pub async fn list(folder: Option<String>, tag: Option<String>, json: bool) -> Result<()> {
    let client = ApiClient::from_config()?;
    let entries = client.list_entries().await?;
    if json {
        println!("{}", serde_json::to_string_pretty(&entries)?);
        return Ok(());
    }
    let filtered = filter_entries(&entries, folder.as_deref(), tag.as_deref());
    print_tree(&filtered, 0);
    Ok(())
}

fn filter_entries<'a>(entries: &'a [Entry], folder: Option<&str>, tag: Option<&str>) -> Vec<&'a Entry> {
    if folder.is_none() && tag.is_none() { return entries.iter().collect(); }
    let mut result = Vec::new();
    for entry in entries {
        if let Some(children) = entry.children() {
            if let Some(f) = folder {
                if entry.name().to_lowercase().contains(&f.to_lowercase()) {
                    result.push(entry);
                    continue;
                }
            }
            if !filter_entries(children, folder, tag).is_empty() { result.push(entry); }
        } else if let Some(t) = tag {
            let t_lower = t.to_lowercase();
            if entry.tags().iter().any(|et| et.name.to_lowercase().contains(&t_lower)) {
                result.push(entry);
            }
        } else {
            result.push(entry);
        }
    }
    result
}

fn print_tree(entries: &[&Entry], depth: usize) {
    let indent = "  ".repeat(depth);
    for entry in entries {
        if !entry.is_terminal() && !entry.is_container() { continue; }
        if let Some(children) = entry.children() {
            let refs: Vec<&Entry> = children.iter().filter(|e| e.is_terminal() || e.is_container()).collect();
            if refs.is_empty() { continue; }
            println!("{}{} {}", indent, style("▸").dim(), style(entry.name()).bold().cyan());
            print_tree(&refs, depth + 1);
        } else {
            let id = entry.id_num().unwrap_or(0);
            let proto = entry.protocol();
            let ip = entry.ip();
            let tags = format_tags(entry.tags());
            let ps = match proto {
                "ssh" => style(proto).green(),
                "telnet" => style(proto).yellow(),
                _ => style(proto).yellow(),
            };
            println!("{}{} {} [{}] {}{}", indent, style(format!("#{id}")).dim(), style(entry.name()).bold(), ps, style(ip).dim(), tags);
        }
    }
}

fn format_tags(tags: &[crate::api::Tag]) -> String {
    if tags.is_empty() { return String::new(); }
    let names: Vec<String> = tags.iter().map(|t| format!("#{}", t.name)).collect();
    format!(" {}", style(names.join(" ")).dim())
}

fn fuzzy_score(query: &str, entries: &[&Entry]) -> Vec<(u16, usize)> {
    let mut matcher = Matcher::new(MatcherConfig::DEFAULT);
    let pattern = Atom::new(query, CaseMatching::Ignore, Normalization::Smart, AtomKind::Fuzzy, false);
    let mut scored: Vec<(u16, usize)> = entries.iter().enumerate().filter_map(|(i, e)| {
        let haystack = format!("{} {}", e.name(), e.ip());
        let mut buf = Vec::new();
        let score = pattern.score(nucleo_matcher::Utf32Str::new(&haystack, &mut buf), &mut matcher)?;
        Some((score, i))
    }).collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored
}

fn entry_label(e: &Entry) -> String {
    format!("{} [{}] {}", e.name(), e.protocol(), e.ip())
}

pub async fn search(query: &str, command: Option<&str>) -> Result<()> {
    let client = ApiClient::from_config()?;
    let entries = client.list_entries().await?;
    let connectable: Vec<&Entry> = flatten_entries(&entries).into_iter().filter(|e| e.is_terminal()).collect();
    if connectable.is_empty() { bail!("No connectable servers found"); }

    let scored = fuzzy_score(query, &connectable);
    if scored.is_empty() { bail!("No servers matched '{query}'"); }

    let items: Vec<String> = scored.iter().map(|(s, i)| format!("{} (score: {s})", entry_label(connectable[*i]))).collect();
    let sel = FuzzySelect::new().with_prompt("Select a server").items(&items).default(0).interact()?;
    let entry = connectable[scored[sel].1];

    let id = entry.id_num().ok_or_else(|| anyhow::anyhow!("Invalid entry"))?.to_string();
    match command {
        Some(cmd) => connect::exec(&id, cmd).await,
        None => connect::interactive(&id).await,
    }
}

pub async fn recent() -> Result<()> {
    let client = ApiClient::from_config()?;
    let entries = client.list_entries().await?;
    let connectable: Vec<&Entry> = flatten_entries(&entries).into_iter().filter(|e| e.is_terminal()).collect();
    if connectable.is_empty() { bail!("No connectable servers found"); }

    let items: Vec<String> = connectable.iter().map(|e| entry_label(e)).collect();
    let sel = Select::new().with_prompt("Select a server").items(&items).default(0).interact()?;
    let id = connectable[sel].id_num().ok_or_else(|| anyhow::anyhow!("Invalid entry"))?.to_string();
    connect::interactive(&id).await
}

pub fn resolve_entry<'a>(flat: &[&'a Entry], target: &str) -> Result<&'a Entry> {
    if let Ok(id) = target.parse::<u64>() {
        if let Some(entry) = flat.iter().find(|e| e.id_num() == Some(id)) { return Ok(entry); }
    }
    if let Some(entry) = flat.iter().find(|e| e.name().eq_ignore_ascii_case(target)) { return Ok(entry); }

    let scored = fuzzy_score(target, flat);
    if let Some((_, idx)) = scored.first() { Ok(flat[*idx]) } else { bail!("No entry found matching '{target}'") }
}
