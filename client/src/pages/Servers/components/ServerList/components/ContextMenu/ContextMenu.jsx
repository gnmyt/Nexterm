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
    mdiImport,
    mdiFileDocumentOutline,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useContext, useState } from "react";
import ProxmoxLogo from "./assets/proxmox.jsx";
import "./styles.sass";
import { useTranslation } from "react-i18next";

export const ContextMenu = ({
    position,
    id,
    type,
    setRenameStateId,
    setServerDialogOpen,
    setCurrentFolderId,
    setEditServerId,
    connectToServer,
    setProxmoxDialogOpen,
    setSSHConfigImportDialogOpen,
    openSFTP,
}) => {
    const { t } = useTranslation();
    const {
        loadServers,
        getServerById,
    } = useContext(ServerContext);

    const { identities } = useContext(IdentityContext);

    const [showIdentitySubmenu, setShowIdentitySubmenu] = useState(false);
    const [showSftpSubmenu, setShowSftpSubmenu] = useState(false);
    const [showImportSubmenu, setShowImportSubmenu] = useState(false);

    const server = id ? type === "server-object" ? getServerById(id) : null : null;

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

    const deleteServer = () => deleteRequest("entries/" + id).then(loadServers);

    const createServer = () => {
        setCurrentFolderId(id);
        setServerDialogOpen();
    };

    const createPVEServer = () => {
        setCurrentFolderId(id);
        setProxmoxDialogOpen();
    };

    const openSSHConfigImport = () => {
        setCurrentFolderId(id);
        setSSHConfigImportDialogOpen();
    };

    const connect = (identityId = null) => {
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
        postRequest("integrations/" + serverType + "/" + id.split("-")[1] + "/" + server?.id + "/" + type)
            .then(loadServers);
    };

    const deletePVEServer = () => {
        deleteRequest("integrations/" + id.split("-")[1]).then(loadServers);
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
                        <p>{t("servers.contextMenu.createFolder")}</p>
                    </div>
                )}
            {type === "folder-object" && !isOrgFolder && (
                <>
                    <div className="context-item" onClick={deleteFolder}>
                        <Icon path={mdiFolderRemove} />
                        <p>{t("servers.contextMenu.deleteFolder")}</p>
                    </div>
                    <div
                        className="context-item"
                        onClick={() => setRenameStateId(id)}
                    >
                        <Icon path={mdiFormTextbox} />
                        <p>{t("servers.contextMenu.renameFolder")}</p>
                    </div>
                    <div className="context-item" onClick={createServer}>
                        <Icon path={mdiServerPlus} />
                        <p>{t("servers.contextMenu.createServer")}</p>
                    </div>
                    <div className="context-item submenu-parent"
                         onMouseEnter={() => setShowImportSubmenu(true)}
                         onMouseLeave={() => setShowImportSubmenu(false)}>
                        <Icon path={mdiImport} />
                        <p>{t("servers.contextMenu.import")}</p>
                        <Icon path={mdiChevronRight} className="submenu-arrow" />

                        {showImportSubmenu && (
                            <div className="submenu">
                                <div className="context-item" onClick={createPVEServer}>
                                    <ProxmoxLogo />
                                    <p>{t("servers.contextMenu.pve")}</p>
                                </div>
                                <div className="context-item" onClick={openSSHConfigImport}>
                                    <Icon path={mdiFileDocumentOutline} />
                                    <p>{t("servers.contextMenu.sshConfig")}</p>
                                </div>
                            </div>
                        )}
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
                                    <p>{t("servers.contextMenu.connect")}</p>
                                </div>
                            ) : (
                                <div className="context-item submenu-parent"
                                     onMouseEnter={() => setShowIdentitySubmenu(true)}
                                     onMouseLeave={() => setShowIdentitySubmenu(false)}>
                                    <Icon path={mdiConnection} />
                                    <p>{t("servers.contextMenu.connect")}</p>
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
                                    <p>{t("servers.contextMenu.openSFTP")}</p>
                                </div>
                            ) : (
                                <div className="context-item submenu-parent"
                                     onMouseEnter={() => setShowSftpSubmenu(true)}
                                     onMouseLeave={() => setShowSftpSubmenu(false)}>
                                    <Icon path={mdiFolderOpen} />
                                    <p>{t("servers.contextMenu.openSFTP")}</p>
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
                        <p>{t("servers.contextMenu.editServer")}</p>
                    </div>

                    <div className="context-item" onClick={duplicateServer}>
                        <Icon path={mdiContentCopy} />
                        <p>{t("servers.contextMenu.duplicateServer")}</p>
                    </div>

                    <div className="context-item" onClick={deleteServer}>
                        <Icon path={mdiServerMinus} />
                        <p>{t("servers.contextMenu.deleteServer")}</p>
                    </div>
                </>
            )}

            {type === "pve-qemu" && (
                <>
                    <div className="context-item" onClick={editPVEServer}>
                        <Icon path={mdiPencil} />
                        <p>{t("servers.contextMenu.editPVE")}</p>
                    </div>
                    <div className="context-item" onClick={deletePVEServer}>
                        <Icon path={mdiServerMinus} />
                        <p>{t("servers.contextMenu.deletePVE")}</p>
                    </div>
                </>
            )}

            {server?.status === "running" && (
                <>
                    <div className="context-item" onClick={connect}>
                        <Icon path={mdiConnection} />
                        <p>{t("servers.contextMenu.connect")}</p>
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
                        <p>{t("servers.contextMenu.shutdown")}</p>
                    </div>

                    <div
                        className="context-item"
                        onClick={() => postPVEAction("stop")}
                    >
                        <Icon path={mdiStop} />
                        <p>{t("servers.contextMenu.stop")}</p>
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
                        <p>{t("servers.contextMenu.start")}</p>
                    </div>
                </>
            )}
        </div>
    );
};
