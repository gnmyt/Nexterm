import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const AIContext = createContext({});

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) throw new Error("useAI must be used within an AIProvider");

    return context;
};

const MODE_KEY = "nexterm.ai.approvalMode";
export const APPROVAL_MODES = ["ask", "allow", "readonly"];

export const AIProvider = ({ children }) => {
    const [available, setAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [approvalMode, setApprovalModeState] = useState(() => {
        try {
            const stored = localStorage.getItem(MODE_KEY);
            return APPROVAL_MODES.includes(stored) ? stored : "ask";
        } catch {
            return "ask";
        }
    });

    const setApprovalMode = useCallback((mode) => {
        if (!APPROVAL_MODES.includes(mode)) return;
        setApprovalModeState(mode);
        try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    }, []);

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

    const openAssistant = useCallback(() => setAssistantOpen(true), []);
    const closeAssistant = useCallback(() => setAssistantOpen(false), []);
    const toggleAssistant = useCallback(() => setAssistantOpen((open) => !open), []);

    useEffect(() => {
        loadAISettings();
    }, [loadAISettings]);

    const value = useMemo(
        () => ({
            available, loading, isAIAvailable, loadAISettings,
            assistantOpen, openAssistant, closeAssistant, toggleAssistant,
            approvalMode, setApprovalMode,
        }),
        [available, loading, isAIAvailable, loadAISettings, assistantOpen, openAssistant, closeAssistant, toggleAssistant,
            approvalMode, setApprovalMode],
    );

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
};
