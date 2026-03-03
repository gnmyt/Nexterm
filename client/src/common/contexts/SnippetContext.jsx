import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const SnippetContext = createContext({});

export const SnippetProvider = ({ children }) => {
    const [allSnippets, setAllSnippets] = useState([]);
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.SNIPPETS, setAllSnippets);
    }, [user, registerHandler]);

    const loadAllSnippets = useCallback(async () => {
        try {
            setAllSnippets(await getRequest("/snippets/all"));
        } catch {}
    }, []);

    useEffect(() => {
        if (!sessionToken) setAllSnippets([]);
    }, [sessionToken]);

    return <SnippetContext.Provider value={{ allSnippets, loadAllSnippets }}>{children}</SnippetContext.Provider>;
};

export const useSnippets = () => useContext(SnippetContext);