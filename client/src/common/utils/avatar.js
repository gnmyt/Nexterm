const AVATAR_COLORS = [
    "#314BD3", "#5B3FD9", "#8E3FD4", "#C13B94", "#C1364F",
    "#C25218", "#A8741A", "#1E9E5A", "#12908C", "#2A72C9",
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

export const getFullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ");

export const getAvatarLabel = (user, fallback = "") => {
    if (!user) return fallback;
    return getFullName(user) || user.username || fallback;
};

export const getSessionOwnerLabel = (session, t) =>
    getAvatarLabel(session?.owner) || t("servers.liveSessions.unknownUser");
