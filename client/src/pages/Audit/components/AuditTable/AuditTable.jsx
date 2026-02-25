import { useState, useMemo, useCallback } from "react";
import Icon from "@mdi/react";
import {
    mdiChevronRight,
    mdiInformationOutline,
    mdiCalendarClock,
    mdiAccountCircleOutline,
    mdiDomain,
    mdiWeb,
    mdiPlayCircleOutline,
} from "@mdi/js";
import PaginatedTable from "@/common/components/PaginatedTable";
import RecordingPlayer from "../RecordingPlayer";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const AuditTable = ({ logs, loading, pagination, onPageChange, getIconForAction }) => {
    const { t } = useTranslation();
    const [expandedRow, setExpandedRow] = useState(null);
    const [playingRecording, setPlayingRecording] = useState(null);

    const formatTimestamp = useCallback((timestamp) => {
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString(),
        };
    }, []);

    function formatSessionDuration(seconds, t) {
        if (!seconds && seconds !== 0) return "";
        if (seconds < 60) return `${seconds} ${t("audit.table.durationUnits.seconds")}`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t("audit.table.durationUnits.minutes")}`;
        return `${Math.floor(seconds / 3600)} ${t("audit.table.durationUnits.hours")}`;
    }

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
                        <span className="detail-key">
                            {key.replace(/([A-Z])/g, " $1").toLowerCase()}:
                        </span>
                        <span className="detail-value">
                            {key === "sessionDuration" 
                                ? formatSessionDuration(Number(value), t)
                                : String(value)
                            }
                        </span>
                    </div>
                ))}
            </div>
        );
    }, [t]);

    const handleRowClick = useCallback((logId) => {
        setExpandedRow(prev => prev === logId ? null : logId);
    }, []);

    const handlePlayRecording = useCallback((e, log) => {
        e.stopPropagation();
        setPlayingRecording({
            auditLogId: log.id,
            recordingType: log.details?.recordingType || "guac",
        });
    }, []);

    const handleCloseRecording = useCallback(() => {
        setPlayingRecording(null);
    }, []);

    const columns = useMemo(() => [
        {
            key: "timestamp",
            label: t('audit.table.headers.timestamp'),
            icon: mdiCalendarClock,
            className: "timestamp",
        },
        {
            key: "action",
            label: t('audit.table.headers.action'),
            className: "action",
        },
        {
            key: "actor",
            label: t('audit.table.headers.actor'),
            icon: mdiAccountCircleOutline,
            className: "actor",
        },
        {
            key: "resource",
            label: t('audit.table.headers.resource'),
            className: "resource",
        },
        {
            key: "organization",
            label: t('audit.table.headers.organization'),
            icon: mdiDomain,
            className: "organization",
        },
        {
            key: "details",
            label: t('audit.table.headers.details'),
            icon: mdiInformationOutline,
            className: "details",
        },
    ], [t]);

    const renderRow = useCallback((log) => {
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
                                    : t('audit.table.badges.user', { id: log.accountId })
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
                                {log.resourceName || log.resource}
                            </span>
                        )}
                    </div>

                    <div className="cell organization" data-label="Organization">
                        {log.organizationId ? (
                            <span className="org-badge">
                                {log.organizationName || t('audit.table.badges.organization', { id: log.organizationId })}
                            </span>
                        ) : (
                            <span className="personal-badge">{t('audit.table.badges.personal')}</span>
                        )}
                    </div>

                    <div className="cell details" data-label="Details">
                        {log.details?.hasRecording && (
                            <button
                                className="play-recording-btn"
                                onClick={(e) => handlePlayRecording(e, log)}
                            >
                                <Icon path={mdiPlayCircleOutline} size={0.9} />
                            </button>
                        )}
                        <Icon path={mdiChevronRight}
                              className={`expand-icon ${isExpanded ? "expanded" : ""}`} />
                    </div>
                </div>

                {isExpanded && (
                    <div className="row-expanded">
                        <div className="expanded-content">
                            {log.reason && (
                                <div className="reason-section">
                                    <h4>{t('audit.table.expandedDetails.connectionReason')}</h4>
                                    <p>{log.reason}</p>
                                </div>
                            )}

                            {log.userAgent && (
                                <div className="user-agent-section">
                                    <h4>{t('audit.table.expandedDetails.userAgent')}</h4>
                                    <p><Icon path={mdiWeb} /> {log.userAgent}</p>
                                </div>
                            )}

                            {log.details && (
                                <div className="details-section">
                                    <h4>{t('audit.table.expandedDetails.additionalDetails')}</h4>
                                    {renderDetails(log.details)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [expandedRow, formatTimestamp, formatAction, getActionBadgeColor, getIconForAction, handleRowClick, handlePlayRecording, renderDetails, t]);

    return (
        <>
            <PaginatedTable
                data={logs}
                columns={columns}
                pagination={pagination}
                onPageChange={onPageChange}
                renderRow={renderRow}
                getRowKey={(log) => log.id}
                loading={loading}
                emptyState={{
                    icon: mdiInformationOutline,
                    title: t('audit.table.noLogs.title'),
                    subtitle: t('audit.table.noLogs.subtitle'),
                }}
                className="audit-table-wrapper"
            />

            {playingRecording && (
                <RecordingPlayer
                    auditLogId={playingRecording.auditLogId}
                    recordingType={playingRecording.recordingType}
                    onClose={handleCloseRecording}
                />
            )}
        </>
    );
};