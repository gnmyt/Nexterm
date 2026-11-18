import Icon from "@mdi/react";
import { mdiMagnify, mdiServerOff } from "@mdi/js";
import { useTranslation } from "react-i18next";
import EmptyState from "@/common/components/EmptyState";
import {
    EMPTY, FactList, ServerIdentity, Sparkline, getMonitoringState, describeMonitoringState, formatUptime, getUsageLevel,
} from "../shared";

const getFacts = (server, t) => {
    const monitoring = server.monitoring;
    const pve = monitoring?.osInfo;
    const facts = server.type === "proxmox"
        ? {
            nodes: pve?.onlineNodes != null ? `${pve.onlineNodes}/${pve.totalNodes}` : null,
            vms: pve?.vmCount != null ? `${pve.runningVMs + pve.runningLXC}/${pve.vmCount + pve.lxcCount}` : null,
        }
        : { loadAverage: monitoring?.loadAverage?.[0]?.toFixed(2), processes: monitoring?.processes };

    return Object.entries({ ...facts, uptime: formatUptime(monitoring?.uptime, t) })
        .map(([key, value]) => ({ key, label: t(`monitoring.grid.metrics.${key}`), value }));
};

const UsageMetric = ({ label, value, history }) => (
    <div className="fleet-metric">
        <div className="fleet-metric__head">
            <span className="fleet-metric__label">{label}</span>
            <span className="fleet-metric__value">
                {value ?? EMPTY}{value != null && <span className="fleet-metric__unit">%</span>}
            </span>
        </div>
        <Sparkline values={history} level={getUsageLevel(value)} label={label} />
    </div>
);

export const MonitoringGrid = ({ servers, selectedId, isFiltered = false, onServerSelect }) => {
    const { t } = useTranslation();

    if (!servers?.length) {
        return (
            <div className="monitoring-grid empty">
                {isFiltered
                    ? <EmptyState icon={mdiMagnify} title={t("monitoring.grid.noResults.title")}
                                  description={t("monitoring.grid.noResults.subtitle")} />
                    : <EmptyState icon={mdiServerOff} title={t("monitoring.grid.noServers.title")}
                                  description={t("monitoring.grid.noServers.subtitle")} />}
            </div>
        );
    }

    const handleKeyDown = (event, server) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onServerSelect(server);
    };

    return (
        <div className="monitoring-grid">
            {servers.map(server => {
                const state = getMonitoringState(server);
                const issue = state === "online" ? null : describeMonitoringState(server, state, t);
                const selected = String(server.id) === String(selectedId);

                return (
                    <div key={server.id} role="button" tabIndex={0} aria-pressed={selected}
                         className={`fleet-card mon-state mon-state--${state}${selected ? " selected" : ""}`}
                         onClick={() => onServerSelect(server)} onKeyDown={(event) => handleKeyDown(event, server)}>
                        <div className="fleet-card__header">
                            <ServerIdentity server={server} />
                            <span className="fleet-card__dot" role="img" aria-label={t(`monitoring.grid.status.labels.${state}`)} />
                        </div>
                        {issue ? (
                            <div className="fleet-card__issue">
                                <div className="fleet-card__issue-icon"><Icon path={issue.icon} /></div>
                                <h4>{issue.title}</h4>
                                <p>{issue.message}</p>
                                {issue.meta && <span>{issue.meta}</span>}
                            </div>
                        ) : (
                            <>
                                <div className="fleet-card__metrics">
                                    <UsageMetric label={t("monitoring.grid.metrics.cpu")} value={server.monitoring?.cpuUsage}
                                                 history={server.history?.map(point => point.cpuUsage)} />
                                    <UsageMetric label={t("monitoring.grid.metrics.memory")} value={server.monitoring?.memoryUsage}
                                                 history={server.history?.map(point => point.memoryUsage)} />
                                </div>
                                <FactList facts={getFacts(server, t)} />
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
