import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const ServerContext = createContext({});

export const ServerProvider = ({ children }) => {

    const [servers, setServers] = useState(null);
    const {user, sessionToken} = useContext(UserContext);

    const loadServers = async () => {
        try {
            getRequest("/servers/list").then((response) => {
                setServers(response);
            });
        } catch (error) {
            console.error("Failed to load servers", error.message);
        }
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
        <ServerContext.Provider value={{servers, loadServers}}>
            {children}
        </ServerContext.Provider>
    )
}