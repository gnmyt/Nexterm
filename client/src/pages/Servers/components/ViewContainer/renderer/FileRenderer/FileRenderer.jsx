import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";
import { getWebSocketUrl, getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import { uploadFile as uploadFileRequest, tauriDownload } from "@/common/utils/RequestUtil.js";
import { isTauri } from "@/common/utils/TauriUtil.js";

const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11, PATH_SYNC: 0x12,
};

const REFRESH_DEBOUNCE = 150;

const joinPath = (...parts) => parts.join("/").replace(/\/+/g, "/");

const createUploadStats = () => ({ uploaded: 0, failed: 0, sentBytes: 0, totalBytes: 0, firstError: null, lastName: "" });

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
    const { defaultViewMode } = usePreferences();
    const { sendToast } = useToast();

    const [dragging, setDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
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

    const directoryRef = useRef(directory);
    const skipNextPathSync = useRef(false);
    const symlinkCallbacks = useRef([]);
    const dropZoneRef = useRef(null);
    const uploadQueueRef = useRef([]);
    const reconnectAttemptsRef = useRef(0);
    const fileListRef = useRef(null);
    const propertiesHandlerRef = useRef(null);
    const uploadStatsRef = useRef(createUploadStats());
    const refreshTimerRef = useRef(null);

    const wsUrl = getWebSocketUrl("/api/ws/sftp", { sessionToken, sessionId: session.id });

    const downloadFile = async (path) => {
        const baseUrl = getBaseUrl();
        const fileName = path.split("/").pop();
        const url = `${baseUrl}/api/entries/sftp?sessionId=${session.id}&path=${path}&sessionToken=${sessionToken}`;
        
        if (isTauri()) {
            try {
                await tauriDownload(url, fileName);
                sendToast(t("common.success"), t("servers.fileManager.toast.downloaded", { name: fileName }));
            } catch (e) {
                if (e) sendToast(t("common.error"), e.message);
            }
            return;
        }
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadMultipleFiles = async (paths) => {
        if (!paths?.length) return;
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/api/entries/sftp/multi?sessionId=${session.id}&sessionToken=${sessionToken}`;
        const defaultFileName = paths.length === 1 ? `${paths[0].split("/").pop()}.zip` : "files.zip";
        
        if (isTauri()) {
            try {
                await tauriDownload(url, defaultFileName, {
                    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
                    fetchOptions: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }) }
                });
                sendToast(t("common.success"), t("servers.fileManager.toast.downloadingItems", { count: paths.length }));
            } catch (e) {
                if (e) sendToast(t("common.error"), e.message);
            }
            return;
        }
        const form = document.createElement("form");
        form.method = "POST";
        form.action = url;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "paths";
        input.value = JSON.stringify(paths);
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        sendToast(t("common.success"), t("servers.fileManager.toast.downloadingItems", { count: paths.length }));
    };

    const uploadFileHttp = async (file, targetDir) => {
        const filePath = joinPath(targetDir, file.name);
        const stats = uploadStatsRef.current;

        try {
            const url = `/api/entries/sftp/upload?sessionId=${session.id}&path=${encodeURIComponent(filePath)}&sessionToken=${sessionToken}`;
            await uploadFileRequest(url, file, {
                onProgress: (progress) => setUploadProgress(stats.totalBytes
                    ? Math.round(((stats.sentBytes + (progress / 100) * file.size) / stats.totalBytes) * 100)
                    : progress),
                timeout: 5 * 60 * 1000,
            });
            stats.uploaded++;
            stats.lastName = file.name;
        } catch (err) {
            console.error("Upload error:", err);
            stats.failed++;
            stats.firstError ??= err.message;
        } finally {
            stats.sentBytes += file.size;
        }
    };

    const reportUploadResult = ({ uploaded, failed, firstError, lastName }) => {
        if (uploaded) {
            sendToast(t("common.success"), uploaded === 1
                ? t("servers.fileManager.toast.uploaded", { name: lastName })
                : t("servers.fileManager.toast.uploadedItems", { count: uploaded }));
        }
        if (failed) {
            sendToast(t("common.error"), failed === 1
                ? t("servers.fileManager.toast.uploadFailed", { message: firstError })
                : t("servers.fileManager.toast.uploadFailedItems", { count: failed, message: firstError }));
        }
    };

    const processUploadQueue = async () => {
        setIsUploading(true);
        while (uploadQueueRef.current.length > 0) {
            const { file, targetDir } = uploadQueueRef.current[0];
            await uploadFileHttp(file, targetDir);
            uploadQueueRef.current.shift();
        }
        setIsUploading(false);
        setUploadProgress(0);
        listFiles(true);

        const stats = uploadStatsRef.current;
        uploadStatsRef.current = createUploadStats();
        reportUploadResult(stats);
    };

    const queueUploads = (uploads) => {
        if (!uploads.length) return;
        const idle = uploadQueueRef.current.length === 0;
        for (const upload of uploads) uploadStatsRef.current.totalBytes += upload.file.size;
        uploadQueueRef.current.push(...uploads);
        if (idle) processUploadQueue();
    };

    const uploadFile = async () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.onchange = () => {
            queueUploads([...fileInput.files].map(file => ({ file, targetDir: directory })));
        };
        fileInput.click();
    };

    const uploadFolder = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.onchange = () => {
            queueUploads([...input.files].map(file => ({
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
                    reconnectAttemptsRef.current = 0;
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
    const moveFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.MOVE_FILES, { sources, destination }), [sendOperation]);
    const copyFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.COPY_FILES, { sources, destination }), [sendOperation]);

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
            queueUploads(files.map(file => ({ file, targetDir })));
            return;
        }

        const { files: collected, emptyDirs } = await collectDroppedEntries(entries, targetDir);
        for (const path of emptyDirs) sendOperation(OPERATIONS.CREATE_FOLDER, { path, recursive: true });
        queueUploads(collected);
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
                    historyLength={history.length} viewMode={viewMode} setViewMode={setViewMode} 
                    searchDirectories={searchDirectories} directorySuggestions={directorySuggestions} 
                    setDirectorySuggestions={setDirectorySuggestions} moveFiles={moveFiles} copyFiles={copyFiles}
                    capabilities={capabilities}
                    sessionId={session.id} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchOpen={searchOpen}
                    setSearchOpen={setSearchOpen} closeSearch={closeSearch} searchResultCount={searchResultCount} />
                <FileList ref={fileListRef} items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                    downloadFile={downloadFile} downloadMultipleFiles={downloadMultipleFiles} setCurrentFile={handleOpenFile} setPreviewFile={handleOpenPreview}
                    loading={loading} viewMode={viewMode} error={error || connectionError} resolveSymlink={resolveSymlink} session={session}
                    createFile={createFile} createFolder={createFolder} moveFiles={moveFiles} copyFiles={copyFiles} isActive={isActive}
                    capabilities={capabilities}
                    searchQuery={searchQuery} onSearchResults={setSearchResultCount}
                    onOpenTerminal={onOpenTerminal} onPropertiesMessage={(handler) => { propertiesHandlerRef.current = handler; }} />
            </div>
            {isUploading && <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />}
        </div>
    );
};
