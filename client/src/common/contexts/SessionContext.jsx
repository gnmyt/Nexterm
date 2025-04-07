import { createContext, useContext, useState } from "react";

export const SessionContext = createContext({});

export const useActiveSessions = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
    const [activeSessions, setActiveSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);

    return (
        <SessionContext.Provider
            value={{ activeSessions, setActiveSessions, activeSessionId, setActiveSessionId }}>
            {children}
        </SessionContext.Provider>
    );
};