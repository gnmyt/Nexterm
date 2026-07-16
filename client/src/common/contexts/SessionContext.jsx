import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { openPopout, onPopoutClosed } from "@/common/utils/PopoutUtil.js";

export const SessionContext = createContext({});
export const useActiveSessions = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
    const [activeSessions, setActiveSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [poppedOutSessions, setPoppedOutSessions] = useState([]);

    const popOutSession = useCallback(async (id) => {
        setPoppedOutSessions(p => p.includes(id) ? p : [...p, id]);
        if (id === activeSessionId) {
            const visible = activeSessions.filter(s => s.id !== id && !poppedOutSessions.includes(s.id));
            setActiveSessionId(visible.at(-1)?.id || null);
        }

        await openPopout(id);
    }, [activeSessionId, activeSessions, poppedOutSessions]);

    useEffect(() => onPopoutClosed((sessionId, monitor) => {
        if (monitor !== null) return;

        setPoppedOutSessions(p => p.filter(id => id !== sessionId));
        if (activeSessions.some(s => s.id === sessionId)) setActiveSessionId(sessionId);
    }), [activeSessions]);

    return (
        <SessionContext.Provider value={{ activeSessions, setActiveSessions, activeSessionId, setActiveSessionId, poppedOutSessions, popOutSession }}>
            {children}
        </SessionContext.Provider>
    );
};