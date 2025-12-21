import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import {
    mdiStar,
    mdiHistory,
    mdiPower,
    mdiPlay,
    mdiServerNetwork,
    mdiConnection,
    mdiFolderOpen,
    mdiCursorDefaultClick,
} from "@mdi/js";
import { siDiscord } from "simple-icons";
import { DISCORD_URL, GITHUB_URL } from "@/App.jsx";
import { getRequest } from "@/common/utils/RequestUtil";
import { useTranslation } from "react-i18next";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { loadIcon } from "@/pages/Servers/utils/iconMapping.js";

const formatTimeAgo = (timestamp) => {
    const diffMins = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
};

const PROTOCOL_LABELS = {
    "entry.ssh_connect": "SSH", "entry.sftp_connect": "SFTP", "entry.rdp_connect": "RDP",
    "entry.vnc_connect": "VNC", "entry.pve_connect": "PVE",
};

export const WelcomePanel = ({
                                 connectToServer,
                                 hibernatedSessions = [],
                                 resumeSession,
                                 openSFTP,
                                 openDirectConnect,
                             }) => {
    const { user } = useContext(UserContext);
    const { getServerById } = useContext(ServerContext);
    const { t } = useTranslation();
    const [recentConnections, setRecentConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contextItem, setContextItem] = useState(null);
    const contextMenu = useContextMenu();

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
    const quickConnect = () => {
        if (server && openDirectConnect) {
            openDirectConnect(server);
            contextMenu.close();
        }
    };

    return (
        <div className="welcome-panel">
            <div className="welcome-left">
                <h1>Hi, <span>{user?.firstName || "User"} {user?.lastName || ""}</span>!</h1>
                <p>{t("welcome.subtitle", "Welcome to Nexterm. The open-source server manager for SSH, VNC and RDP.")}</p>
                <div className="button-area">
                    <Button text={t("welcome.starOnGitHub", "Star on GitHub")}
                            onClick={() => window.open(GITHUB_URL, "_blank")} icon={mdiStar} />
                    <Button text={t("welcome.joinDiscord", "Join Discord")}
                            onClick={() => window.open(DISCORD_URL, "_blank")} icon={siDiscord.path} />
                </div>
            </div>

            <div className="welcome-right">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner" />
                    </div>
                ) : recentConnections.length > 0 ? (
                    <div className="recent-connections">
                        <div className="section-header">
                            <Icon path={mdiHistory} />
                            <h3>{t("welcome.recentConnections", "Recent Connections")}</h3>
                        </div>
                        <div className="recent-list">
                            {recentConnections.map((item, i) => {
                                const hibernated = getHibernated(item.entryId);
                                return (
                                    <div key={`${item.entryId}-${i}`}
                                         className={`recent-item${hibernated ? " hibernated" : ""}`}
                                         onClick={() => handleClick(item)}
                                         onContextMenu={(e) => handleContextMenu(e, item)}>
                                        <div className="item-icon"><Icon path={loadIcon(item.icon)} /></div>
                                        <div className="item-info">
                                            <span className="item-name">{item.name}</span>
                                            <span className="item-meta">
                                                {hibernated ?
                                                    <span className="hibernated-badge"><Icon path={mdiPower} />Hibernated</span> : formatTimeAgo(item.timestamp)}
                                            </span>
                                        </div>
                                        <div className="item-action">
                                            <span
                                                className="protocol-badge">{PROTOCOL_LABELS[item.connectionType] || "Connect"}</span>
                                            <Icon path={mdiPlay} className="play-icon" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Icon path={mdiServerNetwork} />
                        <h3>{t("welcome.getStarted", "Get Started")}</h3>
                        <p>{t("welcome.getStartedHint", "Add a server from the sidebar to begin managing your infrastructure.")}</p>
                    </div>
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
                        {openDirectConnect && (
                            <ContextMenuItem icon={mdiCursorDefaultClick} label={t("servers.contextMenu.quickConnect")}
                                             onClick={quickConnect} />
                        )}
                    </>
                )}
            </ContextMenu>
        </div>
    );
};