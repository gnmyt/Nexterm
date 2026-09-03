import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import {
    mdiAlertCircleOutline, mdiBroom, mdiCancel, mdiCheckCircleOutline, mdiChevronDown, mdiChevronUp,
    mdiClose, mdiCloudDownloadOutline, mdiCloudUploadOutline, mdiSwapVertical,
} from "@mdi/js";
import { useTransfers, isTransferFinished } from "@/common/contexts/TransferContext.jsx";
import "./styles.sass";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return "0 B";
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[exponent]}`;
};

const percentOf = (transfer) => transfer.total > 0 ? Math.min(100, Math.round((transfer.transferred / transfer.total) * 100)) : null;

const TransferRow = ({ transfer, onCancel, onDismiss }) => {
    const { t } = useTranslation();
    const finished = isTransferFinished(transfer);
    const percent = percentOf(transfer);
    const indeterminate = !finished && transfer.state !== "queued" && percent === null;

    const statusText = () => {
        switch (transfer.state) {
            case "queued": return t("servers.fileManager.transfers.queued");
            case "cancelling": return t("servers.fileManager.transfers.cancelling");
            case "done": return transfer.detail
                ? t("servers.fileManager.transfers.savedTo", { path: transfer.detail, interpolation: { escapeValue: false } })
                : t("servers.fileManager.transfers.completed");
            case "cancelled": return t("servers.fileManager.transfers.cancelled");
            case "error": return t("servers.fileManager.transfers.failed", { message: transfer.error, interpolation: { escapeValue: false } });
            default: {
                const parts = [transfer.total > 0
                    ? `${formatBytes(transfer.transferred)} / ${formatBytes(transfer.total)}`
                    : formatBytes(transfer.transferred)];
                if (transfer.speed > 0) parts.push(`${formatBytes(transfer.speed)}/s`);
                if (percent !== null) parts.push(`${percent}%`);
                return parts.join(" · ");
            }
        }
    };

    const stateIcon = transfer.state === "done" ? mdiCheckCircleOutline
        : transfer.state === "error" || transfer.state === "cancelled" ? mdiAlertCircleOutline
            : transfer.direction === "upload" ? mdiCloudUploadOutline : mdiCloudDownloadOutline;

    return (
        <div className={`transfer-row ${transfer.state}`}>
            <Icon path={stateIcon} className="transfer-icon" />
            <div className="transfer-body">
                <div className="transfer-name" title={transfer.name}>{transfer.name}</div>
                <div className="transfer-status" title={statusText()}>{statusText()}</div>
                <div className={`transfer-bar ${indeterminate ? "indeterminate" : ""}`}>
                    <div className="transfer-bar-fill" style={{ width: `${finished ? 100 : percent ?? 0}%` }} />
                </div>
            </div>
            {finished
                ? <button className="transfer-action" onClick={() => onDismiss(transfer.id)} title={t("servers.fileManager.transfers.dismiss")}><Icon path={mdiClose} /></button>
                : <button className="transfer-action" onClick={() => onCancel(transfer.id)} disabled={transfer.state === "cancelling"} title={t("common.cancel")}><Icon path={mdiCancel} /></button>}
        </div>
    );
};

export const TransferPanel = ({ sessionId }) => {
    const { t } = useTranslation();
    const { transfers, cancelTransfer, dismissTransfer, clearFinished } = useTransfers();
    const [collapsed, setCollapsed] = useState(false);

    const sessionTransfers = useMemo(() => transfers
        .filter((transfer) => transfer.sessionId === sessionId)
        .sort((a, b) => Number(isTransferFinished(a)) - Number(isTransferFinished(b)) || a.startedAt - b.startedAt),
    [transfers, sessionId]);

    if (sessionTransfers.length === 0) return null;

    const active = sessionTransfers.filter((transfer) => !isTransferFinished(transfer));
    const finished = sessionTransfers.length - active.length;
    const totalSpeed = active.reduce((sum, transfer) => sum + (transfer.speed || 0), 0);

    return (
        <div className={`transfer-panel ${collapsed ? "collapsed" : ""}`}>
            <div className="transfer-header" onClick={() => setCollapsed((value) => !value)}>
                <Icon path={mdiSwapVertical} />
                <span className="transfer-title">{t("servers.fileManager.transfers.title")}</span>
                <span className="transfer-summary">
                    {active.length > 0
                        ? t("servers.fileManager.transfers.activeCount", { count: active.length })
                        : t("servers.fileManager.transfers.allDone")}
                    {totalSpeed > 0 && ` · ${formatBytes(totalSpeed)}/s`}
                </span>
                {finished > 0 && (
                    <button className="transfer-action" onClick={(event) => { event.stopPropagation(); clearFinished(sessionId); }}
                            title={t("servers.fileManager.transfers.clearFinished")}>
                        <Icon path={mdiBroom} />
                    </button>
                )}
                <Icon path={collapsed ? mdiChevronUp : mdiChevronDown} className="transfer-chevron" />
            </div>
            {!collapsed && (
                <div className="transfer-list">
                    {sessionTransfers.map((transfer) => (
                        <TransferRow key={transfer.id} transfer={transfer} onCancel={cancelTransfer} onDismiss={dismissTransfer} />
                    ))}
                </div>
            )}
        </div>
    );
};