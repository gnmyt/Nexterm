use anyhow::{Context, Result};
use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use crossterm::terminal;
use futures_util::{SinkExt, StreamExt};
use std::io::{self, Write};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

type WsWrite = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>;
type WsRead = futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>;

pub async fn run_session(ws_url: &str) -> Result<()> {
    let (ws, _) = connect_async(ws_url).await.context("WebSocket connect failed")?;
    let (mut tx, mut rx) = ws.split();
    let (cols, rows) = terminal::size().unwrap_or((80, 24));
    tx.send(Message::Text(format!("\x01{cols},{rows}"))).await?;
    terminal::enable_raw_mode()?;
    let result = session_loop(&mut tx, &mut rx).await;
    terminal::disable_raw_mode()?;
    println!();
    result
}

async fn session_loop(tx: &mut WsWrite, rx: &mut WsRead) -> Result<()> {
    let mut stdout = io::stdout();
    let (mut totp_mode, mut totp_buf) = (false, String::new());
    let (mut last_cols, mut last_rows) = terminal::size().unwrap_or((80, 24));
    let mut size_check = tokio::time::interval(std::time::Duration::from_millis(300));

    loop {
        tokio::select! {
            _ = size_check.tick() => {
                if let Ok((c, r)) = terminal::size() {
                    if c != last_cols || r != last_rows {
                        last_cols = c; last_rows = r;
                        tx.send(Message::Text(format!("\x01{c},{r}"))).await?;
                    }
                }
            }
            msg = rx.next() => match msg {
                Some(Ok(Message::Text(text))) if text.starts_with('\x02') => {
                    totp_mode = true;
                    totp_buf.clear();
                    write!(stdout, "\r\n{}", &text[1..])?;
                    stdout.flush()?;
                }
                Some(Ok(Message::Text(text))) => { write!(stdout, "{text}")?; stdout.flush()?; }
                Some(Ok(Message::Binary(data))) => { stdout.write_all(&data)?; stdout.flush()?; }
                Some(Ok(Message::Close(_))) | None => break,
                Some(Err(e)) => return Err(e.into()),
                _ => {}
            },
            _ = tokio::task::spawn_blocking(|| event::poll(std::time::Duration::from_millis(50))) => {
                while event::poll(std::time::Duration::ZERO)? {
                    match event::read()? {
                        Event::Key(ke) if totp_mode => match ke.code {
                            KeyCode::Enter => {
                                tx.send(Message::Text(format!("\x03{}", totp_buf))).await?;
                                totp_mode = false; totp_buf.clear();
                                write!(stdout, "\r\n")?; stdout.flush()?;
                            }
                            KeyCode::Char(c) => { totp_buf.push(c); write!(stdout, "*")?; stdout.flush()?; }
                            KeyCode::Backspace if totp_buf.pop().is_some() => {
                                write!(stdout, "\x08 \x08")?; stdout.flush()?;
                            }
                            _ => {}
                        },
                        Event::Key(ke) => {
                            let data = key_to_seq(&ke);
                            if !data.is_empty() { tx.send(Message::Text(data)).await?; }
                        }
                        Event::Resize(c, r) => { tx.send(Message::Text(format!("\x01{c},{r}"))).await?; }
                        _ => {}
                    }
                }
            }
        }
    }
    Ok(())
}

fn key_to_seq(e: &crossterm::event::KeyEvent) -> String {
    let ctrl = e.modifiers.contains(KeyModifiers::CONTROL);
    match e.code {
        KeyCode::Char(c) if ctrl => String::from(((c as u8).wrapping_sub(b'a').wrapping_add(1)) as char),
        KeyCode::Char(c) => String::from(c),
        KeyCode::Enter => "\r".into(),
        KeyCode::Backspace => "\x7f".into(),
        KeyCode::Tab => "\t".into(),
        KeyCode::Esc => "\x1b".into(),
        KeyCode::Up => "\x1b[A".into(),
        KeyCode::Down => "\x1b[B".into(),
        KeyCode::Right => "\x1b[C".into(),
        KeyCode::Left => "\x1b[D".into(),
        KeyCode::Home => "\x1b[H".into(),
        KeyCode::End => "\x1b[F".into(),
        KeyCode::PageUp => "\x1b[5~".into(),
        KeyCode::PageDown => "\x1b[6~".into(),
        KeyCode::Delete => "\x1b[3~".into(),
        KeyCode::Insert => "\x1b[2~".into(),
        KeyCode::F(n @ 1..=4) => format!("\x1b{}", ['O', 'P', 'Q', 'R', 'S'][n as usize]),
        KeyCode::F(n @ 5..=12) => {
            const CODES: [&str; 8] = ["15", "17", "18", "19", "20", "21", "23", "24"];
            format!("\x1b[{}~", CODES[(n - 5) as usize])
        }
        _ => String::new(),
    }
}
