import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { isTauri } from "@/common/utils/TauriUtil.js";

export const SessionContext = createContext({});
export const useActiveSessions = () => useContext(SessionContext);

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexterm_popout") : null;

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
        
        if (isTauri()) {
            try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("open_popout", { sessionId: id });
            } catch (e) {
                console.error("Failed to open popout window:", e);
            }
        } else {
            window.open(`/popout/${id}`, `nexterm_popout_${id}`, "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no")?.focus();
        }
    }, [activeSessionId, activeSessions, poppedOutSessions]);

    useEffect(() => {
        if (!channel) return;
        const handler = ({ data }) => {
            if (data.type !== "popout_closed") return;
            setPoppedOutSessions(p => p.filter(id => id !== data.sessionId));
            if (activeSessions.some(s => s.id === data.sessionId)) setActiveSessionId(data.sessionId);
        };
        channel.addEventListener("message", handler);
        return () => channel.removeEventListener("message", handler);
    }, [activeSessions]);

    useEffect(() => {
        if (!isTauri()) return;
        
        let unlisten;
        import("@tauri-apps/api/event").then(async ({ listen }) => {
            unlisten = await listen("popout_closed", ({ payload }) => {
                const sessionId = payload;
                if (!sessionId) return;
                setPoppedOutSessions(p => p.filter(id => id !== sessionId));
                if (activeSessions.some(s => s.id === sessionId)) setActiveSessionId(sessionId);
            });
        });
        
        return () => unlisten?.();
    }, [activeSessions]);

    return (
        <SessionContext.Provider value={{ activeSessions, setActiveSessions, activeSessionId, setActiveSessionId, poppedOutSessions, popOutSession }}>
            {children}
        </SessionContext.Provider>
    );
};