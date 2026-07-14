import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const AIContext = createContext({});

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) throw new Error("useAI must be used within an AIProvider");

    return context;
};

export const AIProvider = ({ children }) => {
    const [available, setAvailable] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadAISettings = useCallback(async () => {
        try {
            setLoading(true);
            const settings = await getRequest("ai");
            setAvailable(Boolean(settings.isConfigured));
        } catch {
            setAvailable(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const isAIAvailable = useCallback(() => available, [available]);

    useEffect(() => {
        loadAISettings();
    }, [loadAISettings]);

    const value = useMemo(
        () => ({ available, loading, isAIAvailable, loadAISettings }),
        [available, loading, isAIAvailable, loadAISettings],
    );

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
};
