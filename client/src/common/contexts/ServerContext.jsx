import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";

export const ServerContext = createContext({});

export const ServerProvider = ({ children }) => {

    const [servers, setServers] = useState(null);
    const {user, sessionToken} = useContext(UserContext);

    const loadServers = async () => {
        try {
            postRequest("pve-servers/refresh").then(() => {});

            getRequest("/servers/list").then((response) => {
                setServers(response);
            });
        } catch (error) {
            console.error("Failed to load servers", error.message);
        }
    }

    const retrieveServerById = async (serverId) => {
        try {
            return await getRequest(`/servers/${serverId}`);
        } catch (error) {
            console.error("Failed to retrieve server", error.message);
        }
    }

    const getPVEServerById = (serverId, entries) => {
        if (!entries) entries = servers;
        for (const server of entries) {
            if (server.id === parseInt(serverId) && server.type === "pve-server") {
                return server;
            } else if (server.type === "folder") {
                const result = getPVEServerById(serverId, server.entries);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

    const getPVEContainerById = (serverId, containerId) => {
        const pveServer = getPVEServerById(serverId);
        if (!pveServer) return null;

        for (const container of pveServer.entries) {
            if (container.id === parseInt(containerId)) {
                return container;
            }
        }
    }

    const getServerById = (serverId, entries) => {
        if (!entries) entries = servers;
        for (const server of entries) {
            if (server.id === parseInt(serverId) && server.type === "server") {
                return server;
            } else if (server.type === "folder") {
                const result = getServerById(serverId, server.entries);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

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
        <ServerContext.Provider value={{servers, loadServers, getServerById, getPVEServerById, getPVEContainerById, retrieveServerById}}>
            {children}
        </ServerContext.Provider>
    )
}