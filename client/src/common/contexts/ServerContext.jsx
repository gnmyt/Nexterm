import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const ServerContext = createContext({});

export const ServerProvider = ({ children }) => {

    const [servers, setServers] = useState(null);
    const { user, sessionToken } = useContext(UserContext);

    const loadServers = async () => {
        try {
            getRequest("/entries/list").then((response) => {
                setServers(response);
            });
        } catch (error) {
            console.error("Failed to load servers", error.message);
        }
    };

    const retrieveServerById = async (serverId) => {
        try {
            return await getRequest(`/entries/${serverId}`);
        } catch (error) {
            console.error("Failed to retrieve server", error.message);
        }
    };

    const getServerById = (serverId, entries) => {
        if (!entries) entries = servers;
        for (const server of entries) {
            if (server.type === "folder" || server.type === "organization") {
                const result = getServerById(serverId, server.entries);
                if (result) {
                    return result;
                }
            } else if (server.id === parseInt(serverId)) {
                return server;
            }
        }
        return null;
    };

    useEffect(() => {
        if (user) {
            loadServers();

            const interval = setInterval(() => {
                loadServers();
            }, 5000);

            return () => clearInterval(interval);
        } else if (!sessionToken) {
            setServers([]);
        }
    }, [user]);

    return (
        <ServerContext.Provider
            value={{ servers, loadServers, getServerById, retrieveServerById }}>
            {children}
        </ServerContext.Provider>
    );
};