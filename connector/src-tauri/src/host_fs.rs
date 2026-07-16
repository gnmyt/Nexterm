use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

const E_NOENT: i32 = 1;
const E_ACCES: i32 = 2;
const E_EXIST: i32 = 3;
const E_ISDIR: i32 = 4;
const E_NOTDIR: i32 = 5;
const E_INVAL: i32 = 7;
const E_IO: i32 = 9;

const ATTR_READONLY:  i32 = 0x0001;
const ATTR_DIRECTORY: i32 = 0x0010;
const ATTR_NORMAL:    i32 = 0x0080;

#[derive(Serialize)]
pub struct HostFsError {
    code: i32,
    message: String,
}

impl HostFsError {
    fn new(code: i32, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }

    fn from_io(err: std::io::Error) -> Self {
        use std::io::ErrorKind::*;
        let code = match err.kind() {
            NotFound => E_NOENT,
            PermissionDenied => E_ACCES,
            AlreadyExists => E_EXIST,
            InvalidInput | InvalidData => E_INVAL,
            _ => E_IO,
        };
        Self::new(code, err.to_string())
    }
}

type FsResult<T> = Result<T, HostFsError>;

enum OpenEntry {
    File { file: File, path: PathBuf },
    Dir { entries: Vec<EntryMeta>, path: Option<PathBuf> },
}

impl OpenEntry {
    fn path(&self) -> Option<&std::path::Path> {
        match self {
            OpenEntry::File { path, .. } => Some(path),
            OpenEntry::Dir { path, .. } => path.as_deref(),
        }
    }
}

#[derive(Serialize, Clone)]
pub struct EntryMeta {
    pub name: String,
    pub size: u64,
    pub attributes: i32,
    pub ctime: u64,
    pub mtime: u64,
    pub atime: u64,
}

#[derive(Default)]
pub struct HostFsState {
    inner: Mutex<HostFsInner>,
}

#[derive(Default)]
struct HostFsInner {
    handles: HashMap<u64, OpenEntry>,
    next_handle: u64,
}

#[cfg(windows)]
fn list_drive_letters() -> Vec<char> {
    let mut drives = Vec::new();
    for c in b'A'..=b'Z' {
        let letter = c as char;
        let p = format!("{}:\\", letter);
        if std::path::Path::new(&p).exists() {
            drives.push(letter);
        }
    }
    drives
}

fn resolve_path(virtual_path: &str) -> Result<Option<PathBuf>, HostFsError> {

    let trimmed = virtual_path.trim_start_matches(|c| c == '/' || c == '\\');
    #[cfg(windows)]
    if trimmed.contains(':') {
        return Err(HostFsError::new(E_INVAL,
                "named streams and drive specs are not supported"));
    }

    let parts: Vec<&str> = trimmed
        .split(|c: char| c == '/' || c == '\\')
        .filter(|s| !s.is_empty() && *s != ".")
        .collect();
    for p in &parts {
        if *p == ".." {
            return Err(HostFsError::new(E_ACCES,
                    "parent directory traversal is not allowed"));
        }
    }

    #[cfg(unix)] {
        let mut out = PathBuf::from("/");
        for raw in &parts {
            out.push(raw);
        }
        Ok(Some(out))
    }

    #[cfg(windows)] {
        if parts.is_empty() {
            return Ok(None);
        }
        let drive = parts[0];
        let drive_char = drive.chars().next();
        if drive.len() != 1
                || !drive_char.map(|c| c.is_ascii_alphabetic()).unwrap_or(false) {
            return Err(HostFsError::new(E_NOENT, "no such drive"));
        }
        let mut out = PathBuf::from(format!("{}:\\", drive.to_uppercase()));
        for raw in &parts[1..] {
            out.push(raw);
        }
        Ok(Some(out))
    }
}

fn system_time_to_millis(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
}

fn metadata_to_entry(name: String, md: std::fs::Metadata) -> EntryMeta {
    let mut attributes = 0;
    if md.is_dir() {
        attributes |= ATTR_DIRECTORY;
    } else {
        attributes |= ATTR_NORMAL;
    }
    if md.permissions().readonly() { attributes |= ATTR_READONLY; }
    EntryMeta {
        name,
        size: md.len(),
        attributes,
        ctime: md.created().map(system_time_to_millis).unwrap_or(0),
        mtime: md.modified().map(system_time_to_millis).unwrap_or(0),
        atime: md.accessed().map(system_time_to_millis).unwrap_or(0),
    }
}

#[cfg(windows)]
fn synthetic_root_entries() -> Vec<EntryMeta> {
    let now = system_time_to_millis(SystemTime::now());
    list_drive_letters().into_iter().map(|letter| EntryMeta {
        name: letter.to_string(),
        size: 0,
        attributes: ATTR_DIRECTORY,
        ctime: now, mtime: now, atime: now,
    }).collect()
}

#[cfg(not(windows))]
fn synthetic_root_entries() -> Vec<EntryMeta> { Vec::new() }

fn synthetic_root_meta() -> EntryMeta {
    let now = system_time_to_millis(SystemTime::now());
    EntryMeta {
        name: String::new(),
        size: 0,
        attributes: ATTR_DIRECTORY,
        ctime: now, mtime: now, atime: now,
    }
}

#[derive(Serialize)]
pub struct OpenResult {
    handle: u64,
    size: u64,
    attributes: i32,
    ctime: u64,
    mtime: u64,
    atime: u64,
}

#[tauri::command]
pub fn host_fs_open(
    state: tauri::State<'_, HostFsState>,
    path: String,
    flags: i32,
    disposition: String,
    is_directory: bool,
) -> FsResult<OpenResult> {

    let resolved = resolve_path(&path)?;

    let read  = (flags & 0x01) != 0;
    let write = (flags & 0x02) != 0;
    let append = (flags & 0x04) != 0;

    let (create, truncate, must_exist, must_not_exist) = match disposition.as_str() {
        "create"              => (true,  false, false, true),
        "open"                => (false, false, true,  false),
        "open-or-create"      => (true,  false, false, false),
        "overwrite"           => (false, true,  true,  false),
        "overwrite-or-create" => (true,  true,  false, false),
        "supersede"           => (true,  true,  false, false),
        _ => return Err(HostFsError::new(E_INVAL,
                format!("unknown disposition: {}", disposition))),
    };

    let real = match resolved {
        None => {
            if write || append || create || truncate {
                return Err(HostFsError::new(E_ACCES,
                        "synthetic root is read-only"));
            }
            let entries = synthetic_root_entries();
            let meta = synthetic_root_meta();
            let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
            g.next_handle += 1;
            let h = g.next_handle;
            g.handles.insert(h, OpenEntry::Dir { entries, path: None });
            return Ok(OpenResult {
                handle: h, size: meta.size, attributes: meta.attributes,
                ctime: meta.ctime, mtime: meta.mtime, atime: meta.atime,
            });
        }
        Some(p) => p,
    };

    let existed = real.exists();
    let was_dir = existed && real.is_dir();

    if existed && !was_dir {
        match std::fs::metadata(&real) {
            Ok(md) if !md.is_file() => {
                return Err(HostFsError::new(E_ACCES,
                        format!("unsupported file type at {:?}", real)));
            }
            _ => {}
        }
    }

    if must_exist && !existed {
        return Err(HostFsError::new(E_NOENT, "no such file"));
    }
    if must_not_exist && existed {
        return Err(HostFsError::new(E_EXIST, "file exists"));
    }

    if was_dir || (is_directory && (create || !existed)) {
        if !existed && create {
            std::fs::create_dir_all(&real).map_err(HostFsError::from_io)?;
        }
        if !real.is_dir() {
            return Err(HostFsError::new(E_NOTDIR, "expected directory"));
        }

        const MAX_DIR_ENTRIES: usize = 5000;

        let mut entries = Vec::new();
        for ent in std::fs::read_dir(&real).map_err(HostFsError::from_io)?.flatten() {
            if entries.len() >= MAX_DIR_ENTRIES { break; }

            let ft = match ent.file_type() { Ok(t) => t, Err(_) => continue };
            let mut attributes = 0;
            if ft.is_dir() {
                attributes |= ATTR_DIRECTORY;
            } else if ft.is_file() {
                attributes |= ATTR_NORMAL;
            } else if ft.is_symlink() {
                match ent.metadata() {
                    Ok(md) if md.is_dir() => attributes |= ATTR_DIRECTORY,
                    Ok(_)  => attributes |= ATTR_NORMAL,
                    Err(_) => continue,
                }
            } else {
                continue;
            }

            let name = ent.file_name().to_string_lossy().into_owned();
            entries.push(EntryMeta {
                name, size: 0, attributes,
                ctime: 0, mtime: 0, atime: 0,
            });
        }

        let md = std::fs::metadata(&real).map_err(HostFsError::from_io)?;
        let meta = metadata_to_entry(String::new(), md);

        let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
        g.next_handle += 1;
        let h = g.next_handle;
        g.handles.insert(h, OpenEntry::Dir { entries, path: Some(real.clone()) });
        return Ok(OpenResult {
            handle: h, size: meta.size, attributes: meta.attributes,
            ctime: meta.ctime, mtime: meta.mtime, atime: meta.atime,
        });
    }

    let file = OpenOptions::new()
            .read(read || (!write && !append))
            .write(write || append)
            .append(append)
            .create(create)
            .truncate(truncate)
            .open(&real)
            .map_err(HostFsError::from_io)?;

    let md = file.metadata().map_err(HostFsError::from_io)?;
    let meta = metadata_to_entry(String::new(), md);

    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    g.next_handle += 1;
    let h = g.next_handle;
    g.handles.insert(h, OpenEntry::File { file, path: real.clone() });
    Ok(OpenResult {
        handle: h, size: meta.size, attributes: meta.attributes,
        ctime: meta.ctime, mtime: meta.mtime, atime: meta.atime,
    })
}

#[derive(Serialize)]
pub struct ReadResult { data: String /* base64 */ }

#[tauri::command]
pub fn host_fs_read(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    offset: u64,
    length: i32,
) -> FsResult<ReadResult> {

    if length <= 0 {
        return Ok(ReadResult { data: String::new() });
    }

    const MAX_READ: i32 = 16 * 1024 * 1024;
    let length = length.min(MAX_READ) as usize;

    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    let entry = g.handles.get_mut(&handle)
            .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
    let file = match entry {
        OpenEntry::File { file, .. } => file,
        OpenEntry::Dir { .. } => return Err(HostFsError::new(E_ISDIR,
                "read on directory handle")),
    };

    file.seek(SeekFrom::Start(offset)).map_err(HostFsError::from_io)?;
    let mut buf = vec![0u8; length];
    let n = file.read(&mut buf).map_err(HostFsError::from_io)?;
    buf.truncate(n);
    Ok(ReadResult { data: B64.encode(&buf) })
}

#[derive(Serialize)]
pub struct WriteResult { bytes_written: i32 }

#[tauri::command]
pub fn host_fs_write(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    offset: u64,
    data: String,
) -> FsResult<WriteResult> {

    let bytes = B64.decode(data.as_bytes()).map_err(|e|
            HostFsError::new(E_INVAL, format!("invalid base64: {}", e)))?;

    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    let entry = g.handles.get_mut(&handle)
            .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
    let file = match entry {
        OpenEntry::File { file, .. } => file,
        OpenEntry::Dir { .. } => return Err(HostFsError::new(E_ISDIR,
                "write on directory handle")),
    };

    file.seek(SeekFrom::Start(offset)).map_err(HostFsError::from_io)?;
    file.write_all(&bytes).map_err(HostFsError::from_io)?;
    Ok(WriteResult { bytes_written: bytes.len() as i32 })
}

#[tauri::command]
pub fn host_fs_close(state: tauri::State<'_, HostFsState>, handle: u64) {
    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    g.handles.remove(&handle);
}

#[tauri::command]
pub fn host_fs_readdir(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    offset: Option<usize>,
    limit: Option<usize>,
) -> FsResult<Vec<EntryMeta>> {

    let g = state.inner.lock().expect("HostFsState mutex poisoned");
    let entry = g.handles.get(&handle)
            .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
    let entries = match entry {
        OpenEntry::Dir { entries, .. } => entries,
        OpenEntry::File { .. } => return Err(HostFsError::new(E_NOTDIR,
                "readdir on file handle")),
    };
    let start = offset.unwrap_or(0).min(entries.len());
    let end = limit
        .map(|n| (start + n).min(entries.len()))
        .unwrap_or(entries.len());
    Ok(entries[start..end].to_vec())
}

#[tauri::command]
pub fn host_fs_unlink(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    is_directory: bool,
) -> FsResult<()> {

    let path = {
        let g = state.inner.lock().expect("HostFsState mutex poisoned");
        let entry = g.handles.get(&handle)
                .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
        entry.path()
            .ok_or_else(|| HostFsError::new(E_ACCES, "cannot unlink synthetic"))?
            .to_path_buf()
    };

    let result = if is_directory {
        std::fs::remove_dir(&path)
    } else {
        match std::fs::remove_file(&path) {
            Err(_) if path.is_dir() => std::fs::remove_dir(&path),
            other => other,
        }
    };

    result.map_err(HostFsError::from_io)?;
    Ok(())
}

#[tauri::command]
pub fn host_fs_rename(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    new_path: String,
) -> FsResult<()> {

    let old_path = {
        let g = state.inner.lock().expect("HostFsState mutex poisoned");
        let entry = g.handles.get(&handle)
                .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
        entry.path()
            .ok_or_else(|| HostFsError::new(E_ACCES, "cannot rename synthetic"))?
            .to_path_buf()
    };

    let resolved = resolve_path(&new_path)?;
    let target = resolved.ok_or_else(|| HostFsError::new(
            E_ACCES, "cannot rename to synthetic root"))?;

    std::fs::rename(&old_path, &target).map_err(HostFsError::from_io)?;

    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    if let Some(entry) = g.handles.get_mut(&handle) {
        match entry {
            OpenEntry::File { path, .. } => *path = target.clone(),
            OpenEntry::Dir { path, .. } => *path = Some(target.clone()),
        }
    }
    Ok(())
}

#[tauri::command]
pub fn host_fs_truncate(
    state: tauri::State<'_, HostFsState>,
    handle: u64,
    length: i64,
) -> FsResult<()> {

    let mut g = state.inner.lock().expect("HostFsState mutex poisoned");
    let entry = g.handles.get_mut(&handle)
            .ok_or_else(|| HostFsError::new(E_INVAL, "bad handle"))?;
    let file = match entry {
        OpenEntry::File { file, .. } => file,
        OpenEntry::Dir { .. } => return Err(HostFsError::new(E_ISDIR,
                "truncate on directory handle")),
    };
    file.set_len(length.max(0) as u64).map_err(HostFsError::from_io)?;
    Ok(())
}

#[tauri::command]
pub fn host_fs_stat(path: String) -> FsResult<EntryMeta> {

    let resolved = resolve_path(&path)?;
    let real = match resolved {
        None => return Ok(synthetic_root_meta()),
        Some(p) => p,
    };
    let md = std::fs::metadata(&real).map_err(HostFsError::from_io)?;
    Ok(metadata_to_entry(String::new(), md))
}
