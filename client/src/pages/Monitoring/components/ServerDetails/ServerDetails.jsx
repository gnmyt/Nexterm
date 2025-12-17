import { useState, useEffect, useCallback, useMemo } from "react";
import "./styles.sass";
import { getRequest } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiChartLine, mdiInformation, mdiHarddisk, mdiNetwork, mdiConsole } from "@mdi/js";
import Button from "@/common/components/Button";
import MonitoringChart from "./components/MonitoringChart";
import ProcessesTab from "./components/ProcessesTab";
import { useTranslation } from "react-i18next";

const TABS = [
    { id: "overview", icon: mdiInformation, labelKey: "monitoring.details.tabs.overview" },
    { id: "charts", icon: mdiChartLine, labelKey: "monitoring.details.tabs.charts" },
    { id: "storage", icon: mdiHarddisk, labelKey: "monitoring.details.tabs.storage" },
    { id: "network", icon: mdiNetwork, labelKey: "monitoring.details.tabs.network" },
    { id: "processes", icon: mdiConsole, labelKey: "monitoring.details.tabs.processes" },
];

const TIME_RANGES = ["1h", "6h", "24h"];

const formatUptime = (seconds, t) => {
    if (!seconds) return t("monitoring.details.overview.systemInfo.unknown");
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return t("monitoring.details.overview.uptime.format.full", { days, hours, minutes });
    if (hours > 0) return t("monitoring.details.overview.uptime.format.hoursMinutes", { hours, minutes });
    return t("monitoring.details.overview.uptime.format.minutes", { minutes });
};

const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const ServerDetails = ({ server, activeTab = "overview", onTabChange }) => {
    const { t } = useTranslation();
    const [detailData, setDetailData] = useState(null);
    const [timeRange, setTimeRange] = useState("1h");

    const loadDetailData = useCallback(async () => {
        try {
            const response = await getRequest(`monitoring/${server.id}?timeRange=${timeRange}`);
            setDetailData(response);
        } catch (error) {
            console.error("Error loading server details:", error);
        }
    }, [server.id, timeRange]);

    useEffect(() => {
        loadDetailData();
        const interval = setInterval(loadDetailData, 60000);
        return () => clearInterval(interval);
    }, [loadDetailData]);

    const latestData = useMemo(() => {
        if (detailData?.latest) return detailData.latest;
        if (detailData?.data?.length > 0) return detailData.data[0];
        return null;
    }, [detailData]);

    return (
        <div className="server-details">
            <div className="details-tabs">
                <div className="tab-headers">
                    {TABS.map(tab => (
                        <div key={tab.id} className={`tab-header ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => onTabChange?.(tab.id)}>
                            <Icon path={tab.icon} />
                            <span>{t(tab.labelKey)}</span>
                        </div>
                    ))}
                    {activeTab === "charts" && (
                        <div className="time-range-selector">
                            {TIME_RANGES.map(range => (
                                <Button key={range} text={t(`monitoring.details.timeRanges.${range}`)}
                                    type={timeRange === range ? "primary" : "secondary"}
                                    onClick={() => setTimeRange(range)} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="tab-content">
                    {activeTab === "overview" && <OverviewTab latestData={latestData} t={t} />}
                    {activeTab === "charts" && <ChartsTab data={detailData?.data} t={t} />}
                    {activeTab === "storage" && <StorageTab disk={latestData?.disk} t={t} />}
                    {activeTab === "network" && <NetworkTab network={latestData?.network} t={t} />}
                    {activeTab === "processes" && <ProcessesTab processList={latestData?.processList} />}
                </div>
            </div>
        </div>
    );
};

const OverviewTab = ({ latestData, t }) => (
    <div className="overview-tab">
        <div className="stats-grid">
            <div className="stat-card">
                <h3>{t("monitoring.details.overview.systemInfo.title")}</h3>
                {latestData?.osInfo ? (
                    <div className="info-list">
                        {[
                            { label: "hostname", value: latestData.osInfo.hostname },
                            { label: "os", value: latestData.osInfo.name },
                            { label: "version", value: latestData.osInfo.version },
                            { label: "kernel", value: latestData.osInfo.kernel },
                            { label: "architecture", value: latestData.osInfo.architecture },
                            { label: "uptime", value: formatUptime(latestData.uptime, t) },
                        ].map(item => (
                            <div key={item.label} className="info-item">
                                <span className="label">{t(`monitoring.details.overview.systemInfo.${item.label}`)}:</span>
                                <span className="value">{item.value || t("monitoring.details.overview.systemInfo.unknown")}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-data">{t("monitoring.details.overview.systemInfo.noData")}</p>
                )}
            </div>
            <div className="stat-card">
                <h3>{t("monitoring.details.overview.performance.title")}</h3>
                <div className="metrics-grid">
                    <MetricItem label={t("monitoring.details.overview.performance.cpuUsage")}
                        value={latestData?.cpuUsage != null ? `${latestData.cpuUsage}%` : "N/A"} />
                    <MetricItem label={t("monitoring.details.overview.performance.memoryUsage")}
                        value={latestData?.memoryUsage != null ? `${latestData.memoryUsage}%` : "N/A"}
                        detail={latestData?.memoryTotal ? t("monitoring.details.overview.performance.total", { value: formatBytes(latestData.memoryTotal) }) : null} />
                    <MetricItem label={t("monitoring.details.overview.performance.loadAverage")}
                        value={latestData?.loadAverage?.[0]?.toFixed(2) || "N/A"}
                        detail={latestData?.loadAverage?.length >= 3 ? t("monitoring.details.overview.performance.loadDetail", {
                            fiveMin: latestData.loadAverage[1].toFixed(2),
                            fifteenMin: latestData.loadAverage[2].toFixed(2)
                        }) : null} />
                    <MetricItem label={t("monitoring.details.overview.performance.processes")}
                        value={latestData?.processes ?? "N/A"} />
                </div>
            </div>
        </div>
    </div>
);

const MetricItem = ({ label, value, detail }) => (
    <div className="metric">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {detail && <div className="metric-detail">{detail}</div>}
    </div>
);

const ChartsTab = ({ data, t }) => (
    <div className="charts-tab">
        <div className="charts-grid">
            <MonitoringChart data={data || []} title={t("monitoring.details.charts.cpuUsage")}
                type="cpu" color="#314BD3" unit="%" yAxisMax={100} height="300px" />
            <MonitoringChart data={data || []} title={t("monitoring.details.charts.memoryUsage")}
                type="memory" color="#29C16A" unit="%" yAxisMax={100} height="300px" />
            <MonitoringChart data={data || []} title={t("monitoring.details.charts.processes")}
                type="processes" color="#DC5600" unit="" height="300px" />
        </div>
    </div>
);

const StorageTab = ({ disk, t }) => (
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
                                        <div className="partition-bar">
                                            <div className="partition-fill" style={{ width: `${p.usagePercent}%` }}></div>
                                        </div>
                                        <div className="partition-details">
                                            <span>{t("monitoring.details.storage.used", { value: formatBytes(p.used) })}</span>
                                            <span>{t("monitoring.details.storage.available", { value: formatBytes(p.available) })}</span>
                                            <span>{t("monitoring.details.storage.total", { value: formatBytes(p.size) })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-partitions">{t("monitoring.details.storage.noPartitions")}</p>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="stat-card full-width">
                <p className="no-data">{t("monitoring.details.storage.noData")}</p>
            </div>
        )}
    </div>
);

const NetworkTab = ({ network, t }) => (
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
            ) : (
                <p className="no-data">{t("monitoring.details.network.noData")}</p>
            )}
        </div>
    </div>
);
