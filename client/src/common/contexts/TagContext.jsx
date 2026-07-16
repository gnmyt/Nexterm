import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const TagContext = createContext({});

export const TagProvider = ({ children }) => {
    const [tags, setTags] = useState([]);
    const { user, sessionToken } = useContext(UserContext);

    const loadTags = useCallback(async () => {
        try {
            setTags(await getRequest("tags/list"));
        } catch (error) {
            console.error("Failed to load tags", error.message);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadTags();
        } else if (!sessionToken) {
            setTags([]);
        }
    }, [user, sessionToken, loadTags]);

    return <TagContext.Provider value={{ tags, loadTags }}>{children}</TagContext.Provider>;
};

export const useTags = () => useContext(TagContext);