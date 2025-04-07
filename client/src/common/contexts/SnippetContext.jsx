import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const SnippetContext = createContext({});

export const SnippetProvider = ({ children }) => {
    const [snippets, setSnippets] = useState([]);
    const { user, sessionToken } = useContext(UserContext);

    const loadSnippets = async () => {
        try {
            const response = await getRequest("/snippets/list");
            setSnippets(response);
        } catch (error) {
            console.error("Failed to load snippets", error.message);
        }
    };

    useEffect(() => {
        if (user) {
            loadSnippets();
        } else if (!sessionToken) {
            setSnippets([]);
        }
    }, [user]);

    return (
        <SnippetContext.Provider value={{ snippets, loadSnippets }}>
            {children}
        </SnippetContext.Provider>
    );
};

export const useSnippets = () => useContext(SnippetContext);