import { useState, useMemo, useCallback } from "react";
import Icon from "@mdi/react";
import {
    mdiChevronLeft,
    mdiChevronRight,
    mdiInformationOutline,
    mdiCalendarClock,
    mdiAccountCircleOutline,
    mdiDomain,
    mdiWeb,
    mdiLoading,
} from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";

export const AuditTable = ({ logs, loading, pagination, onPageChange, getIconForAction }) => {
    const [expandedRow, setExpandedRow] = useState(null);

    const formatTimestamp = useCallback((timestamp) => {
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString(),
        };
    }, []);

    const formatAction = useCallback((action) =>
            action.replace(".", " → ").replace(/_/g, " ").toUpperCase()
        , []);

    const getActionBadgeColor = useCallback((action) => {
        if (action.startsWith("user.")) return "blue";
        if (action.startsWith("server.")) {
            if (action.includes("connect")) return "green";
            if (action.includes("disconnect")) return "orange";
        }
        if (action.startsWith("file.")) {
            if (action.includes("upload")) return "green";
            if (action.includes("download")) return "blue";
            if (action.includes("delete")) return "red";
        }
        if (action.startsWith("folder.delete")) return "red";
        if (action.startsWith("identity.")) return "purple";
        if (action.startsWith("organization.")) return "cyan";
        return "gray";
    }, []);

    const renderDetails = useCallback((details) => {
        if (!details) return null;

        return (
            <div className="audit-details">
                {Object.entries(details).map(([key, value]) => (
                    <div key={key} className="detail-item">
                        <span className="detail-key">{key.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>
                        <span className="detail-value">{String(value)}</span>
                    </div>
                ))}
            </div>
        );
    }, []);

    const totalPages = useMemo(() => Math.ceil(pagination.total / pagination.itemsPerPage),
        [pagination.total, pagination.itemsPerPage]);

    const handleRowClick = useCallback((logId) => {
        setExpandedRow(prev => prev === logId ? null : logId);
    }, []);

    if (logs.length === 0 && !loading) {
        return (
            <div className="audit-table-container">
                <div className="no-logs">
                    <Icon path={mdiInformationOutline} />
                    <h3>No audit logs found</h3>
                    <p>Try adjusting your filters or check back later.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="audit-table-container">
            {loading && (
                <div className="loading-overlay">
                    <Icon path={mdiLoading} spin />
                    <span>Loading audit logs...</span>
                </div>
            )}

            <div className="audit-table">
                <div className="table-header">
                    <div className="header-cell timestamp">
                        <Icon path={mdiCalendarClock} />
                        <span>Timestamp</span>
                    </div>
                    <div className="header-cell action">Action</div>
                    <div className="header-cell actor">
                        <Icon path={mdiAccountCircleOutline} />
                        <span>Actor</span>
                    </div>
                    <div className="header-cell resource">Resource</div>
                    <div className="header-cell organization">
                        <Icon path={mdiDomain} />
                        <span>Organization</span>
                    </div>
                    <div className="header-cell details">
                        <Icon path={mdiInformationOutline} />
                        <span>Details</span>
                    </div>
                </div>

                <div className="table-body">
                    {logs.map((log) => {
                        const timestamp = formatTimestamp(log.timestamp);
                        const isExpanded = expandedRow === log.id;

                        return (
                            <div key={log.id} className="table-row">
                                <div className="row-main" onClick={() => handleRowClick(log.id)}>
                                    <div className="cell timestamp" data-label="Timestamp">
                                        <div className="timestamp-content">
                                            <span className="date">{timestamp.date}</span>
                                            <span className="time">{timestamp.time}</span>
                                        </div>
                                    </div>

                                    <div className="cell action" data-label="Action">
                                        <div className="action-content">
                                            <Icon path={getIconForAction(log.action)} />
                                            <span className={`action-badge ${getActionBadgeColor(log.action)}`}>
                                                {formatAction(log.action)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="cell actor" data-label="Actor">
                                        <div className="actor-info">
                                            <span className="actor-name">
                                                {log.actorFirstName && log.actorLastName
                                                    ? `${log.actorFirstName} ${log.actorLastName}`
                                                    : `User #${log.accountId}`
                                                }
                                            </span>
                                            {log.ipAddress && (
                                                <span className="actor-ip">{log.ipAddress}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="cell resource" data-label="Resource">
                                        {log.resource && (
                                            <span className="resource-badge">
                                                {log.resource}
                                                {log.resourceId && ` #${log.resourceId}`}
                                            </span>
                                        )}
                                    </div>

                                    <div className="cell organization" data-label="Organization">
                                        {log.organizationId ? (
                                            <span className="org-badge">
                                                {log.organizationName || `Org #${log.organizationId}`}
                                            </span>
                                        ) : (
                                            <span className="personal-badge">Personal</span>
                                        )}
                                    </div>

                                    <div className="cell details" data-label="Details">
                                        <Icon path={mdiChevronRight}
                                              className={`expand-icon ${isExpanded ? "expanded" : ""}`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="row-expanded">
                                        <div className="expanded-content">
                                            {log.reason && (
                                                <div className="reason-section">
                                                    <h4>Connection Reason</h4>
                                                    <p>{log.reason}</p>
                                                </div>
                                            )}

                                            {log.userAgent && (
                                                <div className="user-agent-section">
                                                    <h4>User Agent</h4>
                                                    <p><Icon path={mdiWeb} /> {log.userAgent}</p>
                                                </div>
                                            )}

                                            {log.details && (
                                                <div className="details-section">
                                                    <h4>Additional Details</h4>
                                                    {renderDetails(log.details)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {logs.length > 0 && (
                <div className="pagination">
                    <div className="pagination-info">
                        Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.total)} of {pagination.total} logs
                    </div>

                    <div className="pagination-controls">
                        <Button
                            text="Previous"
                            icon={mdiChevronLeft}
                            onClick={() => onPageChange(pagination.currentPage - 1)}
                            disabled={pagination.currentPage <= 1}
                            type="secondary"
                        />

                        <span className="page-info">
                            Page {pagination.currentPage} of {totalPages}
                        </span>

                        <Button
                            text="Next"
                            icon={mdiChevronRight}
                            onClick={() => onPageChange(pagination.currentPage + 1)}
                            disabled={pagination.currentPage >= totalPages}
                            type="secondary"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};