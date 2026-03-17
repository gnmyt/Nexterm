import Icon from "@mdi/react";
import { mdiServerOff, mdiAlertCircle, mdiClockOutline, mdiServerNetwork } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { getIconPath } from "@/common/utils/iconUtils.js";

const STATUS_ICONS = { offline: mdiServerOff, error: mdiAlertCircle, unknown: mdiClockOutline };

export const MonitoringGrid = ({ servers, onServerSelect }) => {
    const { t } = useTranslation();

    const formatUptime = (seconds) => {
        if (!seconds) return t("monitoring.grid.uptime.unknown");
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return t("monitoring.grid.uptime.format.days", { days, hours, minutes });
        if (hours > 0) return t("monitoring.grid.uptime.format.hours", { hours, minutes });
        return t("monitoring.grid.uptime.format.minutes", { minutes });
    };

    if (!servers?.length) {
        return (
            <div className="monitoring-grid empty">
                <div className="no-servers">
                    <Icon path={mdiServerOff} />
                    <h2>{t("monitoring.grid.noServers.title")}</h2>
                    <p>{t("monitoring.grid.noServers.subtitle")}</p>
                </div>
            </div>
        );
    }

    const getServerIcon = (server) => {
        if (server.type === "proxmox") return mdiServerNetwork;
        return getIconPath(server.icon);
    };

    const getMetrics = (server) => {
        const isPVE = server.type === "proxmox";
        const pveInfo = server.monitoring?.osInfo;
        
        if (isPVE) {
            return [
                { key: "cpuUsage", val: server.monitoring?.cpuUsage, unit: "%" },
                { key: "memoryUsage", val: server.monitoring?.memoryUsage, unit: "%" },
                { key: "nodes", val: pveInfo?.onlineNodes != null ? `${pveInfo.onlineNodes}/${pveInfo.totalNodes}` : null, unit: "" },
                { key: "vms", val: pveInfo ? `${pveInfo.runningVMs + pveInfo.runningLXC}/${pveInfo.vmCount + pveInfo.lxcCount}` : null, unit: "" },
            ];
        }
        return [
            { key: "cpuUsage", val: server.monitoring?.cpuUsage, unit: "%" },
            { key: "memoryUsage", val: server.monitoring?.memoryUsage, unit: "%" },
            { key: "loadAverage", val: server.monitoring?.loadAverage?.[0]?.toFixed(2), unit: "" },
            { key: "processes", val: server.monitoring?.processes, unit: "" },
        ];
    };

    return (
        <div className="monitoring-grid">
            {servers.map(server => (
                <div key={server.id} className={`server-card ${server.type === "proxmox" ? "pve" : ""}`} onClick={() => onServerSelect(server)}>
                    <div className={`status-indicator ${server.monitoring?.status || "unknown"}`}></div>
                    <div className="server-header">
                        <div className="server-icon">
                            <Icon path={getServerIcon(server)} />
                        </div>
                        <div className="server-info">
                            <h3>{server.name}</h3>
                            <p>{server.ip}:{server.port}</p>
                        </div>
                    </div>
                    {server.status === "online" ? (
                        <>
                            <div className="metrics">
                                {getMetrics(server).map(m => (
                                    <div key={m.key} className="metric">
                                        <div className="metric-label">{t(`monitoring.grid.metrics.${m.key}`)}</div>
                                        <div className="metric-value">{m.val != null ? `${m.val}${m.unit}` : "N/A"}</div>
                                    </div>
                                ))}
                            </div>
                            {server.monitoring?.uptime && (
                                <div className="uptime-info">{t("monitoring.grid.metrics.uptime")}: {formatUptime(server.monitoring.uptime)}</div>
                            )}
                        </>
                    ) : (
                        <div className="offline-state">
                            <div className="offline-icon">
                                <Icon path={STATUS_ICONS[server.status] || mdiClockOutline} />
                            </div>
                            <div className="offline-info">
                                <h4>{t(`monitoring.grid.status.${server.status === "offline" ? "serverOffline" : server.status === "error" ? "connectionError" : "statusUnknown"}`)}</h4>
                                <p>{server.status === "error" ? (server.monitoring?.errorMessage || t("monitoring.grid.status.errorMessage")) : t(`monitoring.grid.status.${server.status === "offline" ? "offlineMessage" : "unknownMessage"}`)}</p>
                                <div className="offline-actions">
                                    <span className="last-seen">
                                        {server.monitoring?.lastSeen ? t("monitoring.grid.status.lastSeen", { time: new Date(server.monitoring.lastSeen).toLocaleString() }) : t("monitoring.grid.status.noRecentActivity")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
