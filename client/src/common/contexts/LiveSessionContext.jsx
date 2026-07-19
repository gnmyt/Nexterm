import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";

const EMPTY_SESSIONS = [];

export const LiveSessionContext = createContext({
    liveSessions: [],
    presence: {},
    getParticipants: () => [],
    getLiveSessionsForEntry: () => [],
});

export const LiveSessionProvider = ({ children }) => {
    const { registerHandler } = useContext(StateStreamContext);
    const [liveSessions, setLiveSessions] = useState([]);
    const [presence, setPresence] = useState({});

    const liveSessionById = useMemo(
        () => new Map(liveSessions.map(session => [session.id, session])), [liveSessions]);

    const liveSessionsByEntry = useMemo(() => {
        const grouped = new Map();
        for (const session of liveSessions) {
            const existing = grouped.get(session.entryId);
            if (existing) existing.push(session);
            else grouped.set(session.entryId, [session]);
        }
        return grouped;
    }, [liveSessions]);

    useEffect(() => registerHandler(STATE_TYPES.LIVE_SESSIONS, (data) => {
        setLiveSessions(Array.isArray(data) ? data : []);
    }), [registerHandler]);

    useEffect(() => registerHandler(STATE_TYPES.SESSION_PRESENCE, (data) => {
        if (!data?.sessionId) return;
        setPresence(current => ({ ...current, [data.sessionId]: data.participants || [] }));
    }), [registerHandler]);

    useEffect(() => registerHandler(STATE_TYPES.CONNECTIONS, (data) => {
        if (!Array.isArray(data)) return;
        setPresence(current => {
            const seeded = { ...current };
            for (const session of data) {
                if (seeded[session.sessionId] === undefined) seeded[session.sessionId] = session.participants || [];
            }
            return seeded;
        });
    }), [registerHandler]);

    const getParticipants = useCallback((sessionId) =>
        presence[sessionId] || liveSessionById.get(sessionId)?.participants || [],
        [presence, liveSessionById]);

    const getLiveSessionsForEntry = useCallback((entryId) =>
        liveSessionsByEntry.get(entryId) || EMPTY_SESSIONS, [liveSessionsByEntry]);

    const contextValue = useMemo(() => ({
        liveSessions,
        presence,
        getParticipants,
        getLiveSessionsForEntry,
    }), [liveSessions, presence, getParticipants, getLiveSessionsForEntry]);

    return <LiveSessionContext.Provider value={contextValue}>{children}</LiveSessionContext.Provider>;
};

export const useLiveSessions = () => useContext(LiveSessionContext);
