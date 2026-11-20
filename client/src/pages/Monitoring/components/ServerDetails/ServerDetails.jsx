import { useState, useEffect, useCallback, useMemo } from "react";
import "./styles.sass";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { formatBytes } from "@/common/utils/formatUtils.js";
import { mdiChartLine, mdiConsole, mdiHarddisk, mdiInformationOutline, mdiNetworkOutline, mdiServerNetwork, mdiClose } from "@mdi/js";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import EmptyState from "@/common/components/EmptyState";
import MonitoringChart from "./components/MonitoringChart";
import ProcessesTab from "./components/ProcessesTab";
import StorageTab from "./components/StorageTab";
import NetworkTab from "./components/NetworkTab";
import {
    EMPTY, LoadFailedState, Meter, SectionHeading, ServerIdentity, StatusBadge, StateNotice, describeMonitoringState, formatUptime,
    getUsageLevel,
} from "../shared";
import { useTranslation } from "react-i18next";

const TABS = {
    server: [
        { key: "overview", icon: mdiChartLine },
        { key: "storage", icon: mdiHarddisk },
        { key: "network", icon: mdiNetworkOutline },
        { key: "processes", icon: mdiConsole },
    ],
    proxmox: [
        { key: "overview", icon: mdiChartLine },
        { key: "nodes", icon: mdiServerNetwork },
    ],
};

const TIME_RANGES = ["1h", "6h", "24h"];
const SYSTEM_INFO_FIELDS = { hostname: "hostname", os: "name", version: "version", kernel: "kernel", architecture: "architecture" };

const Fact = ({ label, value, detail }) => (
    <div className="fact">
        <dt>{label}</dt>
        <dd>{value ?? EMPTY}</dd>
        {detail && <span className="fact__detail">{detail}</span>}
    </div>
);

const InfoItem = ({ label, value }) => (
    <div className="info-item"><dt>{label}</dt><dd>{value}</dd></div>
);

const SectionCard = ({ title, badge, children }) => (
    <section className="mon-card section-card">
        <div className="section-card__header">
            <h3 className="section-card__title">{title}</h3>
            {badge}
        </div>
        {children}
    </section>
);

const MEMORY_SEGMENTS = ["used", "cache", "free"];

const MemoryCard = ({ memory, t }) => {
    const label = (segment) => t(`monitoring.details.overview.memory.${segment}`);
    const percent = (segment) => (memory[segment] / memory.total) * 100;
    const summary = t("monitoring.details.overview.memory.summary", {
        used: formatBytes(memory.used), total: formatBytes(memory.total), percent: Math.round(percent("used")),
    });

    return (
        <SectionCard title={t("monitoring.details.overview.memory.title")}
                     badge={<span className="section-card__muted">{summary}</span>}>
            <div className={`memory-bar memory-bar--${getUsageLevel(percent("used"))}`} role="img" aria-label={summary}>
                {MEMORY_SEGMENTS.slice(0, -1).map(segment => (
                    <div key={segment} className={`memory-bar__segment memory-bar__segment--${segment}`}
                         style={{ width: `${percent(segment)}%` }} title={`${label(segment)}: ${formatBytes(memory[segment])}`} />
                ))}
            </div>
            <dl className="memory-legend">
                {MEMORY_SEGMENTS.map(segment => (
                    <div key={segment} className="memory-legend__item">
                        <span className={`memory-legend__swatch memory-legend__swatch--${segment}`} />
                        <dt>{label(segment)}</dt>
                        <dd>{formatBytes(memory[segment])}</dd>
                    </div>
                ))}
            </dl>
        </SectionCard>
    );
};

export const ServerDetails = ({ server, state = "online", activeTab = "overview", onTabChange, onClose }) => {
    const { t } = useTranslation();
    const [detailData, setDetailData] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [timeRange, setTimeRange] = useState("1h");
    const isPVE = server.type === "proxmox";

    const loadDetailData = useCallback(async () => {
        try {
            const endpoint = isPVE ? `monitoring/integration/${server.integrationId}` : `monitoring/${server.id}`;
            setDetailData(await getRequest(`${endpoint}?timeRange=${timeRange}`));
            setLoadFailed(false);
        } catch (e) {
            console.error("Error loading server details:", e);
            setLoadFailed(true);
        }
    }, [server.id, server.integrationId, isPVE, timeRange]);

    useEffect(() => {
        loadDetailData();
        const interval = setInterval(loadDetailData, 60000);
        return () => clearInterval(interval);
    }, [loadDetailData]);

    const tabs = useMemo(
        () => TABS[isPVE ? "proxmox" : "server"].map(tab => ({ ...tab, label: t(`monitoring.details.tabs.${tab.key}`) })),
        [isPVE, t],
    );
    const rangeTabs = useMemo(() => TIME_RANGES.map(range => ({ key: range, label: t(`monitoring.details.timeRanges.${range}`) })), [t]);

    const latest = detailData?.latest || detailData?.data?.[0] || null;
    const validTab = tabs.some(tab => tab.key === activeTab) ? activeTab : "overview";
    const notice = state === "online" ? null : describeMonitoringState(server, state, t);

    const renderTab = () => {
        if (!detailData) return loadFailed ? <LoadFailedState className="details-empty" onRetry={loadDetailData} /> : null;

        switch (validTab) {
            case "nodes": return <NodesTab nodes={latest?.osInfo?.nodes} t={t} />;
            case "storage": return <StorageTab disks={latest?.disk} />;
            case "network": return <NetworkTab network={latest?.network} />;
            case "processes": return <ProcessesTab processList={latest?.processList} />;
            default: {
                const Overview = isPVE ? PVEOverviewTab : OverviewTab;
                const range = <TabSwitcher tabs={rangeTabs} activeTab={timeRange} onTabChange={setTimeRange} />;
                return <Overview latest={latest} data={detailData.data} range={range} t={t} />;
            }
        }
    };

    return (
        <>
            <header className="panel-header">
                <ServerIdentity server={server} large />
                <StatusBadge state={state} label={t(`monitoring.grid.status.labels.${state}`)} />
                <Button icon={mdiClose} title={t("common.close")} onClick={onClose} />
            </header>
            <div className="panel-tabs">
                <TabSwitcher tabs={tabs} activeTab={validTab} onTabChange={onTabChange} />
            </div>
            <div className="panel-body server-details">
                {notice && <StateNotice state={state} {...notice} />}
                {renderTab()}
            </div>
        </>
    );
};

const Charts = ({ data, range, processesTitle, t }) => (
    <>
        <SectionHeading title={t("monitoring.details.overview.performance.title")}>
            <div className="monitoring-range">{range}</div>
        </SectionHeading>
        <MonitoringChart data={data} title={t("monitoring.details.charts.cpuUsage")} dataKey="cpuUsage" yAxisMax={100} />
        <MonitoringChart data={data} title={t("monitoring.details.charts.memoryUsage")} dataKey="memoryUsage" yAxisMax={100} />
        <MonitoringChart data={data} title={processesTitle} dataKey="processes" unit="" />
    </>
);

const OverviewTab = ({ latest, data, range, t }) => {
    const os = latest?.osInfo;
    const hasSystemInfo = os && Object.keys(os).length > 0;
    const isWindows = os?.platform === "windows";
    const load = latest?.loadAverage;
    const unknown = t("monitoring.details.overview.systemInfo.unknown");
    const systemInfoFields = Object.entries(SYSTEM_INFO_FIELDS)
        .filter(([label]) => !(isWindows && label === "kernel"));

    return (
        <>
            <dl className="mon-card facts">
                {!isWindows && (
                    <Fact label={t("monitoring.details.overview.performance.loadAverage")} value={load?.[0]?.toFixed(2)}
                          detail={load?.length >= 3 ? t("monitoring.details.overview.performance.loadDetail", { fiveMin: load[1].toFixed(2), fifteenMin: load[2].toFixed(2) }) : null} />
                )}
                <Fact label={t("monitoring.details.overview.performance.processes")} value={latest?.processes} />
                <Fact label={t("monitoring.details.overview.performance.memory")} value={latest?.memoryTotal ? formatBytes(latest.memoryTotal) : null} />
                <Fact label={t("monitoring.details.overview.systemInfo.uptime")} value={latest?.uptime ? formatUptime(latest.uptime, t) : null} />
            </dl>
            {latest?.memory?.total > 0 && <MemoryCard memory={latest.memory} t={t} />}
            <Charts data={data} range={range} processesTitle={t("monitoring.details.charts.processes")} t={t} />
            <SectionCard title={t("monitoring.details.overview.systemInfo.title")}>
                {hasSystemInfo ? (
                    <dl className="info-list">
                        {systemInfoFields.map(([label, field]) => (
                            <InfoItem key={label} label={t(`monitoring.details.overview.systemInfo.${label}`)} value={os[field] || unknown} />
                        ))}
                        <InfoItem label={t("monitoring.details.overview.systemInfo.uptime")} value={formatUptime(latest.uptime, t, "long")} />
                    </dl>
                ) : <EmptyState compact icon={mdiInformationOutline} description={t("monitoring.details.overview.systemInfo.noData")} />}
            </SectionCard>
        </>
    );
};

const PVEOverviewTab = ({ latest, data, range, t }) => {
    const pve = latest?.osInfo;
    const running = (count) => t("monitoring.details.pve.running", { count: count ?? 0 });

    return (
        <>
            <dl className="mon-card facts">
                <Fact label={t("monitoring.details.pve.onlineNodes")} value={`${pve?.onlineNodes ?? 0}/${pve?.totalNodes ?? 0}`} />
                <Fact label={t("monitoring.details.pve.qemuVMs")} value={pve?.vmCount ?? 0} detail={running(pve?.runningVMs)} />
                <Fact label={t("monitoring.details.pve.lxcContainers")} value={pve?.lxcCount ?? 0} detail={running(pve?.runningLXC)} />
                <Fact label={t("monitoring.details.pve.storageUsage")} value={pve?.diskUsage != null ? `${pve.diskUsage}%` : null}
                      detail={pve?.totalDisk ? t("monitoring.details.overview.performance.total", { value: formatBytes(pve.totalDisk) }) : null} />
            </dl>
            <Charts data={data} range={range} processesTitle={t("monitoring.details.pve.vmContainerCount")} t={t} />
            <SectionCard title={t("monitoring.details.pve.clusterInfo")}>
                <dl className="info-list">
                    <InfoItem label={t("monitoring.details.pve.totalCPU")} value={`${pve?.totalCpu || 0} ${t("monitoring.details.pve.cores")}`} />
                    <InfoItem label={t("monitoring.details.pve.totalMemory")} value={formatBytes(pve?.totalMemory)} />
                    <InfoItem label={t("monitoring.details.pve.totalStorage")} value={formatBytes(pve?.totalDisk)} />
                    <InfoItem label={t("monitoring.details.pve.uptime")} value={formatUptime(latest?.uptime, t, "long")} />
                </dl>
            </SectionCard>
        </>
    );
};

const NodesTab = ({ nodes, t }) => {
    if (!nodes?.length) {
        return <EmptyState className="details-empty" icon={mdiServerNetwork} description={t("monitoring.details.pve.noNodes")} />;
    }

    return (
        <div className="card-grid">
            {nodes.map((node, i) => {
                const state = node.status === "online" ? "online" : "offline";
                const metrics = [
                    { key: "cpu", value: node.cpuUsage },
                    { key: "memory", value: node.memoryUsage, detail: `${formatBytes(node.memoryUsed)} / ${formatBytes(node.memory)}` },
                    { key: "storage", value: node.diskUsage, detail: `${formatBytes(node.diskUsed)} / ${formatBytes(node.disk)}` },
                ].map(metric => ({ ...metric, label: t(`monitoring.details.pve.${metric.key}`) }));

                return (
                    <SectionCard key={node.name || i} title={node.name}
                                 badge={<StatusBadge state={state} label={t(`monitoring.grid.status.labels.${state}`)} />}>
                        {state === "online" ? (
                            <>
                                <div className="usage-list">
                                    {metrics.map(metric => (
                                        <div key={metric.key} className="usage-row">
                                            <div className="mon-row-head">
                                                <span className="usage-row__label">{metric.label}</span>
                                                {metric.detail && <span className="usage-row__detail">{metric.detail}</span>}
                                                <span className="usage-row__value">{metric.value ?? EMPTY}%</span>
                                            </div>
                                            <Meter value={metric.value} label={metric.label} />
                                        </div>
                                    ))}
                                </div>
                                <dl className="info-list info-list--inline">
                                    <InfoItem label={t("monitoring.details.pve.cores")} value={node.cpu ?? EMPTY} />
                                    <InfoItem label={t("monitoring.details.pve.uptime")} value={formatUptime(node.uptime, t, "long")} />
                                </dl>
                            </>
                        ) : <p className="section-card__muted">{t("monitoring.details.pve.nodeOffline")}</p>}
                    </SectionCard>
                );
            })}
        </div>
    );
};
