import { useEffect, useCallback } from "react";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";

export const GlobalKeyboardHandler = () => {
    const { getParsedKeybind } = useKeymaps();
    const navigate = useNavigate();
    const location = useLocation();

    const handleKeyPress = useCallback((event) => {
        const { tagName, isContentEditable } = event.target;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || isContentEditable) return;

        const searchKeybind = getParsedKeybind("search");
        if (searchKeybind && matchesKeybind(event, searchKeybind)) {
            event.preventDefault();
            if (location.pathname.startsWith("/servers") || location.pathname.startsWith("/apps")) {
                document.querySelector(".search-input")?.focus();
            }
            return;
        }

        if (!location.pathname.startsWith("/servers")) {
            const keyboardShortcutsKeybind = getParsedKeybind("keyboard-shortcuts");
            if (keyboardShortcutsKeybind && matchesKeybind(event, keyboardShortcutsKeybind)) {
                event.preventDefault();
                navigate("/settings/keymaps");
            }
        }
    }, [getParsedKeybind, navigate, location]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyPress);
        return () => {
            document.removeEventListener("keydown", handleKeyPress);
        };
    }, [handleKeyPress]);

    return null;
};