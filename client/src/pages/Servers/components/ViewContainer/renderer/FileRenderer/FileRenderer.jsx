import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import CreateFolderDialog from "./components/CreateFolderDialog";

const CHUNK_SIZE = 128 * 1024;

export const FileRenderer = ({ session, disconnectFromServer }) => {
    const { sessionToken } = useContext(UserContext);

    const [folderDialogOpen, setFolderDialogOpen] = useState(false);

    const [uploadProgress, setUploadProgress] = useState(0);

    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const path = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/sftp` : "localhost:6989/api/servers/sftp";
    const url = `${protocol}://${path}?sessionToken=${sessionToken}&serverId=${session.server}&identityId=${session.identity}`;

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
        } catch (ignored) {
        }

        switch (operation) {
            case 0x0:
            case 0x5:
            case 0x4:
                listFiles();
                break;
            case 0x2:
                console.log("Upload started");
                break;
            case 0x3:
                console.log("Chunk received");
                break;
            case 0x1:
                setItems(payload.files);
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
        sendOperation(0x1, { path: directory });
    };

    useEffect(() => {
        listFiles();
    }, [directory]);

    return (
        <div className="file-renderer">
            {uploadProgress > 0 && <progress value={uploadProgress} max="100" />}
            <CreateFolderDialog open={folderDialogOpen} onclose={() => setFolderDialogOpen(false)}
                                createFolder={createFolder} />
            <ActionBar path={directory} updatePath={setDirectory} createFolder={() => setFolderDialogOpen(true)}
                       sendMessage={sendOperation} uploadFile={uploadFile} />
            <FileList items={items} path={directory} updatePath={setDirectory} />
        </div>
    );
};