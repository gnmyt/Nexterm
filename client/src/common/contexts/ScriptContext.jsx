import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const ScriptContext = createContext({});

export const ScriptProvider = ({ children }) => {
    const [scripts, setScripts] = useState([]);
    const [allScripts, setAllScripts] = useState([]);
    const { user, sessionToken } = useContext(UserContext);

    const loadScripts = async (organizationId = null) => {
        try {
            const url = organizationId 
                ? `/scripts?organizationId=${organizationId}`
                : "/scripts";
            const response = await getRequest(url);
            setScripts(response);
        } catch (error) {
            console.error("Failed to load scripts", error.message);
        }
    };

    const loadAllScripts = async () => {
        try {
            const response = await getRequest("/scripts/all");
            setAllScripts(response);
        } catch (error) {
            console.error("Failed to load all scripts", error.message);
        }
    };

    useEffect(() => {
        if (user) {
            loadScripts();
            loadAllScripts();
        } else if (!sessionToken) {
            setScripts([]);
            setAllScripts([]);
        }
    }, [user]);

    return (
        <ScriptContext.Provider value={{ scripts, allScripts, loadScripts, loadAllScripts }}>
            {children}
        </ScriptContext.Provider>
    );
};

export const useScripts = () => useContext(ScriptContext);
