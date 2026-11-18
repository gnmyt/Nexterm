const DURATION_MS = 8000;
const sessions = new Map();

const clamp = (value) => Math.max(0, Math.min(DURATION_MS, value));

export const beginProgress = (sessionId) => {
    if (!sessionId) return 0;
    const entry = sessions.get(sessionId);
    const offset = entry?.frozenAt ?? 0;
    sessions.set(sessionId, { startedAt: Date.now() - offset });
    return offset;
};

export const freezeProgress = (sessionId) => {
    const entry = sessions.get(sessionId);
    if (entry?.frozenAt != null) return entry.frozenAt;

    const frozenAt = entry ? clamp(Date.now() - entry.startedAt) : 0;
    sessions.set(sessionId, { frozenAt });
    return frozenAt;
};

export const endProgress = (sessionId) => sessions.delete(sessionId);
