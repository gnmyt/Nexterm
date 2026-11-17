import { getActiveServerUrl, isTauri } from "@/common/utils/TauriUtil.js";
import { getToken } from "@/common/utils/RequestUtil.js";

const AVATAR_COLORS = [
    "#7D8FF5", "#A98BF0", "#D08CE8", "#E88BBF", "#EF8A8A",
    "#F0A06A", "#D9B45A", "#6FCF97", "#5FC9C3", "#6FB3F2",
];

export const getAvatarIdentifier = (user) => user?.accountId ?? user?.id ?? user?.username ?? user?.viewerId ?? "";

export const getAvatarInitials = (user) => {
    if (!user) return "??";
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    return user.username?.slice(0, 2).toUpperCase() || "??";
};

export const getAvatarColor = (identifier) => {
    const key = String(identifier ?? "");
    if (!key) return AVATAR_COLORS[0];

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) - hash + key.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getAvatarUrl = (user) => {
    const accountId = user?.accountId ?? user?.id;
    if (!user?.avatarHash || !accountId) return null;

    const token = getToken();
    if (!token) return null;

    const baseUrl = isTauri() ? getActiveServerUrl() || "" : "";

    return `${baseUrl}/api/accounts/${accountId}/avatar?v=${user.avatarHash}&token=${encodeURIComponent(token)}`;
};

export const getFullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ");

export const getAvatarLabel = (user, fallback = "") => {
    if (!user) return fallback;
    return getFullName(user) || user.username || fallback;
};

export const getSessionOwnerLabel = (session, t) =>
    getAvatarLabel(session?.owner) || t("servers.liveSessions.unknownUser");
