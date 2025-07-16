import Icon from "@mdi/react";
import { mdiServerOutline, mdiServerOff, mdiAlertCircle, mdiClockOutline } from "@mdi/js";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { useTranslation } from "react-i18next";

export const MonitoringGrid = ({ servers, loading, onServerSelect }) => {
    const { t } = useTranslation();

    const formatUptime = (seconds) => {
        if (!seconds) return t('monitoring.grid.uptime.unknown');
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return t('monitoring.grid.uptime.format.days', { days, hours, minutes });
        } else if (hours > 0) {
            return t('monitoring.grid.uptime.format.hours', { hours, minutes });
        } else {
            return t('monitoring.grid.uptime.format.minutes', { minutes });
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'online': return 'online';
            case 'offline': return 'offline';
            case 'error': return 'error';
            default: return 'unknown';
        }
    };

    if (loading) {
        return (
            <div className="monitoring-grid loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (!servers || servers.length === 0) {
        return (
            <div className="monitoring-grid empty">
                <div className="no-servers">
                    <Icon path={mdiServerOff} />
                    <h2>{t('monitoring.grid.noServers.title')}</h2>
                    <p>{t('monitoring.grid.noServers.subtitle')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="monitoring-grid">
            {servers.map(server => (
                <div 
                    key={server.id} 
                    className="server-card"
                    onClick={() => onServerSelect(server)}
                >
                    <div className={`status-indicator ${getStatusClass(server.monitoring.status)}`}></div>
                    
                    <div className="server-header">
                        <div className="server-icon">
                            <Icon path={server.icon ? loadIcon(server.icon) : mdiServerOutline} />
                        </div>
                        <div className="server-info">
                            <h3>{server.name}</h3>
                            <p>{server.ip}:{server.port}</p>
                        </div>
                    </div>

                    {server.monitoring.status === 'online' ? (
                        <>
                            <div className="metrics">
                                <div className="metric">
                                    <div className="metric-label">{t('monitoring.grid.metrics.cpuUsage')}</div>
                                    <div className="metric-value">
                                        {server.monitoring.cpuUsage !== null ? 
                                            `${server.monitoring.cpuUsage}%` : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">{t('monitoring.grid.metrics.memoryUsage')}</div>
                                    <div className="metric-value">
                                        {server.monitoring.memoryUsage !== null ? 
                                            `${server.monitoring.memoryUsage}%` : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">{t('monitoring.grid.metrics.loadAverage')}</div>
                                    <div className="metric-value">
                                        {server.monitoring.loadAverage && 
                                         server.monitoring.loadAverage.length > 0 && 
                                         typeof server.monitoring.loadAverage[0] === 'number' ? 
                                            server.monitoring.loadAverage[0].toFixed(2) : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">{t('monitoring.grid.metrics.processes')}</div>
                                    <div className="metric-value">
                                        {server.monitoring.processes || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {server.monitoring.uptime && (
                                <div className="uptime-info">
                                    {t('monitoring.grid.metrics.uptime')}: {formatUptime(server.monitoring.uptime)}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="offline-state">
                            <div className="offline-icon">
                                <Icon path={
                                    server.monitoring.status === 'offline' ? mdiServerOff :
                                    server.monitoring.status === 'error' ? mdiAlertCircle :
                                    mdiClockOutline
                                } />
                            </div>
                            <div className="offline-info">
                                <h4>
                                    {server.monitoring.status === 'offline' ? t('monitoring.grid.status.serverOffline') :
                                     server.monitoring.status === 'error' ? t('monitoring.grid.status.connectionError') :
                                     t('monitoring.grid.status.statusUnknown')}
                                </h4>
                                <p>
                                    {server.monitoring.status === 'offline' ? 
                                        t('monitoring.grid.status.offlineMessage') :
                                     server.monitoring.status === 'error' ? 
                                        (server.monitoring.errorMessage || t('monitoring.grid.status.errorMessage')) :
                                        t('monitoring.grid.status.unknownMessage')}
                                </p>
                                <div className="offline-actions">
                                    <span className="last-seen">
                                        {server.monitoring.lastSeen ? 
                                            t('monitoring.grid.status.lastSeen', { time: new Date(server.monitoring.lastSeen).toLocaleString() }) :
                                            t('monitoring.grid.status.noRecentActivity')
                                        }
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
