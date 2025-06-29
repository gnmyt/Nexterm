import Icon from "@mdi/react";
import { mdiServerOutline, mdiServerOff, mdiAlertCircle, mdiClockOutline } from "@mdi/js";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";

export const MonitoringGrid = ({ servers, loading, onServerSelect }) => {
    const formatUptime = (seconds) => {
        if (!seconds) return "Unknown";
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
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
                    <h2>No Servers Found</h2>
                    <p>No SSH servers available for monitoring.<br />Add some servers to start monitoring them.</p>
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
                                    <div className="metric-label">CPU Usage</div>
                                    <div className="metric-value">
                                        {server.monitoring.cpuUsage !== null ? 
                                            `${server.monitoring.cpuUsage}%` : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">Memory Usage</div>
                                    <div className="metric-value">
                                        {server.monitoring.memoryUsage !== null ? 
                                            `${server.monitoring.memoryUsage}%` : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">Load Average</div>
                                    <div className="metric-value">
                                        {server.monitoring.loadAverage && 
                                         server.monitoring.loadAverage.length > 0 && 
                                         typeof server.monitoring.loadAverage[0] === 'number' ? 
                                            server.monitoring.loadAverage[0].toFixed(2) : 'N/A'
                                        }
                                    </div>
                                </div>
                                <div className="metric">
                                    <div className="metric-label">Processes</div>
                                    <div className="metric-value">
                                        {server.monitoring.processes || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {server.monitoring.uptime && (
                                <div className="uptime-info">
                                    Uptime: {formatUptime(server.monitoring.uptime)}
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
                                    {server.monitoring.status === 'offline' ? 'Server Offline' :
                                     server.monitoring.status === 'error' ? 'Connection Error' :
                                     'Status Unknown'}
                                </h4>
                                <p>
                                    {server.monitoring.status === 'offline' ? 
                                        'The server is currently not responding to monitoring requests.' :
                                     server.monitoring.status === 'error' ? 
                                        (server.monitoring.errorMessage || 'Unable to establish connection to the server.') :
                                        'Server status could not be determined.'}
                                </p>
                                <div className="offline-actions">
                                    <span className="last-seen">
                                        {server.monitoring.lastSeen ? 
                                            `Last seen: ${new Date(server.monitoring.lastSeen).toLocaleString()}` :
                                            'No recent activity'
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
