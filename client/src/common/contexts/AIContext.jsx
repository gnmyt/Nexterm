import { createContext, useContext, useState, useEffect } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const AIContext = createContext({});

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) throw new Error("useAI must be used within an AIProvider");

    return context;
};

export const AIProvider = ({ children }) => {
    const [aiSettings, setAISettings] = useState({ enabled: false, provider: null, model: null, configured: false });
    const [loading, setLoading] = useState(true);

    const loadAISettings = async () => {
        try {
            setLoading(true);
            const settings = await getRequest("ai");

            const configured = settings.enabled && settings.provider && settings.model
                && (settings.provider !== "openai" || settings.hasApiKey);

            setAISettings({
                enabled: settings.enabled,
                provider: settings.provider,
                model: settings.model,
                configured,
            });
        } catch (error) {
            setAISettings({ enabled: false, provider: null, model: null, configured: false });
        } finally {
            setLoading(false);
        }
    };

    const isAIAvailable = () => aiSettings.enabled && aiSettings.configured;

    useEffect(() => {
        loadAISettings();
    }, []);

    return (
        <AIContext.Provider value={{ aiSettings, loading, isAIAvailable, loadAISettings }}>
            {children}
        </AIContext.Provider>
    );
};
