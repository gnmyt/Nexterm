import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import Button from "@/common/components/Button/index.js";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";

const tabs = ["Details", "Identities", "Settings"];

export const ServerDialog = ({open, onClose, currentFolderId, editServerId}) => {

    const {loadServers} = useContext(ServerContext);

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [ip, setIp] = useState("");
    const [port, setPort] = useState("");
    const [protocol, setProtocol] = useState(null);

    const [activeTab, setActiveTab] = useState(0);

    const createServer = async () => {
        try {
            const result = await putRequest("servers", { name, icon: icon, ip, port,
                protocol: protocol, folderId: currentFolderId });
            loadServers();
            if (result.id) onClose();
        } catch (error) {
            console.error(error);
        }
    }

    const patchServer = async () => {
        try {
            await patchRequest("servers/" + editServerId, { name, icon: icon, ip, port,
                protocol: protocol });
            loadServers();
            onClose();
        } catch (error) {
            console.error(error);
        }
    }

    useEffect(() => {
        if (!open) return;

        if (editServerId) {
            getRequest("servers/" + editServerId).then((server) => {
                setName(server.name);
                setIcon(server.icon);
                setIp(server.ip);
                setPort(server.port);
                setProtocol(server.protocol);
            });

        } else {
            setName("");
            setIcon(null);
            setIp("");
            setPort("");
            setProtocol(null);
        }

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                editServerId ? patchServer() : createServer();
            }
        }

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        }
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="server-dialog">
                <div className="server-dialog-title">
                    <h2>{editServerId ? "Edit" : "Add"} server</h2>
                </div>

                <div className="server-dialog-tabs">
                    {tabs.map((tab, index) => (
                        <div key={index} className={`tabs-item ${activeTab === index ? "tabs-item-active" : ""}`}
                             onClick={() => setActiveTab(index)}>
                            <h3>{tab}</h3>
                        </div>
                    ))}
                </div>

                <div className="server-dialog-content">
                    {activeTab === 0 && <DetailsPage name={name} setName={setName}
                                                     icon={icon} setIcon={setIcon} ip={ip} setIp={setIp}
                                                     port={port} setPort={setPort}
                                                     protocol={protocol} setProtocol={setProtocol} />}
                    {activeTab === 1 && <div>Identities Page</div>}
                    {activeTab === 2 && <div>Settings Page</div>}
                </div>

                <Button className="server-dialog-button" onClick={editServerId ? patchServer : createServer}
                        text={editServerId ? "Save" : "Create"} />
            </div>

        </DialogProvider>
    )
}