import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useFileSettings } from "@/common/contexts/FileSettingsContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";
import { getWebSocketUrl, getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import { uploadFile as uploadFileRequest } from "@/common/utils/RequestUtil.js";

const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6, 
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA, 
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11,
};

export const FileRenderer = ({ session, disconnectFromServer, setOpenFileEditors, isActive, onOpenTerminal }) => {
    const { sessionToken } = useContext(UserContext);
    const { defaultViewMode } = useFileSettings();
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
    
    const symlinkCallbacks = useRef([]);
    const dropZoneRef = useRef(null);
    const uploadQueueRef = useRef([]);
    const reconnectAttemptsRef = useRef(0);
    const fileListRef = useRef(null);
    const propertiesHandlerRef = useRef(null);

    const wsUrl = getWebSocketUrl("/api/ws/sftp", { sessionToken, sessionId: session.id });

    const downloadFile = (path) => {
        const baseUrl = getBaseUrl();
        const link = document.createElement("a");
        link.href = `${baseUrl}/api/entries/sftp?sessionId=${session.id}&path=${path}&sessionToken=${sessionToken}`;
        link.download = path.split("/").pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const downloadMultipleFiles = (paths) => {
        if (!paths || paths.length === 0) return;

        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/api/entries/sftp/multi?sessionId=${session.id}&sessionToken=${sessionToken}`;
        
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        form.style.display = 'none';
        
        const pathsInput = document.createElement('input');
        pathsInput.type = 'hidden';
        pathsInput.name = 'paths';
        pathsInput.value = JSON.stringify(paths);
        form.appendChild(pathsInput);
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        
        sendToast("Success", `Downloading ${paths.length} item${paths.length > 1 ? 's' : ''}...`);
    }

    const uploadFileHttp = async (file, targetDir) => {
        const filePath = `${targetDir}/${file.name}`.replace(/\/+/g, '/');
        setIsUploading(true);
        setUploadProgress(0);

        try {
            const url = `/api/entries/sftp/upload?sessionId=${session.id}&path=${encodeURIComponent(filePath)}&sessionToken=${sessionToken}`;
            await uploadFileRequest(url, file, {
                onProgress: setUploadProgress,
                timeout: 5 * 60 * 1000,
            });

            setIsUploading(false);
            setUploadProgress(0);
            listFiles();
            sendToast("Success", `Uploaded ${file.name}`);
            return true;
        } catch (err) {
            console.error("Upload error:", err);
            sendToast("Error", `Upload failed: ${err.message}`);
            setIsUploading(false);
            setUploadProgress(0);
            return false;
        }
    };

    const processUploadQueue = async () => {
        while (uploadQueueRef.current.length > 0) {
            const { file, targetDir } = uploadQueueRef.current[0];
            await uploadFileHttp(file, targetDir);
            uploadQueueRef.current.shift();
        }
    };

    const queueUpload = (file, targetDir) => {
        uploadQueueRef.current.push({ file, targetDir });
        if (uploadQueueRef.current.length === 1) processUploadQueue();
    };

    const uploadFile = async () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.onchange = async () => {
            for (const file of fileInput.files) queueUpload(file, directory);
        };
        fileInput.click();
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
                    reconnectAttemptsRef.current = 0;
                    listFiles();
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
                    listFiles();
                    break;
                case OPERATIONS.ERROR:
                    sendToast("Error", payload?.message || "An error occurred");
                    setLoading(false);
                    break;
                case OPERATIONS.SEARCH_DIRECTORIES:
                    if (payload?.directories) setDirectorySuggestions(payload.directories);
                    break;
                case OPERATIONS.RESOLVE_SYMLINK:
                    if (payload) { const cb = symlinkCallbacks.current.shift(); if (cb) cb(payload); }
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
        if (reconnectAttemptsRef.current >= 3) {
            sendToast("Error", "SFTP connection lost. Please reconnect.");
            disconnectFromServer(session.id);
        }
    }, [disconnectFromServer, session.id]);

    const handleWsClose = useCallback(() => setIsReady(false), []);
    const handleWsOpen = useCallback(() => { reconnectAttemptsRef.current = 0; setConnectionError(null); }, []);

    const { sendMessage, readyState } = useWebSocket(wsUrl, {
        onError: handleWsError,
        onMessage: processMessage,
        onClose: handleWsClose,
        onOpen: handleWsOpen,
        shouldReconnect: (e) => e.code !== 1000 && e.code < 4000 && ++reconnectAttemptsRef.current <= 3,
        reconnectAttempts: 3,
        reconnectInterval: 2000,
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
    const listFiles = useCallback(() => { setLoading(true); setError(null); sendOperation(OPERATIONS.LIST_FILES, { path: directory }); }, [directory, sendOperation]);
    const moveFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.MOVE_FILES, { sources, destination }), [sendOperation]);
    const copyFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.COPY_FILES, { sources, destination }), [sendOperation]);

    const changeDirectory = (newDirectory) => {
        if (newDirectory === directory) return;
        setHistory(historyIndex === history.length - 1 ? [...history, newDirectory] : [...history.slice(0, historyIndex + 1), newDirectory]);
        setHistoryIndex(historyIndex + 1);
        setDirectory(newDirectory);
    };

    const goBack = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setDirectory(history[historyIndex - 1]); } };
    const goForward = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setDirectory(history[historyIndex + 1]); } };

    const handleDrag = async (e) => {
        if (e.dataTransfer.types.includes("application/x-sftp-files")) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragover") setDragging(true);
        else if (e.type === "dragleave" && !dropZoneRef.current.contains(e.relatedTarget)) setDragging(false);
        else if (e.type === "drop") {
            setDragging(false);
            for (let i = 0; i < e.dataTransfer.files.length; i++) queueUpload(e.dataTransfer.files[i], directory);
        }
    };

    const searchDirectories = (searchPath) => sendOperation(OPERATIONS.SEARCH_DIRECTORIES, { searchPath });
    const resolveSymlink = (path, callback) => { symlinkCallbacks.current.push(callback); sendOperation(OPERATIONS.RESOLVE_SYMLINK, { path }); };

    const handleOpenFile = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'editor' }]);
    const handleOpenPreview = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'preview' }]);

    useEffect(() => { if (isReady) listFiles(); }, [directory, isReady]);

    return (
        <div className="file-renderer" ref={dropZoneRef} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrag}>
            <div className={`drag-overlay ${dragging ? "active" : ""}`}>
                <div className="drag-item">
                    <Icon path={mdiCloudUpload} />
                    <h2>Drop files to upload</h2>
                </div>
            </div>
            <div className="file-manager">
                <ActionBar path={directory} updatePath={changeDirectory} createFile={() => fileListRef.current?.startCreateFile()}
                    createFolder={() => fileListRef.current?.startCreateFolder()} uploadFile={uploadFile} goBack={goBack} goForward={goForward} historyIndex={historyIndex}
                    historyLength={history.length} viewMode={viewMode} setViewMode={setViewMode} 
                    searchDirectories={searchDirectories} directorySuggestions={directorySuggestions} 
                    setDirectorySuggestions={setDirectorySuggestions} moveFiles={moveFiles} copyFiles={copyFiles} 
                    sessionId={session.id} />
                <FileList ref={fileListRef} items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                    downloadFile={downloadFile} downloadMultipleFiles={downloadMultipleFiles} setCurrentFile={handleOpenFile} setPreviewFile={handleOpenPreview} 
                    loading={loading} viewMode={viewMode} error={error || connectionError} resolveSymlink={resolveSymlink} session={session}
                    createFile={createFile} createFolder={createFolder} moveFiles={moveFiles} copyFiles={copyFiles} isActive={isActive}
                    onOpenTerminal={onOpenTerminal} onPropertiesMessage={(handler) => { propertiesHandlerRef.current = handler; }} />
            </div>
            {isUploading && <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />}
        </div>
    );
};
