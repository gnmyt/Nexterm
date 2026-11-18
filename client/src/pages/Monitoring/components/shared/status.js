import { mdiAlertCircleOutline, mdiClockOutline, mdiHelpCircleOutline, mdiServerOff } from "@mdi/js";

export const EMPTY = "–";

const STATES = {
    offline: { icon: mdiServerOff, title: "serverOffline", message: "offlineMessage" },
    error: { icon: mdiAlertCircleOutline, title: "connectionError", message: "errorMessage" },
    pending: { icon: mdiClockOutline, title: "waitingForData", message: "pendingMessage" },
    unknown: { icon: mdiHelpCircleOutline, title: "statusUnknown", message: "unknownMessage" },
};

const UPTIME_FORMATS = {
    short: {
        unknown: "monitoring.grid.uptime.unknown",
        days: "monitoring.grid.uptime.format.days",
        hours: "monitoring.grid.uptime.format.hours",
        minutes: "monitoring.grid.uptime.format.minutes",
    },
    long: {
        unknown: "monitoring.details.overview.systemInfo.unknown",
        days: "monitoring.details.overview.uptime.format.full",
        hours: "monitoring.details.overview.uptime.format.hoursMinutes",
        minutes: "monitoring.details.overview.uptime.format.minutes",
    },
};

export const getMonitoringState = (server) => {
    const monitoringStatus = server?.monitoring?.status;
    if (server?.status === "offline") return "offline";
    if (monitoringStatus === "online") return "online";
    if (monitoringStatus === "error" || monitoringStatus === "offline") return "error";
    if (server?.status === "online") return "pending";
    return "unknown";
};

export const describeMonitoringState = (server, state, t) => {
    const { icon, title, message } = STATES[state];
    const reported = state === "error" ? server?.monitoring?.errorMessage : null;
    const lastUpdate = server?.monitoring?.timestamp || server?.monitoring?.updatedAt;

    return {
        icon,
        title: t(`monitoring.grid.status.${title}`),
        message: reported || t(`monitoring.grid.status.${message}`),
        meta: state === "pending" ? null : lastUpdate
            ? t("monitoring.grid.status.lastSeen", { time: new Date(lastUpdate).toLocaleString() })
            : t("monitoring.grid.status.noRecentActivity"),
    };
};

export const getUsageLevel = (value) => value >= 90 ? "critical" : value >= 75 ? "warning" : "normal";

export const formatUptime = (seconds, t, format = "short") => {
    const keys = UPTIME_FORMATS[format];
    if (!seconds) return t(keys.unknown);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return t(keys.days, { days, hours, minutes });
    if (hours > 0) return t(keys.hours, { hours, minutes });
    return t(keys.minutes, { minutes });
};
