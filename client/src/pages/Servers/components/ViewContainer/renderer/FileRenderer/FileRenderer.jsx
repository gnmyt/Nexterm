import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import TransferPanel from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/TransferPanel";
import StatusBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/StatusBar";
import ConflictDialog from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ConflictDialog";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";
import { getWebSocketUrl, getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import { useTransfers, TRANSFER_OPERATIONS } from "@/common/contexts/TransferContext.jsx";

const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11, PATH_SYNC: 0x12, CHECK_EXISTS: 0x15,
    ...TRANSFER_OPERATIONS,
};

const REFRESH_DEBOUNCE = 150;

const joinPath = (...parts) => parts.join("/").replace(/\/+/g, "/");

const baseName = (path) => path.split("/").filter(Boolean).pop() ?? "";

const withoutSelfTargets = (sources, destination) => sources.filter(source => joinPath(destination, baseName(source)) !== joinPath(source));

const renameCandidate = (name, attempt) => {
    const [, stem = name, extension = ""] = name.match(/^(.+?)((?:\.tar)?\.[^.]*)$/) ?? [];
    return `${stem} (${attempt})${extension}`;
};

const readAllEntries = (reader) => new Promise((resolve, reject) => {
    const all = [];
    const next = () => {
        reader.readEntries(batch => {
            if (batch.length) {
                all.push(...batch);
                next();
            } else {
                resolve(all);
            }
        }, reject);
    };
    next();
});

const takeDroppedEntries = (dataTransfer) => [...(dataTransfer.items ?? [])]
    .filter(item => item.kind === "file")
    .map(item => item.webkitGetAsEntry?.())
    .filter(Boolean);

const collectDroppedEntries = async (entries, targetDir) => {
    const files = [];
    const emptyDirs = [];

    const walk = async (entry, dir) => {
        if (entry.isFile) {
            files.push({ file: await new Promise((resolve, reject) => entry.file(resolve, reject)), targetDir: dir });
            return;
        }

        const path = joinPath(dir, entry.name);
        const children = await readAllEntries(entry.createReader());
        if (!children.length) {
            emptyDirs.push(path);
            return;
        }
        for (const child of children) await walk(child, path);
    };

    for (const entry of entries) await walk(entry, targetDir);
    return { files, emptyDirs };
};

export const FileRenderer = ({ session, disconnectFromServer, setOpenFileEditors, isActive, onOpenTerminal }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const { defaultViewMode, showHiddenFiles, toggleHiddenFiles } = usePreferences();
    const { sendToast } = useToast();
    const { startDownload, startMultiDownload, queueUploads, startCrossSessionTransfer, applyServerProgress, registerSession } = useTransfers();

    const [dragging, setDragging] = useState(false);
    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState(["/"]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState(defaultViewMode);
    const [directorySuggestions, setDirectorySuggestions] = useState([]);
    const [connectionError, setConnectionError] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [capabilities, setCapabilities] = useState({ shell: true, terminal: true });
    const [selectedCount, setSelectedCount] = useState(0);
    const [homePath, setHomePath] = useState(null);
    const [conflict, setConflict] = useState(null);

    const handleSelectionChange = useCallback((selectedItems) => setSelectedCount(selectedItems.length), []);

    const visibleItems = showHiddenFiles ? items : items.filter(item => !item.name.startsWith("."));
    const folderCount = visibleItems.filter(item => item.type === "folder").length;
    const fileCount = visibleItems.length - folderCount;
    const hiddenCount = items.length - visibleItems.length;

    const directoryRef = useRef(directory);
    const skipNextPathSync = useRef(false);
    const symlinkCallbacks = useRef([]);
    const existsCallbacks = useRef(new Map());
    const existsRequestId = useRef(0);
    const conflictQueue = useRef(Promise.resolve());
    const dropZoneRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const fileListRef = useRef(null);
    const propertiesHandlerRef = useRef(null);
    const treeHandlerRef = useRef(null);
    const refreshTimerRef = useRef(null);
    const sessionHandlersRef = useRef({ send: () => false, refresh: () => {} });

    const wsUrl = getWebSocketUrl("/api/ws/sftp", { sessionToken, sessionId: session.id });
    const transferTarget = () => ({ sessionId: session.id, sessionToken, baseUrl: getBaseUrl() });

    const downloadFile = (path) => startDownload({ ...transferTarget(), path });

    const downloadMultipleFiles = (paths) => startMultiDownload({ ...transferTarget(), paths });

    const askConflict = (kind, names) => {
        const answer = conflictQueue.current.then(() => new Promise(resolve => setConflict({ kind, names, resolve })));
        conflictQueue.current = answer;
        return answer;
    };

    const settleConflict = (choice) => {
        if (!conflict || conflict.settled) return;
        conflict.resolve(choice);
        setConflict({ ...conflict, settled: true });
    };

    const dismissConflict = () => {
        if (conflict && !conflict.settled) conflict.resolve("cancel");
        setConflict(null);
    };

    const queueSessionUploads = async (uploads) => {
        if (!uploads.length) return;
        const remotePath = (upload) => joinPath(upload.targetDir, upload.file.name);
        const found = await checkExisting(uploads.map(remotePath));
        if (!found) return;
        const existing = new Set(found);
        if (existing.size === 0) {
            queueUploads({ ...transferTarget(), uploads });
            return;
        }

        const conflicting = uploads.filter(upload => existing.has(remotePath(upload)));
        const choice = await askConflict("upload", conflicting.map(upload => upload.file.name));
        if (choice === "cancel") return;
        if (choice === "overwrite") {
            queueUploads({ ...transferTarget(), uploads });
            return;
        }
        const untouched = uploads.filter(upload => !existing.has(remotePath(upload)));
        if (choice === "skip") {
            if (untouched.length) queueUploads({ ...transferTarget(), uploads: untouched });
            return;
        }

        const taken = new Set([...existing, ...uploads.map(remotePath)]);
        const nextFreePath = (upload) => {
            let attempt = 1;
            let candidate = joinPath(upload.targetDir, renameCandidate(upload.file.name, attempt));
            while (taken.has(candidate)) candidate = joinPath(upload.targetDir, renameCandidate(upload.file.name, ++attempt));
            taken.add(candidate);
            return candidate;
        };
        const renamed = [];
        let pending = conflicting;
        while (pending.length) {
            const candidates = pending.map(upload => ({ upload, path: nextFreePath(upload) }));
            const found = await checkExisting(candidates.map(candidate => candidate.path));
            if (!found) return;
            const stillExisting = new Set(found);
            pending = [];
            for (const { upload, path } of candidates) {
                if (stillExisting.has(path)) pending.push(upload);
                else renamed.push({ ...upload, file: new File([upload.file], baseName(path), { type: upload.file.type, lastModified: upload.file.lastModified }) });
            }
        }
        queueUploads({ ...transferTarget(), uploads: [...untouched, ...renamed] });
    };

    const resolveDestinationConflicts = async (kind, sources, destination) => {
        const destinationOf = (source) => joinPath(destination, baseName(source));
        if (!sources.length) return null;
        const found = await checkExisting(sources.map(destinationOf));
        if (!found) return null;
        const existing = new Set(found);
        if (existing.size === 0) return { sources, overwrite: false };
        const choice = await askConflict(kind, [...existing].map(baseName));
        if (choice === "cancel") return null;
        if (choice === "overwrite") return { sources, overwrite: true };
        const remaining = sources.filter(source => !existing.has(destinationOf(source)));
        return remaining.length ? { sources: remaining, overwrite: false } : null;
    };

    const transferFromSession = async (paths, sourceSessionId, destination, action) => {
        const resolved = await resolveDestinationConflicts(action, paths, destination);
        if (!resolved) return;
        startCrossSessionTransfer({
            sourceSessionId, targetSessionId: session.id, sessionToken, baseUrl: getBaseUrl(),
            paths: resolved.sources, destination, action,
        });
    };

    const uploadFile = async () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.onchange = () => {
            queueSessionUploads([...fileInput.files].map(file => ({ file, targetDir: directory })));
        };
        fileInput.click();
    };

    const uploadFolder = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.onchange = () => {
            queueSessionUploads([...input.files].map(file => ({
                file,
                targetDir: joinPath(directory, file.webkitRelativePath.split("/").slice(0, -1).join("/")),
            })));
        };
        input.click();
    };

    const processMessage = async (event) => {
        try {
            const data = await event.data.text();
            const operation = data.charCodeAt(0);
            let payload;
            try { payload = JSON.parse(data.slice(1)); } catch {}

            switch (operation) {
                case OPERATIONS.READY:
                    setIsReady(true);
                    setConnectionError(null);
                    setCapabilities(payload?.capabilities ?? { shell: true, terminal: true });
                    setHomePath(payload?.home ?? null);
                    reconnectAttemptsRef.current = 0;
                    for (const transfer of payload?.transfers ?? []) applyServerProgress(session.id, transfer);
                    if (payload?.path && payload.path !== directoryRef.current) {
                        skipNextPathSync.current = true;
                        setDirectory(payload.path);
                        setHistory([payload.path]);
                        setHistoryIndex(0);
                    } else {
                        listFiles();
                    }
                    break;
                case OPERATIONS.LIST_FILES:
                    if (payload?.path && payload.path !== directoryRef.current) {
                        treeHandlerRef.current?.(payload);
                        break;
                    }
                    if (payload?.files) { setItems(payload.files); setError(null); } 
                    else { setError("Failed to load directory contents"); setItems([]); }
                    setLoading(false);
                    break;
                case OPERATIONS.CREATE_FILE:
                case OPERATIONS.CREATE_FOLDER:
                case OPERATIONS.DELETE_FILE:
                case OPERATIONS.DELETE_FOLDER:
                case OPERATIONS.RENAME_FILE:
                case OPERATIONS.MOVE_FILES:
                case OPERATIONS.COPY_FILES:
                case OPERATIONS.CHMOD:
                    scheduleRefresh();
                    break;
                case OPERATIONS.ERROR:
                    sendToast(t("common.error"), payload?.message || t("servers.fileManager.toast.error"));
                    setLoading(false);
                    break;
                case OPERATIONS.SEARCH_DIRECTORIES:
                    if (payload?.directories) setDirectorySuggestions(payload.directories);
                    break;
                case OPERATIONS.RESOLVE_SYMLINK:
                    if (payload) { const cb = symlinkCallbacks.current.shift(); if (cb) cb(payload); }
                    break;
                case OPERATIONS.CHECK_EXISTS:
                    existsCallbacks.current.get(payload?.id)?.(payload?.existing ?? []);
                    existsCallbacks.current.delete(payload?.id);
                    break;
                case OPERATIONS.PATH_SYNC:
                    if (payload?.path && payload.path !== directoryRef.current) {
                        skipNextPathSync.current = true;
                        setDirectory(payload.path);
                        setHistory(prev => [...prev, payload.path]);
                        setHistoryIndex(prev => prev + 1);
                    }
                    break;
                case OPERATIONS.STAT:
                case OPERATIONS.CHECKSUM:
                case OPERATIONS.FOLDER_SIZE:
                    propertiesHandlerRef.current?.({ operation, payload });
                    break;
                case OPERATIONS.TRANSFER_PROGRESS:
                    applyServerProgress(session.id, payload);
                    break;
            }
        } catch (err) { console.error("Error processing SFTP message:", err); }
    };

    const handleWsError = useCallback((event) => {
        console.error("SFTP WebSocket error:", event);
        setConnectionError("Connection error");
        setIsReady(false);
    }, []);

    const handleWsClose = useCallback((event) => {
        setIsReady(false);
        for (const resolve of existsCallbacks.current.values()) resolve(null);
        existsCallbacks.current.clear();
        if (event.code === 4001 || event.code === 4002) {
            sendToast(t("common.error"), t("servers.fileManager.toast.connectionLost"));
            disconnectFromServer(session.id);
        }
    }, [disconnectFromServer, session.id]);

    const handleWsOpen = useCallback(() => { reconnectAttemptsRef.current = 0; setConnectionError(null); }, []);

    const { sendMessage, readyState } = useWebSocket(wsUrl, {
        onError: handleWsError,
        onMessage: processMessage,
        onClose: handleWsClose,
        onOpen: handleWsOpen,
        shouldReconnect: (e) => e.code !== 1000 && e.code !== 4001 && e.code !== 4002 && ++reconnectAttemptsRef.current <= 10,
        reconnectAttempts: 10,
        reconnectInterval: 1500,
    });

    const sendOperation = useCallback((operation, payload = {}) => {
        if (readyState !== 1) return false;
        try {
            const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
            const message = new Uint8Array(1 + payloadBytes.length);
            message[0] = operation;
            message.set(payloadBytes, 1);
            sendMessage(message);
            return true;
        } catch { return false; }
    }, [sendMessage, readyState]);

    const createFile = (fileName) => sendOperation(OPERATIONS.CREATE_FILE, { path: `${directory}/${fileName}` });
    const createFolder = (folderName) => sendOperation(OPERATIONS.CREATE_FOLDER, { path: `${directory}/${folderName}` });
    const listFiles = useCallback((silent = false) => { if (!silent) setLoading(true); setError(null); sendOperation(OPERATIONS.LIST_FILES, { path: directory }); }, [directory, sendOperation]);
    const scheduleRefresh = () => {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => listFiles(true), REFRESH_DEBOUNCE);
    };
    const checkExisting = useCallback(async (paths) => {
        if (!paths.length) return [];
        const existing = await new Promise(resolve => {
            const id = ++existsRequestId.current;
            existsCallbacks.current.set(id, resolve);
            if (!sendOperation(OPERATIONS.CHECK_EXISTS, { id, paths })) {
                existsCallbacks.current.delete(id);
                resolve(null);
            }
        });
        if (!existing) sendToast(t("common.error"), t("servers.fileManager.toast.connectionLost"));
        return existing;
    }, [sendOperation]);

    const moveFiles = useCallback(async (sources, destination) => {
        const resolved = await resolveDestinationConflicts("move", withoutSelfTargets(sources, destination), destination);
        if (resolved) sendOperation(OPERATIONS.MOVE_FILES, { sources: resolved.sources, destination, overwrite: resolved.overwrite });
    }, [sendOperation, checkExisting]);
    const copyFiles = useCallback(async (sources, destination) => {
        const resolved = await resolveDestinationConflicts("copy", withoutSelfTargets(sources, destination), destination);
        if (resolved) sendOperation(OPERATIONS.COPY_FILES, { sources: resolved.sources, destination, overwrite: resolved.overwrite });
    }, [sendOperation, checkExisting]);

    const changeDirectory = (newDirectory) => {
        if (newDirectory === directory) return;
        setHistory(historyIndex === history.length - 1 ? [...history, newDirectory] : [...history.slice(0, historyIndex + 1), newDirectory]);
        setHistoryIndex(historyIndex + 1);
        setDirectory(newDirectory);
        sendOperation(OPERATIONS.PATH_SYNC, { path: newDirectory });
    };

    const goBack = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); const p = history[historyIndex - 1]; setDirectory(p); sendOperation(OPERATIONS.PATH_SYNC, { path: p }); } };
    const goForward = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); const p = history[historyIndex + 1]; setDirectory(p); sendOperation(OPERATIONS.PATH_SYNC, { path: p }); } };

    const handleFileDrop = async (entries, files, targetDir) => {
        if (!entries.length) {
            queueSessionUploads(files.map(file => ({ file, targetDir })));
            return;
        }

        const { files: collected, emptyDirs } = await collectDroppedEntries(entries, targetDir);
        for (const path of emptyDirs) sendOperation(OPERATIONS.CREATE_FOLDER, { path, recursive: true });
        queueSessionUploads(collected);
    };

    const handleDrag = (e) => {
        if (e.dataTransfer.types.includes("application/x-sftp-files")) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragover") setDragging(true);
        else if (e.type === "dragleave" && !dropZoneRef.current.contains(e.relatedTarget)) setDragging(false);
        else if (e.type === "drop") {
            setDragging(false);
            handleFileDrop(takeDroppedEntries(e.dataTransfer), [...e.dataTransfer.files], directory).catch(err =>
                sendToast(t("common.error"), t("servers.fileManager.toast.uploadFailed", { message: err.message }))
            );
        }
    };

    const searchDirectories = (searchPath) => sendOperation(OPERATIONS.SEARCH_DIRECTORIES, { searchPath });
    const resolveSymlink = (path, callback) => { symlinkCallbacks.current.push(callback); sendOperation(OPERATIONS.RESOLVE_SYMLINK, { path }); };

    const handleOpenFile = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'editor' }]);
    const handleOpenPreview = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'preview' }]);

    useEffect(() => { directoryRef.current = directory; }, [directory]);

    useEffect(() => {
        sessionHandlersRef.current.send = sendOperation;
        sessionHandlersRef.current.refresh = () => listFiles(true);
    }, [sendOperation, listFiles]);

    useEffect(() => registerSession(session.id, {
        send: (operation, payload) => sessionHandlersRef.current.send(operation, payload),
        refresh: () => sessionHandlersRef.current.refresh(),
    }), [registerSession, session.id]);

    useEffect(() => () => clearTimeout(refreshTimerRef.current), []);

    useEffect(() => { setSearchQuery(""); }, [directory]);

    useEffect(() => {
        if (!isActive) return;
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isActive]);

    const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(""); }, []);

    useEffect(() => {
        if (isReady) {
            if (skipNextPathSync.current) {
                skipNextPathSync.current = false;
            }
            listFiles();
        }
    }, [directory, isReady]);

    return (
        <div className="file-renderer" ref={dropZoneRef} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrag}>
            <div className={`drag-overlay ${dragging ? "active" : ""}`}>
                <div className="drag-item">
                    <Icon path={mdiCloudUpload} />
                    <h2>{t("servers.fileManager.dropOverlay")}</h2>
                </div>
            </div>
            <div className="file-manager">
                <ActionBar path={directory} updatePath={changeDirectory} createFile={() => fileListRef.current?.startCreateFile()}
                    createFolder={() => fileListRef.current?.startCreateFolder()} uploadFile={uploadFile} uploadFolder={uploadFolder}
                    refreshFiles={() => listFiles(true)} goBack={goBack} goForward={goForward} historyIndex={historyIndex}
                    homePath={homePath}
                    historyLength={history.length}
                    searchDirectories={searchDirectories} directorySuggestions={directorySuggestions}
                    setDirectorySuggestions={setDirectorySuggestions} moveFiles={moveFiles} copyFiles={copyFiles}
                    capabilities={capabilities}
                    sessionId={session.id} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchOpen={searchOpen}
                    setSearchOpen={setSearchOpen} closeSearch={closeSearch} searchResultCount={searchResultCount} />
                <FileList ref={fileListRef} items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                    downloadFile={downloadFile} downloadMultipleFiles={downloadMultipleFiles} setCurrentFile={handleOpenFile} setPreviewFile={handleOpenPreview}
                    loading={loading} viewMode={viewMode} error={error || connectionError} resolveSymlink={resolveSymlink} session={session}
                    createFile={createFile} createFolder={createFolder} moveFiles={moveFiles} copyFiles={copyFiles}
                    transferFromSession={transferFromSession} isActive={isActive}
                    capabilities={capabilities}
                    searchQuery={searchQuery} onSearchResults={setSearchResultCount} onSelectionChange={handleSelectionChange}
                    onOpenTerminal={onOpenTerminal} onPropertiesMessage={(handler) => { propertiesHandlerRef.current = handler; }}
                    onTreeListing={(handler) => { treeHandlerRef.current = handler; }} />
                <TransferPanel sessionId={session.id} />
                <ConflictDialog conflict={conflict} onChoice={settleConflict} onClose={dismissConflict} />
                <StatusBar folderCount={folderCount} fileCount={fileCount} hiddenCount={hiddenCount} selectedCount={selectedCount}
                    showHiddenFiles={showHiddenFiles} onToggleHiddenFiles={toggleHiddenFiles}
                    viewMode={viewMode} setViewMode={setViewMode} />
            </div>
        </div>
    );
};
