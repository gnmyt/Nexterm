import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import CreateFolderDialog from "./components/CreateFolderDialog";
import FileEditor from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileEditor";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";

const CHUNK_SIZE = 128 * 1024;

export const FileRenderer = ({ session, disconnectFromServer }) => {
    const { sessionToken } = useContext(UserContext);

    const [dragging, setDragging] = useState(false);
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [currentFile, setCurrentFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState(["/"]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState("list");
    const [directorySuggestions, setDirectorySuggestions] = useState([]);

    const dropZoneRef = useRef(null);

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const path = process.env.NODE_ENV === "production" ? `${window.location.host}/api/ws/sftp` : "localhost:6989/api/ws/sftp";

    let url = `${protocol}://${path}?sessionToken=${sessionToken}&sessionId=${session.id}`;

    const downloadFile = (path) => {
        let url = `/api/entries/sftp-download?sessionId=${session.id}&path=${path}&sessionToken=${sessionToken}`;
        
        const link = document.createElement("a");
        link.href = url;
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
        try {
            payload = JSON.parse(data.slice(1));
        } catch (ignored) {}

        switch (operation) {
            case 0x0:
            case 0x5:
            case 0x4:
            case 0x6:
            case 0x7:
            case 0x8:
                listFiles();
                break;
            case 0x1:
                if (payload.error) {
                    setError(payload.error);
                    setItems([]);
                } else if (payload.files) {
                    setItems(payload.files);
                    setError(null);
                } else {
                    setError("Failed to load directory contents");
                    setItems([]);
                }
                setLoading(false);
                break;
            case 0x9:
                setError(payload.message || "An error occurred");
                setItems([]);
                setLoading(false);
                break;
            case 0xA:
                if (payload.directories) setDirectorySuggestions(payload.directories);
                break;
        }
    };

    const { sendMessage } = useWebSocket(url, {
        onError: () => disconnectFromServer(session.id),
        onMessage: processMessage,
        shouldReconnect: () => true,
    });

    const sendOperation = (operation, payload) => {
        const encoder = new TextEncoder();
        const operationBytes = new Uint8Array([operation]);
        const payloadBytes = encoder.encode(JSON.stringify(payload));

        const message = new Uint8Array(operationBytes.length + payloadBytes.length);
        message.set(operationBytes);
        message.set(payloadBytes, operationBytes.length);

        sendMessage(message);
    };

    const createFolder = (folderName) => {
        sendOperation(0x5, { path: directory + "/" + folderName });
    };

    const listFiles = () => {
        setLoading(true);
        setError(null);
        sendOperation(0x1, { path: directory });
    };

    const changeDirectory = (newDirectory) => {
        if (newDirectory === directory) return;

        if (historyIndex === history.length - 1) {
            setHistory([...history, newDirectory]);
        } else {
            setHistory(history.slice(0, historyIndex + 1).concat(newDirectory));
        }

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

        const { type } = e;

        if (type === "dragover") {
            setDragging(true);
        }

        if (type === "dragleave" && !dropZoneRef.current.contains(e.relatedTarget)) {
            setDragging(false);
        }

        if (type === "drop") {
            setDragging(false);

            const files = e.dataTransfer.files;
            for (let i = 0; i < files.length; i++) {
                await uploadFileChunks(files[i]);
            }

            setUploadProgress(0);
        }
    };

    const searchDirectories = (searchPath) => sendOperation(0xA, { searchPath });

    useEffect(() => {
        listFiles();
    }, [directory]);

    return (
        <div className="file-renderer" ref={dropZoneRef} onDragOver={handleDrag} onDragLeave={handleDrag}
             onDrop={handleDrag}>
            <div className="drag-overlay" style={{ display: dragging && currentFile === null ? "flex" : "none" }}>
                <div className="drag-item">
                    <Icon path={mdiCloudUpload} />
                    <h2>Drop files to upload</h2>
                </div>
            </div>
            {currentFile === null && (
                <div className="file-manager">
                    <CreateFolderDialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} createFolder={createFolder} />
                    <ActionBar path={directory} updatePath={changeDirectory} createFolder={() => setFolderDialogOpen(true)}
                        uploadFile={uploadFile} goBack={goBack} goForward={goForward} historyIndex={historyIndex}
                        historyLength={history.length} viewMode={viewMode} setViewMode={setViewMode} 
                        searchDirectories={searchDirectories} directorySuggestions={directorySuggestions} 
                        setDirectorySuggestions={setDirectorySuggestions} />
                    <FileList items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                              downloadFile={downloadFile} setCurrentFile={setCurrentFile} loading={loading} viewMode={viewMode} error={error} />
                </div>
            )}
            {currentFile !== null && (
                <FileEditor currentFile={currentFile} session={session}
                    setCurrentFile={setCurrentFile} sendOperation={sendOperation} />
            )}
            {uploadProgress > 0 && <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />}
        </div>
    );
};