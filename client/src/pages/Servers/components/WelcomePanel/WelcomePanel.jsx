import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { QuickActionContext } from "@/common/contexts/QuickActionContext.jsx";
import { useKeymaps } from "@/common/contexts/KeymapContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import Tooltip from "@/common/components/Tooltip";
import Icon from "@mdi/react";
import EmptyState from "@/common/components/EmptyState";
import { mdiCompassOutline, mdiHistory, mdiPower, mdiPlay, mdiServerNetwork, mdiConnection, mdiFolderOpen, mdiCursorDefaultClick, mdiDownload, mdiLinkVariant, mdiWeb, mdiMagnify, mdiRobotHappyOutline } from "@mdi/js";
import { getRequest } from "@/common/utils/RequestUtil";
import { useTranslation } from "react-i18next";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { getIconPath } from "@/common/utils/iconUtils.js";
import Button from "@/common/components/Button";
import DownloadAppsDialog from "@/common/components/DownloadAppsDialog";
import { DeviceLinkDialog } from "@/common/components/DeviceLinkDialog/DeviceLinkDialog.jsx";
import { getAvatarLabel } from "@/common/utils/avatar.js";
import { useDrop } from "react-dnd";
import { isDemoGuest } from "@/common/utils/demo.js";

const formatTimeAgo = (timestamp) => {
    const diffMins = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
};

const EXPLORE_LIMIT = 5;

const flattenServers = (entries, parent = null, result = []) => {
    for (const entry of entries || []) {
        if (entry.type === "folder" || entry.type === "organization") flattenServers(entry.entries, entry.name, result);
        else if (entry.type === "server") result.push({ ...entry, parentName: parent });
    }
    return result;
};

const ConnectionItem = ({ icon, name, meta, className = "", ...props }) => (
    <div className={`recent-item${className}`} {...props}>
        <div className="item-icon"><Icon path={getIconPath(icon)} /></div>
        <div className="item-info">
            <span className="item-name">{name}</span>
            <span className="item-meta">{meta}</span>
        </div>
        <div className="item-action">
            <Icon path={mdiPlay} className="play-icon" />
        </div>
    </div>
);

const PROTOCOL_LABELS = {
    "entry.ssh_connect": "SSH", "entry.sftp_connect": "SFTP", "entry.rdp_connect": "RDP",
    "entry.vnc_connect": "VNC",
    "entry.demo_connect": "Demo", "entry.pve_connect": "PVE",
};

export const WelcomePanel = ({
                                 connectToServer,
                                 hibernatedSessions = [],
                                 resumeSession,
                                 openSFTP,
                                 openBrowser,
                                 openDirectConnect,
                             }) => {
    const { user } = useContext(UserContext);
    const { servers, getServerById } = useContext(ServerContext);
    const exploreServers = isDemoGuest(user) ? flattenServers(servers).slice(0, EXPLORE_LIMIT) : [];
    const { t } = useTranslation();
    const { open: openQuickAction } = useContext(QuickActionContext);
    const { getKeybind, formatKey } = useKeymaps();
    const quickActionKey = formatKey(getKeybind("quick-action"));
    const { available: aiAvailable, openAssistant } = useAI();
    const aiKey = formatKey(getKeybind("ai-menu"));
    const aiLabel = aiKey ? `${t("servers.aiAssistant.open")} · ${aiKey}` : t("servers.aiAssistant.open");
    const [recentConnections, setRecentConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contextItem, setContextItem] = useState(null);
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [deviceLinkDialogOpen, setDeviceLinkDialogOpen] = useState(false);
    const contextMenu = useContextMenu();

    const [{ isServerOver }, dropRef] = useDrop({
        accept: "server",
        drop: (item) => {
            const droppedServer = getServerById(item.id);
            if (droppedServer) connectToServer(droppedServer.id, droppedServer.identities?.[0]);
            return { handled: true };
        },
        collect: (monitor) => ({ isServerOver: monitor.isOver() }),
    });

    useEffect(() => {
        getRequest("/entries/recent?limit=5").then(data => setRecentConnections(data || [])).catch(() => {
        }).finally(() => setLoading(false));
    }, []);

    const server = contextItem ? getServerById(contextItem.entryId) : null;
    const getHibernated = (entryId) => hibernatedSessions.find(s => s.server?.id === entryId);

    const handleClick = (item) => {
        const hibernated = getHibernated(item.entryId);
        if (hibernated) resumeSession(hibernated.id);
        else connectToServer(item.entryId, item.identities?.[0] ? { id: item.identities[0] } : null);
    };

    const handleContextMenu = (e, item) => {
        e.preventDefault();
        setContextItem(item);
        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    const connect = () => {
        if (server) {
            connectToServer(server.id, server.identities?.[0] ? { id: server.identities[0] } : null);
            contextMenu.close();
        }
    };
    const connectSftp = () => {
        if (server && openSFTP) {
            openSFTP(server.id, server.identities?.[0] ? { id: server.identities[0] } : null);
            contextMenu.close();
        }
    };
    const connectBrowser = () => {
        if (server && openBrowser) {
            openBrowser(server.id, server.identities?.[0] ? { id: server.identities[0] } : null);
            contextMenu.close();
        }
    };
    const quickConnect = () => {
        if (server && openDirectConnect) {
            openDirectConnect(server);
            contextMenu.close();
        }
    };

    return (
        <div className={`welcome-panel${isServerOver ? " drop-target" : ""}`} ref={dropRef}>
            <div className="welcome-left">
                <h1>{t("welcome.hello")}, <span>{getAvatarLabel(user, t("welcome.defaultName"))}</span>!</h1>
                <p>{t("welcome.subtitle")}</p>
                <div className="welcome-buttons">
                    <Button icon={mdiDownload} text={t("welcome.downloadApps")} onClick={() => setDownloadDialogOpen(true)} />
                    <Button icon={mdiLinkVariant} text={t("welcome.connectDevice")} onClick={() => setDeviceLinkDialogOpen(true)} />
                </div>
            </div>

            <div className="welcome-right">
                <div className="welcome-search">
                    <button type="button" className="welcome-search-trigger" onClick={openQuickAction}>
                        <Icon path={mdiMagnify} className="welcome-search-icon" />
                        <span className="welcome-search-placeholder">{t("common.quickAction.placeholder")}</span>
                        {quickActionKey && <kbd>{quickActionKey}</kbd>}
                    </button>
                    {aiAvailable && (
                        <Tooltip text={aiLabel}>
                            <button type="button" className="welcome-search-ai" onClick={() => openAssistant()}
                                    aria-label={t("servers.aiAssistant.open")}>
                                <Icon path={mdiRobotHappyOutline} />
                            </button>
                        </Tooltip>
                    )}
                </div>
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner" />
                    </div>
                ) : recentConnections.length > 0 ? (
                    <div className="recent-connections">
                        <div className="section-header">
                            <Icon path={mdiHistory} />
                            <h3>{t("welcome.recentConnections")}</h3>
                        </div>
                        <div className="recent-list">
                            {recentConnections.map((item, i) => {
                                const hibernated = getHibernated(item.entryId);
                                return (
                                    <ConnectionItem key={`${item.entryId}-${i}`} icon={item.icon} name={item.name}
                                                    className={hibernated ? " hibernated" : ""}
                                                    onClick={() => handleClick(item)}
                                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                                    meta={<>
                                                        {PROTOCOL_LABELS[item.connectionType] && <span className="item-protocol">{PROTOCOL_LABELS[item.connectionType]}</span>}
                                                        {hibernated
                                                            ? <span className="hibernated-badge"><Icon path={mdiPower} />{t("welcome.hibernated")}</span>
                                                            : <span>{formatTimeAgo(item.timestamp)}</span>}
                                                    </>} />
                                );
                            })}
                        </div>
                    </div>
                ) : exploreServers.length > 0 ? (
                    <div className="recent-connections">
                        <div className="section-header">
                            <Icon path={mdiCompassOutline} />
                            <h3>{t("welcome.demo.explore")}</h3>
                        </div>
                        <div className="recent-list">
                            {exploreServers.map(entry => (
                                <ConnectionItem key={entry.id} icon={entry.icon} name={entry.name}
                                                onClick={() => connectToServer(entry.id, entry.identities?.[0] ? { id: entry.identities[0] } : null)}
                                                meta={<>
                                                    {entry.protocol && <span className="item-protocol">{entry.protocol.toUpperCase()}</span>}
                                                    <span>{entry.parentName}</span>
                                                </>} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState icon={mdiServerNetwork} title={t("welcome.getStarted")} description={t("welcome.getStartedHint")} />
                )}
            </div>

            <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={contextMenu.close}
                         trigger={contextMenu.triggerRef}>
                {server && (
                    <>
                        <ContextMenuItem icon={mdiConnection} label={t("servers.contextMenu.connect")}
                                         onClick={connect} />
                        {server.protocol === "ssh" && openSFTP && (
                            <ContextMenuItem icon={mdiFolderOpen} label={t("servers.contextMenu.openSFTP")}
                                             onClick={connectSftp} />
                        )}
                        {server.protocol === "ssh" && openBrowser && (
                            <ContextMenuItem icon={mdiWeb} label={t("servers.contextMenu.openBrowser")}
                                             onClick={connectBrowser} />
                        )}
                        {openDirectConnect && (
                            <ContextMenuItem icon={mdiCursorDefaultClick} label={t("servers.contextMenu.quickConnect")}
                                             onClick={quickConnect} />
                        )}
                    </>
                )}
            </ContextMenu>

            <DownloadAppsDialog open={downloadDialogOpen} onClose={() => setDownloadDialogOpen(false)} />
            <DeviceLinkDialog open={deviceLinkDialogOpen} onClose={() => setDeviceLinkDialogOpen(false)} />
        </div>
    );
};