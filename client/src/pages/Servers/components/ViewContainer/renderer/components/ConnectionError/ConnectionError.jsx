import { memo, useEffect, useState } from "react";
import Icon from "@mdi/react";
import { mdiLaptop, mdiServer, mdiClose, mdiAlertCircle, mdiRefresh } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

const secondsUntil = (timestamp) => (timestamp ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : 0);

const useCountdown = (nextAttemptAt) => {
    const [seconds, setSeconds] = useState(() => secondsUntil(nextAttemptAt));

    useEffect(() => {
        if (!nextAttemptAt) return;
        setSeconds(secondsUntil(nextAttemptAt));
        const id = setInterval(() => setSeconds(secondsUntil(nextAttemptAt)), 1000);
        return () => clearInterval(id);
    }, [nextAttemptAt]);

    return seconds;
};

export const mapConnectionError = (rawMessage, t) => {
    if (!rawMessage) return t("common.errors.connection.failed");

    const cleaned = rawMessage.replace(/^error:\s*/i, "").trim();
    const msg = cleaned.toLowerCase();

    if (msg.includes("connection not available") || msg.includes("not available")) {
        return t("common.errors.connection.hostUnreachable");
    }
    if (msg.includes("no route to host") || msg.includes("unreachable")) {
        return t("common.errors.connection.hostUnreachable");
    }
    if (msg.includes("connection refused") || msg.includes("refused")) {
        return t("common.errors.connection.refused");
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
        return t("common.errors.connection.timeout");
    }
    if (msg.includes("authentication") || msg.includes("auth")) {
        return t("common.errors.connection.authenticationFailed");
    }
    if (msg.includes("permission denied")) {
        return t("common.errors.connection.permissionDenied");
    }
    if (msg.includes("aborted") || msg.includes("see logs")) {
        return t("common.errors.connection.hostUnreachable");
    }

    return cleaned.replace(/\(see logs\)/gi, "").trim() || t("common.errors.connection.failed");
};

export const ConnectionError = memo(({ message, onClose, onReconnect, reconnectInfo }) => {
    const { t } = useTranslation();
    const reconnecting = !!reconnectInfo;
    const seconds = useCountdown(reconnectInfo?.nextAttemptAt);

    return (
        <div className="connection-error">
            <div className="connection-error__bar" />
            <div className="connection-error__visual">
                <div className="connection-error__device">
                    <Icon path={mdiLaptop} className="connection-error__device-icon" />
                </div>
                <div className="connection-error__link">
                    <span className="connection-error__link-line" />
                    <span className="connection-error__link-badge">
                        <Icon path={mdiAlertCircle} />
                    </span>
                    <span className="connection-error__link-line" />
                </div>
                <div className="connection-error__device connection-error__device--server">
                    <Icon path={mdiServer} className="connection-error__device-icon" />
                </div>
            </div>
            <div className="connection-error__text">
                <h2 className="connection-error__title">{t("common.errors.connection.title")}</h2>
                <p className="connection-error__message">{message}</p>
            </div>
            {reconnecting && (
                <div className="connection-error__countdown">
                    <span className="connection-error__countdown-text">
                        {seconds > 0
                            ? t("common.errors.connection.reconnectingIn", { seconds })
                            : t("common.errors.connection.reconnecting")}
                    </span>
                    <span className="connection-error__countdown-attempt">
                        {t("common.errors.connection.reconnectAttempt", { count: reconnectInfo.attempt, max: reconnectInfo.maxAttempts })}
                    </span>
                </div>
            )}
            {(onClose || onReconnect) && (
                <div className="connection-error__actions">
                    {onClose && (
                        <button type="button" className="connection-error__action" onClick={onClose}>
                            <Icon path={mdiClose} />
                            <span>{t("common.errors.connection.close")}</span>
                        </button>
                    )}
                    {onReconnect && (
                        <button type="button" className="connection-error__action connection-error__action--primary"
                                onClick={onReconnect}>
                            <Icon path={mdiRefresh} />
                            <span>{reconnecting ? t("common.errors.connection.reconnectNow") : t("common.errors.connection.reconnect")}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});