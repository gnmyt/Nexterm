import { lazy, Suspense, useEffect } from "react";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";

const AssistantWindow = lazy(() => import("./AssistantWindow.jsx"));

export const AIAssistant = () => {
    const { assistantOpen, toggleAssistant, isAIAvailable } = useAI();
    const { getParsedKeybind } = useKeymaps();
    const available = isAIAvailable();

    useEffect(() => {
        if (!available) return;
        const handleKeyDown = (event) => {
            const keybind = getParsedKeybind?.("ai-menu");
            if (!keybind || !matchesKeybind(event, keybind)) return;
            event.preventDefault();
            toggleAssistant();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [available, getParsedKeybind, toggleAssistant]);

    if (!available || !assistantOpen) return null;
    return <Suspense fallback={null}><AssistantWindow /></Suspense>;
};

