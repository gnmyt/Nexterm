import { createContext, useContext, useState, useEffect } from "react";
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

    const loadAISettings = async () => {
        try {
            setLoading(true);
            const settings = await getRequest("ai");
            setAvailable(Boolean(settings.isConfigured));
        } catch (error) {
            setAvailable(false);
        } finally {
            setLoading(false);
        }
    };

    const isAIAvailable = () => available;

    useEffect(() => {
        loadAISettings();
    }, []);

    return (
        <AIContext.Provider value={{ available, loading, isAIAvailable, loadAISettings }}>
            {children}
        </AIContext.Provider>
    );
};
