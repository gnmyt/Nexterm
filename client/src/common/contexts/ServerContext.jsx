import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const ServerContext = createContext({});

export const ServerProvider = ({ children }) => {
    const [servers, setServers] = useState(null);
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.ENTRIES, setServers);
    }, [user, registerHandler]);

    const loadServers = useCallback(async () => {
        try {
            setServers(await getRequest("/entries/list"));
        } catch {}
    }, []);

    const retrieveServerById = async (serverId) => {
        try {
            return await getRequest(`/entries/${serverId}`);
        } catch (error) {
            console.error("Failed to retrieve server", error.message);
        }
    };

    const getServerById = (serverId, entries = servers) => {
        for (const server of entries || []) {
            if (server.type === "folder" || server.type === "organization") {
                const result = getServerById(serverId, server.entries);
                if (result) return result;
            } else if (server.id === parseInt(serverId)) return server;
        }
        return null;
    };

    useEffect(() => { if (!sessionToken) setServers([]); }, [sessionToken]);

    return <ServerContext.Provider value={{ servers, loadServers, getServerById, retrieveServerById }}>{children}</ServerContext.Provider>;
};