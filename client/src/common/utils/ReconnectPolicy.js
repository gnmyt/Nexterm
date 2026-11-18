export const isAutoReconnectEligible = (session) => {
    if (!session) return false;
    if (session.type === "notes" || session.isJoined) return false;
    if (session.scriptId) return false;
    if (session.type === "sftp") return false;
    return true;
};

export const shouldAttemptAutoReconnect = ({ enabled, session, errorInfo, wasConnected }) => (
    Boolean(enabled)
    && isAutoReconnectEligible(session)
    && Boolean(wasConnected)
    && Boolean(errorInfo)
    && errorInfo.autoReconnect !== false
);
