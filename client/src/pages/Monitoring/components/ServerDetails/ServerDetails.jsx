import { useState, useEffect, useCallback, useMemo } from "react";
import "./styles.sass";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { mdiChartLine, mdiInformation, mdiHarddisk, mdiNetwork, mdiConsole, mdiServerNetwork } from "@mdi/js";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import MonitoringChart from "./components/MonitoringChart";
import ProcessesTab from "./components/ProcessesTab";
import { useTranslation } from "react-i18next";

const TABS = {
    server: [
        { id: "overview", icon: mdiInformation, labelKey: "monitoring.details.tabs.overview" },
        { id: "charts", icon: mdiChartLine, labelKey: "monitoring.details.tabs.charts" },
        { id: "storage", icon: mdiHarddisk, labelKey: "monitoring.details.tabs.storage" },
        { id: "network", icon: mdiNetwork, labelKey: "monitoring.details.tabs.network" },
        { id: "processes", icon: mdiConsole, labelKey: "monitoring.details.tabs.processes" },
    ],
    pve: [
        { id: "overview", icon: mdiInformation, labelKey: "monitoring.details.tabs.overview" },
        { id: "charts", icon: mdiChartLine, labelKey: "monitoring.details.tabs.charts" },
        { id: "nodes", icon: mdiServerNetwork, labelKey: "monitoring.details.tabs.nodes" },
    ],
};

const formatUptime = (seconds, t) => {
    if (!seconds) return t("monitoring.details.overview.systemInfo.unknown");
    const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
    return d > 0 ? t("monitoring.details.overview.uptime.format.full", { days: d, hours: h, minutes: m })
        : h > 0 ? t("monitoring.details.overview.uptime.format.hoursMinutes", { hours: h, minutes: m })
        : t("monitoring.details.overview.uptime.format.minutes", { minutes: m });
};

const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${["B", "KB", "MB", "GB", "TB"][i]}`;
};

const MetricItem = ({ label, value, detail }) => (
    <div className="metric">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {detail && <div className="metric-detail">{detail}</div>}
    </div>
);

const InfoItem = ({ label, value }) => (
    <div className="info-item"><span className="label">{label}:</span><span className="value">{value}</span></div>
);

export const ServerDetails = ({ server, activeTab = "overview", onTabChange }) => {
    const { t } = useTranslation();
    const [detailData, setDetailData] = useState(null);
    const [timeRange, setTimeRange] = useState("1h");
    const isPVE = server.type === "proxmox" || server.integrationId;
    const tabs = TABS[isPVE ? "pve" : "server"];

    const loadDetailData = useCallback(async () => {
        try {
            const endpoint = isPVE ? `monitoring/integration/${server.integrationId}` : `monitoring/${server.id}`;
            setDetailData(await getRequest(`${endpoint}?timeRange=${timeRange}`));
        } catch (e) { console.error("Error loading server details:", e); }
    }, [server.id, server.integrationId, isPVE, timeRange]);

    useEffect(() => { loadDetailData(); const i = setInterval(loadDetailData, 60000); return () => clearInterval(i); }, [loadDetailData]);

    const latest = useMemo(() => detailData?.latest || detailData?.data?.[0] || null, [detailData]);
    const validTab = tabs.some(t => t.id === activeTab) ? activeTab : "overview";

    const tabSwitcherTabs = useMemo(() => tabs.map(tab => ({
        key: tab.id,
        label: t(tab.labelKey),
        icon: tab.icon
    })), [tabs, t]);

    return (
        <div className="server-details">
            <div className="details-tabs">
                <div className="tab-headers">
                    <TabSwitcher
                        tabs={tabSwitcherTabs}
                        activeTab={validTab}
                        onTabChange={(tabKey) => onTabChange?.(tabKey)}
                        variant="flat"
                    />
                    {validTab === "charts" && (
                        <div className="time-range-selector">
                            {["1h", "6h", "24h"].map(r => <Button key={r} text={t(`monitoring.details.timeRanges.${r}`)} type={timeRange === r ? "primary" : "secondary"} onClick={() => setTimeRange(r)} />)}
                        </div>
                    )}
                </div>
                <div className="tab-content">
                    {validTab === "overview" && (isPVE ? <PVEOverviewTab latest={latest} t={t} formatBytes={formatBytes} formatUptime={formatUptime} /> : <OverviewTab latest={latest} t={t} formatBytes={formatBytes} formatUptime={formatUptime} />)}
                    {validTab === "charts" && <ChartsTab data={detailData?.data} t={t} isPVE={isPVE} />}
                    {validTab === "nodes" && isPVE && <NodesTab pveInfo={latest?.osInfo} t={t} formatBytes={formatBytes} formatUptime={formatUptime} />}
                    {validTab === "storage" && !isPVE && <StorageTab disk={latest?.disk} t={t} formatBytes={formatBytes} />}
                    {validTab === "network" && !isPVE && <NetworkTab network={latest?.network} t={t} formatBytes={formatBytes} />}
                    {validTab === "processes" && !isPVE && <ProcessesTab processList={latest?.processList} />}
                </div>
            </div>
        </div>
    );
};

const OverviewTab = ({ latest, t, formatBytes, formatUptime }) => (
    <div className="overview-tab">
        <div className="stats-grid">
            <div className="stat-card">
                <h3>{t("monitoring.details.overview.systemInfo.title")}</h3>
                {latest?.osInfo ? (
                    <div className="info-list">
                        {["hostname", "name", "version", "kernel", "architecture"].map(k => <InfoItem key={k} label={t(`monitoring.details.overview.systemInfo.${k === "name" ? "os" : k}`)} value={latest.osInfo[k] || t("monitoring.details.overview.systemInfo.unknown")} />)}
                        <InfoItem label={t("monitoring.details.overview.systemInfo.uptime")} value={formatUptime(latest.uptime, t)} />
                    </div>
                ) : <p className="no-data">{t("monitoring.details.overview.systemInfo.noData")}</p>}
            </div>
            <div className="stat-card">
                <h3>{t("monitoring.details.overview.performance.title")}</h3>
                <div className="metrics-grid">
                    <MetricItem label={t("monitoring.details.overview.performance.cpuUsage")} value={latest?.cpuUsage != null ? `${latest.cpuUsage}%` : "N/A"} />
                    <MetricItem label={t("monitoring.details.overview.performance.memoryUsage")} value={latest?.memoryUsage != null ? `${latest.memoryUsage}%` : "N/A"} detail={latest?.memoryTotal ? t("monitoring.details.overview.performance.total", { value: formatBytes(latest.memoryTotal) }) : null} />
                    <MetricItem label={t("monitoring.details.overview.performance.loadAverage")} value={latest?.loadAverage?.[0]?.toFixed(2) || "N/A"} detail={latest?.loadAverage?.length >= 3 ? t("monitoring.details.overview.performance.loadDetail", { fiveMin: latest.loadAverage[1].toFixed(2), fifteenMin: latest.loadAverage[2].toFixed(2) }) : null} />
                    <MetricItem label={t("monitoring.details.overview.performance.processes")} value={latest?.processes ?? "N/A"} />
                </div>
            </div>
        </div>
    </div>
);

const PVEOverviewTab = ({ latest, t, formatBytes, formatUptime }) => {
    const p = latest?.osInfo;
    return (
        <div className="overview-tab">
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>{t("monitoring.details.pve.clusterInfo")}</h3>
                    <div className="info-list">
                        <InfoItem label={t("monitoring.details.pve.totalNodes")} value={p?.totalNodes || 0} />
                        <InfoItem label={t("monitoring.details.pve.onlineNodes")} value={p?.onlineNodes || 0} />
                        <InfoItem label={t("monitoring.details.pve.totalCPU")} value={`${p?.totalCpu || 0} ${t("monitoring.details.pve.cores")}`} />
                        <InfoItem label={t("monitoring.details.pve.totalMemory")} value={formatBytes(p?.totalMemory)} />
                        <InfoItem label={t("monitoring.details.pve.totalStorage")} value={formatBytes(p?.totalDisk)} />
                        <InfoItem label={t("monitoring.details.pve.uptime")} value={formatUptime(latest?.uptime, t)} />
                    </div>
                </div>
                <div className="stat-card">
                    <h3>{t("monitoring.details.pve.resources")}</h3>
                    <div className="metrics-grid">
                        <MetricItem label={t("monitoring.details.overview.performance.cpuUsage")} value={latest?.cpuUsage != null ? `${latest.cpuUsage}%` : "N/A"} />
                        <MetricItem label={t("monitoring.details.overview.performance.memoryUsage")} value={latest?.memoryUsage != null ? `${latest.memoryUsage}%` : "N/A"} detail={latest?.memoryTotal ? t("monitoring.details.overview.performance.total", { value: formatBytes(latest.memoryTotal) }) : null} />
                        <MetricItem label={t("monitoring.details.pve.storageUsage")} value={p?.diskUsage != null ? `${p.diskUsage}%` : "N/A"} detail={p?.totalDisk ? t("monitoring.details.overview.performance.total", { value: formatBytes(p.totalDisk) }) : null} />
                    </div>
                </div>
                <div className="stat-card">
                    <h3>{t("monitoring.details.pve.virtualMachines")}</h3>
                    <div className="metrics-grid">
                        <MetricItem label={t("monitoring.details.pve.qemuVMs")} value={p?.vmCount ?? 0} detail={t("monitoring.details.pve.running", { count: p?.runningVMs ?? 0 })} />
                        <MetricItem label={t("monitoring.details.pve.lxcContainers")} value={p?.lxcCount ?? 0} detail={t("monitoring.details.pve.running", { count: p?.runningLXC ?? 0 })} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const NodesTab = ({ pveInfo, t, formatBytes, formatUptime }) => (
    <div className="nodes-tab">
        {pveInfo?.nodes?.length > 0 ? (
            <div className="nodes-list">
                {pveInfo.nodes.map((n, i) => (
                    <div key={i} className="stat-card full-width node-card">
                        <div className="node-header"><span className="node-name">{n.name}</span><span className={`node-status ${n.status}`}>{n.status}</span></div>
                        {n.status === "online" ? (
                            <>
                                <div className="node-metrics">
                                    {[{ k: "cpu", v: n.cpuUsage }, { k: "memory", v: n.memoryUsage, d: `${formatBytes(n.memoryUsed)} / ${formatBytes(n.memory)}` }, { k: "storage", v: n.diskUsage, d: `${formatBytes(n.diskUsed)} / ${formatBytes(n.disk)}` }].map(m => (
                                        <div key={m.k} className="node-metric">
                                            <span className="metric-label">{t(`monitoring.details.pve.${m.k}`)}</span>
                                            <div className="metric-bar"><div className={`metric-fill ${m.k}`} style={{ width: `${m.v}%` }}></div></div>
                                            <span className="metric-value">{m.v}%{m.d ? ` (${m.d})` : ""}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="node-details"><span>{t("monitoring.details.pve.cores")}: {n.cpu}</span><span>{t("monitoring.details.pve.uptime")}: {formatUptime(n.uptime, t)}</span></div>
                            </>
                        ) : <p className="node-offline">{t("monitoring.details.pve.nodeOffline")}</p>}
                    </div>
                ))}
            </div>
        ) : <div className="stat-card full-width"><p className="no-data">{t("monitoring.details.pve.noNodes")}</p></div>}
    </div>
);

const ChartsTab = ({ data, t, isPVE }) => (
    <div className="charts-tab">
        <div className="charts-grid">
            <MonitoringChart data={data || []} title={t("monitoring.details.charts.cpuUsage")} type="cpu" color="#314BD3" unit="%" yAxisMax={100} height="300px" />
            <MonitoringChart data={data || []} title={t("monitoring.details.charts.memoryUsage")} type="memory" color="#29C16A" unit="%" yAxisMax={100} height="300px" />
            <MonitoringChart data={data || []} title={t(isPVE ? "monitoring.details.pve.vmContainerCount" : "monitoring.details.charts.processes")} type="processes" color="#DC5600" unit="" height="300px" />
        </div>
    </div>
);

const StorageTab = ({ disk, t, formatBytes }) => (
    <div className="storage-tab">
        {disk?.length > 0 ? (
            <div className="disk-list">
                {disk.map((d, i) => (
                    <div key={i} className="stat-card full-width disk-card">
                        <div className="disk-header">
                            <div className="disk-info">
                                <span className="disk-name">/dev/{d.name}</span>
                                {d.model && <span className="disk-model">{d.model}</span>}
                                <span className={`disk-type ${d.rotational ? "hdd" : "ssd"}`}>{d.rotational ? "HDD" : "SSD"}</span>
                            </div>
                            <span className="disk-size">{formatBytes(d.size)}</span>
                        </div>
                        {d.partitions?.length > 0 ? (
                            <div className="partition-list">
                                {d.partitions.map((p, j) => (
                                    <div key={j} className="partition-item">
                                        <div className="partition-header">
                                            <span className="partition-name">{p.name}</span>
                                            {p.mountPoint && <span className="partition-mount">{p.mountPoint}</span>}
                                            {p.type && <span className="partition-type">{p.type}</span>}
                                            <span className="partition-usage">{p.usagePercent}%</span>
                                        </div>
                                        <div className="partition-bar"><div className="partition-fill" style={{ width: `${p.usagePercent}%` }}></div></div>
                                        <div className="partition-details">
                                            <span>{t("monitoring.details.storage.used", { value: formatBytes(p.used) })}</span>
                                            <span>{t("monitoring.details.storage.available", { value: formatBytes(p.available) })}</span>
                                            <span>{t("monitoring.details.storage.total", { value: formatBytes(p.size) })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="no-partitions">{t("monitoring.details.storage.noPartitions")}</p>}
                    </div>
                ))}
            </div>
        ) : <div className="stat-card full-width"><p className="no-data">{t("monitoring.details.storage.noData")}</p></div>}
    </div>
);

const NetworkTab = ({ network, t, formatBytes }) => (
    <div className="network-tab">
        <div className="stat-card full-width">
            <h3>{t("monitoring.details.network.title")}</h3>
            {network?.length > 0 ? (
                <div className="network-list">
                    {network.map((iface, i) => (
                        <div key={i} className="network-item">
                            <div className="network-header">
                                <span className="network-name">{iface.name}</span>
                                {iface.mac && <span className="network-mac">{iface.mac}</span>}
                                {iface.state && <span className={`network-state ${iface.state}`}>{iface.state}</span>}
                            </div>
                            <div className="network-addresses">
                                {iface.ipv4?.map((ip, j) => <span key={`v4-${j}`} className="ip-badge ipv4">{ip}</span>)}
                                {iface.ipv6?.map((ip, j) => <span key={`v6-${j}`} className="ip-badge ipv6">{ip}</span>)}
                            </div>
                            <div className="network-details">
                                <span>{t("monitoring.details.network.rxBytes")}: {formatBytes(iface.rxBytes)}</span>
                                <span>{t("monitoring.details.network.txBytes")}: {formatBytes(iface.txBytes)}</span>
                                {iface.speed && <span>{t("monitoring.details.network.speed")}: {iface.speed} Mbps</span>}
                                {iface.mtu && <span>MTU: {iface.mtu}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <p className="no-data">{t("monitoring.details.network.noData")}</p>}
        </div>
    </div>
);
