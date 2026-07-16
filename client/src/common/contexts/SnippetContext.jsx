import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const SnippetContext = createContext({});

export const SnippetProvider = ({ children }) => {
    const [allSnippets, setAllSnippets] = useState([]);
    const [sourceSnippets, setSourceSnippets] = useState([]);
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

    const loadSourceSnippets = useCallback(async () => {
        try {
            setSourceSnippets((await getRequest("snippets/sources")) || []);
        } catch (error) {
            console.debug("Source snippets not available", error);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadSourceSnippets();
        } else if (!sessionToken) {
            setSourceSnippets([]);
        }
    }, [user, sessionToken, loadSourceSnippets]);

    useEffect(() => {
        if (!sessionToken) setAllSnippets([]);
    }, [sessionToken]);

    return (
        <SnippetContext.Provider value={{ allSnippets, sourceSnippets, loadAllSnippets, loadSourceSnippets }}>
            {children}
        </SnippetContext.Provider>
    );
};

export const useSnippets = () => useContext(SnippetContext);
