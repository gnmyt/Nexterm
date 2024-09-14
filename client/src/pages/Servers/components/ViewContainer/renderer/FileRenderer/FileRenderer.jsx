import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import useWebSocket from "react-use-websocket";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";

export const FileRenderer = ({ session, disconnectFromServer }) => {
    const { sessionToken } = useContext(UserContext);

    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const path = process.env.NODE_ENV === "production" ? `${window.location.host}/api/servers/sftp` : "localhost:6989/api/servers/sftp";
    const url = `${protocol}://${path}?sessionToken=${sessionToken}&serverId=${session.server}&identityId=${session.identity}`;

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
                listFiles();
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

    const listFiles = () => {
        sendOperation(0x1, { path: directory });
    };

    useEffect(() => {
        listFiles();
    }, [directory]);

    return (
        <div className="file-renderer">
            <ActionBar path={directory} updatePath={setDirectory} />
            <FileList items={items} path={directory} updatePath={setDirectory} />
        </div>
    );
};