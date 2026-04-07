mod api;
mod auth;
mod config;
mod connect;
mod entries;
mod terminal;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "nt", about = "Nexterm CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Authenticate with a Nexterm server
    Login,
    /// Clear stored session token
    Logout,
    /// List all servers in a tree
    Ls {
        #[arg(long)] folder: Option<String>,
        #[arg(long)] tag: Option<String>,
        #[arg(long)] json: bool,
    },
    /// Connect to a server
    Connect {
        target: String,
        #[arg(last = true)] command: Vec<String>,
    },
    /// Fuzzy search servers and connect
    Search {
        query: String,
        #[arg(last = true)] command: Vec<String>,
    },
    /// Show servers and select one to connect
    Recent,
    /// Manage CLI configuration
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    Set { key: String, value: String },
    Get { key: String },
    Show,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Login => auth::login().await,
        Commands::Logout => auth::logout(),
        Commands::Ls { folder, tag, json } => entries::list(folder, tag, json).await,
        Commands::Connect { target, command } => {
            if command.is_empty() { connect::interactive(&target).await }
            else { connect::exec(&target, &command.join(" ")).await }
        }
        Commands::Search { query, command } => {
            let cmd = if command.is_empty() { None } else { Some(command.join(" ")) };
            entries::search(&query, cmd.as_deref()).await
        }
        Commands::Recent => entries::recent().await,
        Commands::Config { action } => match action {
            ConfigAction::Set { key, value } => config::set(&key, &value),
            ConfigAction::Get { key } => config::get(&key),
            ConfigAction::Show => config::show(),
        },
    }
}
