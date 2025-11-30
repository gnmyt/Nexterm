import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import CreateFolderDialog from "./components/CreateFolderDialog";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";

const CHUNK_SIZE = 128 * 1024;

export const FileRenderer = ({ session, disconnectFromServer, setOpenFileEditors }) => {
    const { sessionToken } = useContext(UserContext);

    const [dragging, setDragging] = useState(false);
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState(["/"]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState("list");
    const [directorySuggestions, setDirectorySuggestions] = useState([]);
    
    const symlinkCallbacks = useRef([]);
    const dropZoneRef = useRef(null);

    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${process.env.NODE_ENV === "production" ? `${window.location.host}/api/ws/sftp` : "localhost:6989/api/ws/sftp"}?sessionToken=${sessionToken}&sessionId=${session.id}`;

    const downloadFile = (path) => {
        const link = document.createElement("a");
        link.href = `/api/entries/sftp-download?sessionId=${session.id}&path=${path}&sessionToken=${sessionToken}`;
        link.download = path.split("/").pop();
        document.body.appendChild(link);
        link.click();
    }

    const readFileChunk = (file, start, end) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(btoa(new Uint8Array(reader.result).reduce((acc, byte) => acc + String.fromCharCode(byte), "")));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file.slice(start, end));
        });
    };

    const uploadFileChunks = async (file) => {
        sendOperation(0x2, { path: directory + "/" + file.name });

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = await readFileChunk(file, start, end);

            setUploadProgress((i + 1) / totalChunks * 100);
            sendOperation(0x3, { chunk });
        }

        sendOperation(0x4);
    };

    const uploadFile = async () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            await uploadFileChunks(file);
            setUploadProgress(0);
        };
        fileInput.click();
    };

    const processMessage = async (event) => {
        const data = await event.data.text();
        const operation = data.charCodeAt(0);
        let payload;
        try { payload = JSON.parse(data.slice(1)); } catch {}

        if ([0x0, 0x5, 0x6, 0x7, 0x8].includes(operation)) {
            listFiles();
        } else if (operation === 0x1) {
            if (payload?.error) {
                setError(payload.error);
                setItems([]);
            } else if (payload?.files) {
                setItems(payload.files);
                setError(null);
            } else {
                setError("Failed to load directory contents");
                setItems([]);
            }
            setLoading(false);
        } else if (operation === 0x9) {
            setError(payload?.message || "An error occurred");
            setItems([]);
            setLoading(false);
        } else if (operation === 0xA && payload?.directories) {
            setDirectorySuggestions(payload.directories);
        } else if (operation === 0xB && payload) {
            const callback = symlinkCallbacks.current.shift();
            if (callback) callback(payload);
        }
    };

    const { sendMessage } = useWebSocket(wsUrl, {
        onError: () => disconnectFromServer(session.id),
        onMessage: processMessage,
        shouldReconnect: () => true,
    });

    const sendOperation = (operation, payload) => {
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
        const message = new Uint8Array(1 + payloadBytes.length);
        message[0] = operation;
        message.set(payloadBytes, 1);
        sendMessage(message);
    };

    const createFolder = (folderName) => sendOperation(0x5, { path: `${directory}/${folderName}` });

    const listFiles = () => {
        setLoading(true);
        setError(null);
        sendOperation(0x1, { path: directory });
    };

    const changeDirectory = (newDirectory) => {
        if (newDirectory === directory) return;
        setHistory(historyIndex === history.length - 1 ? [...history, newDirectory] : [...history.slice(0, historyIndex + 1), newDirectory]);
        setHistoryIndex(historyIndex + 1);
        setDirectory(newDirectory);
    };

    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setDirectory(history[newIndex]);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setDirectory(history[newIndex]);
        }
    };

    const handleDrag = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === "dragover") {
            setDragging(true);
        } else if (e.type === "dragleave" && !dropZoneRef.current.contains(e.relatedTarget)) {
            setDragging(false);
        } else if (e.type === "drop") {
            setDragging(false);
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                await uploadFileChunks(e.dataTransfer.files[i]);
            }
            setUploadProgress(0);
        }
    };

    const searchDirectories = (searchPath) => sendOperation(0xA, { searchPath });

    const resolveSymlink = (path, callback) => {
        symlinkCallbacks.current.push(callback);
        sendOperation(0xB, { path });
    };

    const handleOpenFile = (filePath) => {
        setOpenFileEditors(prev => [...prev, {
            id: `${session.id}-${filePath}-${Date.now()}`,
            file: filePath,
            session: session,
            sendOperation: sendOperation,
            type: 'editor'
        }]);
    };

    const handleOpenPreview = (filePath) => {
        setOpenFileEditors(prev => [...prev, {
            id: `${session.id}-${filePath}-${Date.now()}`,
            file: filePath,
            session: session,
            type: 'preview'
        }]);
    };

    useEffect(() => {
        listFiles();
    }, [directory]);

    return (
        <div className="file-renderer" ref={dropZoneRef} onDragOver={handleDrag} onDragLeave={handleDrag}
             onDrop={handleDrag}>
            <div className={`drag-overlay ${dragging ? "active" : ""}`}>
                <div className="drag-item">
                    <Icon path={mdiCloudUpload} />
                    <h2>Drop files to upload</h2>
                </div>
            </div>
            <div className="file-manager">
                <CreateFolderDialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} createFolder={createFolder} />
                <ActionBar path={directory} updatePath={changeDirectory} createFolder={() => setFolderDialogOpen(true)}
                    uploadFile={uploadFile} goBack={goBack} goForward={goForward} historyIndex={historyIndex}
                    historyLength={history.length} viewMode={viewMode} setViewMode={setViewMode} 
                    searchDirectories={searchDirectories} directorySuggestions={directorySuggestions} 
                    setDirectorySuggestions={setDirectorySuggestions} />
                <FileList items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                          downloadFile={downloadFile} setCurrentFile={handleOpenFile} setPreviewFile={handleOpenPreview} loading={loading} viewMode={viewMode} error={error} resolveSymlink={resolveSymlink} />
            </div>
            {uploadProgress > 0 && <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />}
        </div>
    );
};