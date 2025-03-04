import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import Button from "@/common/components/Button";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import IdentityPage from "@/pages/Servers/components/ServerDialog/pages/IdentityPage.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";

const tabs = ["Details", "Identities", "Settings"];

export const ServerDialog = ({ open, onClose, currentFolderId, editServerId }) => {

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [ip, setIp] = useState("");
    const [port, setPort] = useState("");
    const [protocol, setProtocol] = useState(null);
    const [identities, setIdentities] = useState([]);

    const [identityUpdates, setIdentityUpdates] = useState({});

    const [activeTab, setActiveTab] = useState(0);

    const postIdentity = async (identity) => {
        try {
            if (identity.username === "") identity.username = undefined;
            if (identity.passphrase === "") identity.passphrase = undefined;
            if (identity.password === "") identity.password = undefined;
            if (identity.sshKey === null) identity.sshKey = undefined;

            const result = await putRequest("identities", {
                name: identity.name, username: identity.username, type: identity.authType,
                password: identity.password, sshKey: identity.sshKey, passphrase: identity.passphrase,
            });

            if (result.id) setIdentityUpdates({});

            refreshIdentities();

            return result;
        } catch (error) {
            sendToast("Error", error.message || "Failed to create identity");
            console.error(error);
        }
    };

    const patchIdentity = async (identity) => {
        try {
            if (identity.username === "") identity.username = undefined;
            if (identity.passphrase === "") identity.passphrase = undefined;
            if (identity.password === "") identity.password = undefined;
            if (identity.sshKey === null) identity.sshKey = undefined;

            await patchRequest("identities/" + identity.id, {
                name: identity.name, username: identity.username, type: identity.authType,
                password: identity.password, sshKey: identity.sshKey, passphrase: identity.passphrase,
            });

            setIdentityUpdates({});
            refreshIdentities();
        } catch (error) {
            sendToast("Error", error.message || "Failed to update identity");
            console.error(error);
        }
    };

    const updateIdentities = async () => {
        for (const identityId of Object.keys(identityUpdates)) {
            if (identityId === "new") {
                return await postIdentity(identityUpdates[identityId]);
            } else {
                await patchIdentity({ ...identityUpdates[identityId], id: identityId });
            }
        }
    };

    const createServer = async () => {
        try {
            let identity = null;
            if (Object.keys(identityUpdates).length > 0) {
                identity = await updateIdentities();
                if (!identity) return;
                loadIdentities();
            }

            const result = await putRequest("servers", {
                name, icon: icon, ip, port, protocol: protocol,
                folderId: currentFolderId, identities: identity?.id ? [identity?.id] : [],
            });

            loadServers();
            if (result.id) {
                sendToast("Success", "Server created successfully");
                onClose();
            }
        } catch (error) {
            sendToast("Error", error.message || "Failed to create server");
            console.error(error);
        }
    };

    const patchServer = async () => {
        try {
            const identity = await updateIdentities();

            await patchRequest("servers/" + editServerId, { name, icon: icon, ip, port, protocol: protocol,
                identities: identity?.id ? [identity?.id] : undefined });

            loadServers();
            sendToast("Success", "Server updated successfully");
            onClose();
        } catch (error) {
            sendToast("Error", error.message || "Failed to update server");
            console.error(error);
        }
    };

    useEffect(() => {
        if (!open) return;

        if (editServerId) {
            getRequest("servers/" + editServerId).then((server) => {
                setName(server.name);
                setIcon(server.icon);
                setIp(server.ip);
                setPort(server.port);
                setProtocol(server.protocol);
                setIdentities(server.identities);
            });
        } else {
            setName("");
            setIcon(null);
            setIp("");
            setPort("");
            setProtocol(null);
            setIdentities([]);
        }

        setIdentityUpdates({});
        setActiveTab(0);

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                editServerId ? patchServer() : createServer();
            }
        };

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        };
    }, [open]);

    const refreshIdentities = () => {
        if (!editServerId) return;

        getRequest("servers/" + editServerId).then((server) => {
            setIdentities(server.identities);
        });
    };

    useEffect(() => {
        if (!open) return;

        // Default port for each protocol
        if (protocol === "ssh" && (port === "3389" || port === "5900" || port === "")) setPort("22");
        if (protocol === "rdp" && (port === "22" || port === "5900" || port === "")) setPort("3389");
        if (protocol === "vnc" && (port === "22" || port === "3389" || port === "")) setPort("5900");
    }, [protocol]);

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
                    {activeTab === 1 &&
                        <IdentityPage serverIdentities={identities} setIdentityUpdates={setIdentityUpdates}
                                      refreshIdentities={refreshIdentities} identityUpdates={identityUpdates} />}
                    {activeTab === 2 && <p style={{textAlign: "center"}}>Not yet implemented</p>}
                </div>

                <Button className="server-dialog-button" onClick={editServerId ? patchServer : createServer}
                        text={editServerId ? "Save" : "Create"} />
            </div>

        </DialogProvider>
    );
};