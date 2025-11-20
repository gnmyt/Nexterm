import { useState, useEffect } from "react";
import "./styles.sass";
import { getRequest } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiChartLine, mdiInformation, mdiHarddisk, mdiNetwork } from "@mdi/js";
import Button from "@/common/components/Button";
import MonitoringChart from "./components/MonitoringChart";
import { useTranslation } from "react-i18next";

export const ServerDetails = ({ server }) => {
    const { t } = useTranslation();
    const [detailData, setDetailData] = useState(null);
    const [timeRange, setTimeRange] = useState("1h");
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    const loadDetailData = async () => {
        try {
            setLoading(true);
            const detailResponse = await getRequest(`monitoring/${server.id}?timeRange=${timeRange}`);

            setDetailData(detailResponse);
        } catch (error) {
            console.error("Error loading server details:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetailData();

        const interval = setInterval(loadDetailData, 60000);
        return () => clearInterval(interval);
    }, [server.id, timeRange]);

    const formatUptime = (seconds) => {
        if (!seconds) return t('monitoring.details.overview.systemInfo.unknown');

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return t('monitoring.details.overview.uptime.format.full', { days, hours, minutes });
        } else if (hours > 0) {
            return t('monitoring.details.overview.uptime.format.hoursMinutes', { hours, minutes });
        } else {
            return t('monitoring.details.overview.uptime.format.minutes', { minutes });
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getLatestData = () => {
        if (detailData?.latest) return detailData.latest;
        if (detailData?.data && detailData.data.length > 0) return detailData.data[0];
        return null;
    };

    const latestData = getLatestData();

    if (loading) {
        return (
            <div className="server-details loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="server-details">
            <div className="details-header">
                <div className="time-range-selector">
                    {["1h", "6h", "24h"].map(range => (
                        <Button key={range} text={t(`monitoring.details.timeRanges.${range}`)} 
                                type={timeRange === range ? "primary" : "secondary"}
                                onClick={() => setTimeRange(range)} />
                    ))}
                </div>
            </div>

            <div className="details-tabs">
                <div className="tab-headers">
                    <div className={`tab-header ${activeTab === "overview" ? "active" : ""}`}
                         onClick={() => setActiveTab("overview")}>
                        <Icon path={mdiInformation} />
                        <span>{t('monitoring.details.tabs.overview')}</span>
                    </div>
                    <div className={`tab-header ${activeTab === "charts" ? "active" : ""}`}
                         onClick={() => setActiveTab("charts")}>
                        <Icon path={mdiChartLine} />
                        <span>{t('monitoring.details.tabs.charts')}</span>
                    </div>
                    <div className={`tab-header ${activeTab === "storage" ? "active" : ""}`}
                         onClick={() => setActiveTab("storage")}>
                        <Icon path={mdiHarddisk} />
                        <span>{t('monitoring.details.tabs.storage')}</span>
                    </div>
                    <div className={`tab-header ${activeTab === "network" ? "active" : ""}`}
                         onClick={() => setActiveTab("network")}>
                        <Icon path={mdiNetwork} />
                        <span>{t('monitoring.details.tabs.network')}</span>
                    </div>
                </div>

                <div className="tab-content">
                    {activeTab === "overview" && (
                        <div className="overview-tab">
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <h3>{t('monitoring.details.overview.systemInfo.title')}</h3>
                                    {latestData?.osInfo ? (
                                        <div className="info-list">
                                            <div className="info-item">
                                                <span className="label">{t('monitoring.details.overview.systemInfo.os')}:</span>
                                                <span className="value">{latestData.osInfo.name || t('monitoring.details.overview.systemInfo.unknown')}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="label">{t('monitoring.details.overview.systemInfo.version')}:</span>
                                                <span className="value">{latestData.osInfo.version || t('monitoring.details.overview.systemInfo.unknown')}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="label">{t('monitoring.details.overview.systemInfo.kernel')}:</span>
                                                <span className="value">{latestData.osInfo.kernel || t('monitoring.details.overview.systemInfo.unknown')}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="label">{t('monitoring.details.overview.systemInfo.architecture')}:</span>
                                                <span className="value">{latestData.osInfo.architecture || t('monitoring.details.overview.systemInfo.unknown')}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="label">{t('monitoring.details.overview.systemInfo.uptime')}:</span>
                                                <span className="value">{formatUptime(latestData.uptime)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="no-data">{t('monitoring.details.overview.systemInfo.noData')}</p>
                                    )}
                                </div>

                                <div className="stat-card">
                                    <h3>{t('monitoring.details.overview.performance.title')}</h3>
                                    <div className="metrics-grid">
                                        <div className="metric">
                                            <div className="metric-label">{t('monitoring.details.overview.performance.cpuUsage')}</div>
                                            <div className="metric-value">
                                                {latestData && latestData.cpuUsage !== null ? `${latestData.cpuUsage}%` : "N/A"}
                                            </div>
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{t('monitoring.details.overview.performance.memoryUsage')}</div>
                                            <div className="metric-value">
                                                {latestData && latestData.memoryUsage !== null ? `${latestData.memoryUsage}%` : "N/A"}
                                            </div>
                                            {latestData?.memoryTotal && (
                                                <div className="metric-total">
                                                    {t('monitoring.details.overview.performance.total', { value: formatBytes(latestData.memoryTotal) })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{t('monitoring.details.overview.performance.loadAverage')}</div>
                                            <div className="metric-value">
                                                {latestData?.loadAverage &&
                                                Array.isArray(latestData.loadAverage) &&
                                                latestData.loadAverage.length > 0 &&
                                                typeof latestData.loadAverage[0] === "number" ?
                                                    `${latestData.loadAverage[0].toFixed(2)}` : "N/A"
                                                }
                                            </div>
                                            {latestData?.loadAverage &&
                                                Array.isArray(latestData.loadAverage) &&
                                                latestData.loadAverage.length >= 3 &&
                                                typeof latestData.loadAverage[1] === "number" &&
                                                typeof latestData.loadAverage[2] === "number" && (
                                                    <div className="metric-detail">
                                                        {t('monitoring.details.overview.performance.loadDetail', { 
                                                            fiveMin: latestData.loadAverage[1].toFixed(2), 
                                                            fifteenMin: latestData.loadAverage[2].toFixed(2) 
                                                        })}
                                                    </div>
                                                )}
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{t('monitoring.details.overview.performance.processes')}</div>
                                            <div className="metric-value">
                                                {latestData?.processes || "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "charts" && (
                        <div className="charts-tab">
                            <div className="charts-grid">
                                <MonitoringChart
                                    data={detailData?.data || []}
                                    title={t('monitoring.details.charts.cpuUsage')}
                                    type="cpu"
                                    color="#314BD3"
                                    unit="%"
                                    yAxisMax={100}
                                    height="300px"
                                />
                                <MonitoringChart
                                    data={detailData?.data || []}
                                    title={t('monitoring.details.charts.memoryUsage')}
                                    type="memory"
                                    color="#29C16A"
                                    unit="%"
                                    yAxisMax={100}
                                    height="300px"
                                />
                                <MonitoringChart
                                    data={detailData?.data || []}
                                    title={t('monitoring.details.charts.processes')}
                                    type="processes"
                                    color="#DC5600"
                                    unit=""
                                    height="300px"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === "storage" && (
                        <div className="storage-tab">
                            <div className="stat-card full-width">
                                <h3>{t('monitoring.details.storage.title')}</h3>
                                {latestData?.disk && latestData.disk.length > 0 ? (
                                    <div className="disk-list">
                                        {latestData.disk.map((disk, index) => (
                                            <div key={index} className="disk-item">
                                                <div className="disk-header">
                                                    <span className="disk-name">{disk.filesystem}</span>
                                                    <span className="disk-mount">{disk.mountPoint}</span>
                                                    <span className="disk-usage">{disk.usagePercent}%</span>
                                                </div>
                                                <div className="disk-bar">
                                                    <div
                                                        className="disk-fill"
                                                        style={{ width: `${disk.usagePercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="disk-details">
                                                    <span>{t('monitoring.details.storage.used', { value: disk.used })}</span>
                                                    <span>{t('monitoring.details.storage.available', { value: disk.available })}</span>
                                                    <span>{t('monitoring.details.storage.total', { value: disk.size })}</span>
                                                    <span>{t('monitoring.details.storage.type', { value: disk.type })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="no-data">{t('monitoring.details.storage.noData')}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "network" && (
                        <div className="network-tab">
                            <div className="stat-card full-width">
                                <h3>{t('monitoring.details.network.title')}</h3>
                                {latestData?.network && latestData.network.length > 0 ? (
                                    <div className="network-list">
                                        {latestData.network.map((iface, index) => (
                                            <div key={index} className="network-item">
                                                <div className="network-header">
                                                    <span className="network-name">{iface.name}</span>
                                                </div>
                                                <div className="network-stats">
                                                    <div className="network-stat">
                                                        <span className="label">{t('monitoring.details.network.rxBytes')}:</span>
                                                        <span className="value">{formatBytes(iface.rxBytes)}</span>
                                                    </div>
                                                    <div className="network-stat">
                                                        <span className="label">{t('monitoring.details.network.txBytes')}:</span>
                                                        <span className="value">{formatBytes(iface.txBytes)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="no-data">{t('monitoring.details.network.noData')}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
