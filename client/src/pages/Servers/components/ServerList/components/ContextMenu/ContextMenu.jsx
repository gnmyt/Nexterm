import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import {
    deleteRequest,
    postRequest,
    putRequest,
} from "@/common/utils/RequestUtil.js";
import {
    mdiConnection,
    mdiContentCopy,
    mdiFolderOpen,
    mdiFolderPlus,
    mdiFolderRemove,
    mdiFormTextbox,
    mdiPencil,
    mdiPower,
    mdiServerMinus,
    mdiServerPlus,
    mdiStop,
    mdiChevronRight,
    mdiAccountCircle,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useContext, useState } from "react";
import ProxmoxLogo from "./assets/proxmox.jsx";
import "./styles.sass";

export const ContextMenu = ({
    position,
    id,
    type,
    setRenameStateId,
    setServerDialogOpen,
    setCurrentFolderId,
    setEditServerId,
    connectToServer,
    connectToPVEServer,
    setProxmoxDialogOpen,
    openSFTP,
}) => {
    const {
        loadServers,
        getServerById,
        getPVEServerById,
        getPVEContainerById,
    } = useContext(ServerContext);

    const { identities } = useContext(IdentityContext);

    const [showIdentitySubmenu, setShowIdentitySubmenu] = useState(false);
    const [showSftpSubmenu, setShowSftpSubmenu] = useState(false);

    const server = id
        ? type === "server-object"
            ? getServerById(id)
            : type === "pve-object"
                ? getPVEServerById(id.split("-")[1])
                : getPVEContainerById(id.split("-")[1], id.split("-")[2])
        : null;

    const isOrgFolder = id && id.toString().startsWith("org-");

    const createFolder = () => {
        const organizationId = isOrgFolder ? id.toString().split("-")[1] : undefined;

        putRequest("folders", {
            name: "New Folder",
            parentId: isOrgFolder ? undefined : (id === null ? undefined : id),
            organizationId: organizationId,
        }).then(async (result) => {
            await loadServers();
            if (result.id) setRenameStateId(result.id);
        });
    };

    const deleteFolder = () => deleteRequest("folders/" + id).then(loadServers);

    const deleteServer = () => deleteRequest("servers/" + id).then(loadServers);

    const createServer = () => {
        setCurrentFolderId(id);
        setServerDialogOpen();
    };

    const createPVEServer = () => {
        setCurrentFolderId(id);
        setProxmoxDialogOpen();
    };

    const connect = (identityId = null) => {
        if (type === "pve-entry") {
            connectToPVEServer(id.split("-")[1], id.split("-")[2]);
            return;
        }

        const targetIdentityId = identityId || server?.identities[0];
        connectToServer(server?.id, targetIdentityId);
        setShowIdentitySubmenu(false);
    };

    const connectSFTP = (identityId = null) => {
        const targetIdentityId = identityId || server?.identities[0];
        openSFTP(server?.id, targetIdentityId);
        setShowSftpSubmenu(false);
    };

    const getIdentityName = (identityId) => {
        const identity = identities?.find(id => id.id === identityId);
        return identity ? `${identity.name}` : `Identity ${identityId}`;
    };

    const editServer = () => {
        setEditServerId(id);
        setServerDialogOpen();
    };

    const editPVEServer = () => {
        setEditServerId(id);
        setProxmoxDialogOpen();
    };

    const postPVEAction = (type) => {
        const serverType = server?.type === "pve-qemu" ? "qemu" : "lxc";
        postRequest("pve-servers/" + serverType + "/" + id.split("-")[1] + "/" + server?.id + "/" + type)
            .then(loadServers);
    };

    const deletePVEServer = () => {
        deleteRequest("pve-servers/" + id.split("-")[1]).then(loadServers);
    };

    const duplicateServer = async () => {
        const server = getServerById(id);
        if (!server) return;

        try {
            await postRequest(`servers/${server.id}/duplicate`);
            await loadServers();
        } catch (error) {
            console.error("Failed to duplicate server:", error);
        }
    };

    return (
        <div
            className="context-menu"
            style={{ top: position.y, left: position.x }}
        >
            {type !== "server-object" &&
                type !== "pve-object" &&
                type !== "pve-entry" && (
                    <div className="context-item" onClick={createFolder}>
                        <Icon path={mdiFolderPlus} />
                        <p>Create Folder</p>
                    </div>
                )}
            {type === "folder-object" && !isOrgFolder && (
                <>
                    <div className="context-item" onClick={deleteFolder}>
                        <Icon path={mdiFolderRemove} />
                        <p>Delete Folder</p>
                    </div>
                    <div
                        className="context-item"
                        onClick={() => setRenameStateId(id)}
                    >
                        <Icon path={mdiFormTextbox} />
                        <p>Rename Folder</p>
                    </div>
                    <div className="context-item" onClick={createServer}>
                        <Icon path={mdiServerPlus} />
                        <p>Create Server</p>
                    </div>
                    <div className="context-item" onClick={createPVEServer}>
                        <ProxmoxLogo />
                        <p>Import PVE</p>
                    </div>
                </>
            )}
            {type === "server-object" && (
                <>
                    {server?.identities?.length > 0 && (
                        <>
                            {server.identities.length === 1 ? (
                                <div className="context-item" onClick={() => connect()}>
                                    <Icon path={mdiConnection} />
                                    <p>Connect</p>
                                </div>
                            ) : (
                                <div className="context-item submenu-parent"
                                     onMouseEnter={() => setShowIdentitySubmenu(true)}
                                     onMouseLeave={() => setShowIdentitySubmenu(false)}>
                                    <Icon path={mdiConnection} />
                                    <p>Connect</p>
                                    <Icon path={mdiChevronRight} className="submenu-arrow" />

                                    {showIdentitySubmenu && (
                                        <div className="submenu">
                                            {server.identities.map((identityId) => (
                                                <div
                                                    key={identityId}
                                                    className="context-item"
                                                    onClick={() => connect(identityId)}>
                                                    <Icon path={mdiAccountCircle} />
                                                    <p>{getIdentityName(identityId)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {server?.identities?.length > 0 && server?.protocol === "ssh" && (
                        <>
                            {server.identities.length === 1 ? (
                                <div className="context-item" onClick={() => connectSFTP()}>
                                    <Icon path={mdiFolderOpen} />
                                    <p>Open SFTP</p>
                                </div>
                            ) : (
                                <div className="context-item submenu-parent"
                                     onMouseEnter={() => setShowSftpSubmenu(true)}
                                     onMouseLeave={() => setShowSftpSubmenu(false)}>
                                    <Icon path={mdiFolderOpen} />
                                    <p>Open SFTP</p>
                                    <Icon path={mdiChevronRight} className="submenu-arrow" />

                                    {showSftpSubmenu && (
                                        <div className="submenu">
                                            {server.identities.map((identityId) => (
                                                <div
                                                    key={identityId}
                                                    className="context-item"
                                                    onClick={() => connectSFTP(identityId)}>
                                                    <Icon path={mdiAccountCircle} />
                                                    <p>{getIdentityName(identityId)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <div className="context-item" onClick={editServer}>
                        <Icon path={mdiPencil} />
                        <p>Edit Server</p>
                    </div>

                    <div className="context-item" onClick={duplicateServer}>
                        <Icon path={mdiContentCopy} />
                        <p>Duplicate Server</p>
                    </div>

                    <div className="context-item" onClick={deleteServer}>
                        <Icon path={mdiServerMinus} />
                        <p>Delete Server</p>
                    </div>
                </>
            )}

            {type === "pve-object" && (
                <>
                    <div className="context-item" onClick={editPVEServer}>
                        <Icon path={mdiPencil} />
                        <p>Edit PVE</p>
                    </div>
                    <div className="context-item" onClick={deletePVEServer}>
                        <Icon path={mdiServerMinus} />
                        <p>Delete PVE</p>
                    </div>
                </>
            )}

            {server?.status === "running" && (
                <>
                    <div className="context-item" onClick={connect}>
                        <Icon path={mdiConnection} />
                        <p>Connect</p>
                    </div>
                </>
            )}

            {server?.status === "running" && server.type !== "pve-shell" && (
                <>
                    <div
                        className="context-item"
                        onClick={() => postPVEAction("shutdown")}
                    >
                        <Icon path={mdiPower} />
                        <p>Shutdown</p>
                    </div>

                    <div
                        className="context-item"
                        onClick={() => postPVEAction("stop")}
                    >
                        <Icon path={mdiStop} />
                        <p>Stop</p>
                    </div>
                </>
            )}

            {server?.status === "stopped" && (
                <>
                    <div
                        className="context-item"
                        onClick={() => postPVEAction("start")}
                    >
                        <Icon path={mdiPower} />
                        <p>Start</p>
                    </div>
                </>
            )}
        </div>
    );
};
