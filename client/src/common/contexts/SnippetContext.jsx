import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const SnippetContext = createContext({});

export const SnippetProvider = ({ children }) => {
    const [allSnippets, setAllSnippets] = useState([]);
    const { user, sessionToken } = useContext(UserContext);

    const loadAllSnippets = async () => {
        try {
            const response = await getRequest("/snippets/all");
            setAllSnippets(response);
        } catch (error) {
            console.error("Failed to load all snippets", error.message);
        }
    };

    useEffect(() => {
        if (user) {
            loadAllSnippets();

            const interval = setInterval(() => {
                loadAllSnippets();
            }, 5000);

            return () => clearInterval(interval);
        } else if (!sessionToken) {
            setAllSnippets([]);
        }
    }, [user]);

    return (
        <SnippetContext.Provider value={{ allSnippets, loadAllSnippets }}>
            {children}
        </SnippetContext.Provider>
    );
};

export const useSnippets = () => useContext(SnippetContext);