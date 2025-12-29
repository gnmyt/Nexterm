import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import i18n from "@/i18n.js";

const PreferencesContext = createContext({});

export const usePreferences = () => useContext(PreferencesContext);

const GROUP_SYNC_KEY_PREFIX = "preferences-sync-";
const LOCAL_PREFERENCES_KEY = "preferences";
const PREFERENCE_GROUPS = ["terminal", "theme", "files", "general"];

const DEFAULT_TERMINAL_THEMES = {
    default: {
        name: "Default",
        background: "#13181C",
        foreground: "#F5F5F5",
        brightWhite: "#FFFFFF",
        cursor: "#F5F5F5",
        black: "#000000",
        red: "#E25A5A",
        green: "#7FBF7F",
        yellow: "#FFBF7F",
        blue: "#7F7FBF",
        magenta: "#BF7FBF",
        cyan: "#7FBFBF",
        white: "#BFBFBF",
        brightBlack: "#404040",
        brightRed: "#FF6B6B",
        brightGreen: "#9ECEFF",
        brightYellow: "#FFD93D",
        brightBlue: "#9D9DFF",
        brightMagenta: "#FF9DFF",
        brightCyan: "#9DFFFF",
    },
    dracula: {
        name: "Dracula",
        background: "#282A36",
        foreground: "#F8F8F2",
        brightWhite: "#FFFFFF",
        cursor: "#F8F8F2",
        black: "#21222C",
        red: "#FF5555",
        green: "#50FA7B",
        yellow: "#F1FA8C",
        blue: "#BD93F9",
        magenta: "#FF79C6",
        cyan: "#8BE9FD",
        white: "#F8F8F2",
        brightBlack: "#6272A4",
        brightRed: "#FF6E6E",
        brightGreen: "#69FF94",
        brightYellow: "#FFFFA5",
        brightBlue: "#D6ACFF",
        brightMagenta: "#FF92DF",
        brightCyan: "#A4FFFF",
    },
    monokai: {
        name: "Monokai",
        background: "#272822",
        foreground: "#F8F8F2",
        brightWhite: "#F8F8F2",
        cursor: "#F8F8F0",
        black: "#272822",
        red: "#F92672",
        green: "#A6E22E",
        yellow: "#F4BF75",
        blue: "#66D9EF",
        magenta: "#AE81FF",
        cyan: "#A1EFE4",
        white: "#F8F8F2",
        brightBlack: "#75715E",
        brightRed: "#F92672",
        brightGreen: "#A6E22E",
        brightYellow: "#F4BF75",
        brightBlue: "#66D9EF",
        brightMagenta: "#AE81FF",
        brightCyan: "#A1EFE4",
    },
    solarizedDark: {
        name: "Solarized Dark",
        background: "#002B36",
        foreground: "#839496",
        brightWhite: "#FDF6E3",
        cursor: "#93A1A1",
        black: "#073642",
        red: "#DC322F",
        green: "#859900",
        yellow: "#B58900",
        blue: "#268BD2",
        magenta: "#D33682",
        cyan: "#2AA198",
        white: "#EEE8D5",
        brightBlack: "#002B36",
        brightRed: "#CB4B16",
        brightGreen: "#586E75",
        brightYellow: "#657B83",
        brightBlue: "#839496",
        brightMagenta: "#6C71C4",
        brightCyan: "#93A1A1",
    },
    nord: {
        name: "Nord",
        background: "#2E3440",
        foreground: "#D8DEE9",
        brightWhite: "#ECEFF4",
        cursor: "#D8DEE9",
        black: "#3B4252",
        red: "#BF616A",
        green: "#A3BE8C",
        yellow: "#EBCB8B",
        blue: "#81A1C1",
        magenta: "#B48EAD",
        cyan: "#88C0D0",
        white: "#E5E9F0",
        brightBlack: "#4C566A",
        brightRed: "#BF616A",
        brightGreen: "#A3BE8C",
        brightYellow: "#EBCB8B",
        brightBlue: "#81A1C1",
        brightMagenta: "#B48EAD",
        brightCyan: "#8FBCBB",
    },
    cyberpunk: {
        name: "Cyberpunk",
        background: "#0A0A0A",
        foreground: "#00FF41",
        brightWhite: "#FFFFFF",
        cursor: "#FF0080",
        black: "#0A0A0A",
        red: "#FF0080",
        green: "#00FF41",
        yellow: "#FFFF00",
        blue: "#0080FF",
        magenta: "#FF0080",
        cyan: "#00FFFF",
        white: "#C0C0C0",
        brightBlack: "#404040",
        brightRed: "#FF4080",
        brightGreen: "#40FF80",
        brightYellow: "#FFFF80",
        brightBlue: "#4080FF",
        brightMagenta: "#FF40FF",
        brightCyan: "#40FFFF",
    },
    ocean: {
        name: "Ocean",
        background: "#001122",
        foreground: "#A3D5FF",
        brightWhite: "#FFFFFF",
        cursor: "#00CCFF",
        black: "#001122",
        red: "#FF6B6B",
        green: "#4ECDC4",
        yellow: "#FFE66D",
        blue: "#5DADE2",
        magenta: "#BB8FCE",
        cyan: "#76D7C4",
        white: "#BDC3C7",
        brightBlack: "#34495E",
        brightRed: "#FF8A80",
        brightGreen: "#80CBC4",
        brightYellow: "#FFF176",
        brightBlue: "#81D4FA",
        brightMagenta: "#CE93D8",
        brightCyan: "#A7FFEB",
    },
    sunset: {
        name: "Sunset",
        background: "#2D1B69",
        foreground: "#FFE4B5",
        brightWhite: "#FFFFFF",
        cursor: "#FF6B35",
        black: "#2D1B69",
        red: "#FF6B35",
        green: "#F7931E",
        yellow: "#FFE135",
        blue: "#FF1744",
        magenta: "#E91E63",
        cyan: "#FF5722",
        white: "#FFE4B5",
        brightBlack: "#673AB7",
        brightRed: "#FF8A65",
        brightGreen: "#FFB74D",
        brightYellow: "#FFF176",
        brightBlue: "#FF5252",
        brightMagenta: "#F06292",
        brightCyan: "#FF8A50",
    },
    forest: {
        name: "Forest",
        background: "#0F2027",
        foreground: "#A8E6CF",
        brightWhite: "#FFFFFF",
        cursor: "#7FFFD4",
        black: "#0F2027",
        red: "#D2691E",
        green: "#228B22",
        yellow: "#DAA520",
        blue: "#4682B4",
        magenta: "#8B4513",
        cyan: "#20B2AA",
        white: "#A8E6CF",
        brightBlack: "#2F4F4F",
        brightRed: "#CD853F",
        brightGreen: "#32CD32",
        brightYellow: "#FFD700",
        brightBlue: "#87CEEB",
        brightMagenta: "#D2B48C",
        brightCyan: "#AFEEEE",
    },
    neon: {
        name: "Neon",
        background: "#0C0C0C",
        foreground: "#E0E0E0",
        brightWhite: "#FFFFFF",
        cursor: "#FF073A",
        black: "#0C0C0C",
        red: "#FF073A",
        green: "#39FF14",
        yellow: "#FFFF33",
        blue: "#0066FF",
        magenta: "#FF00FF",
        cyan: "#00FFFF",
        white: "#E0E0E0",
        brightBlack: "#333333",
        brightRed: "#FF4D6D",
        brightGreen: "#66FF66",
        brightYellow: "#FFFF66",
        brightBlue: "#3399FF",
        brightMagenta: "#FF66FF",
        brightCyan: "#66FFFF",
    },
    cherry: {
        name: "Cherry",
        background: "#1A0B1A",
        foreground: "#FFB6C1",
        brightWhite: "#FFFFFF",
        cursor: "#FF1493",
        black: "#1A0B1A",
        red: "#DC143C",
        green: "#FF69B4",
        yellow: "#FFB6C1",
        blue: "#DA70D6",
        magenta: "#FF1493",
        cyan: "#FF6347",
        white: "#FFB6C1",
        brightBlack: "#8B008B",
        brightRed: "#FF69B4",
        brightGreen: "#FFB6C1",
        brightYellow: "#FFCCCB",
        brightBlue: "#DDA0DD",
        brightMagenta: "#FF69B4",
        brightCyan: "#FF7F50",
    },
    matrix: {
        name: "Matrix",
        background: "#000000",
        foreground: "#00FF00",
        brightWhite: "#FFFFFF",
        cursor: "#00FF00",
        black: "#000000",
        red: "#008000",
        green: "#00FF00",
        yellow: "#ADFF2F",
        blue: "#32CD32",
        magenta: "#90EE90",
        cyan: "#98FB98",
        white: "#00FF00",
        brightBlack: "#006400",
        brightRed: "#228B22",
        brightGreen: "#7FFF00",
        brightYellow: "#CCFF99",
        brightBlue: "#66FF66",
        brightMagenta: "#B3FFB3",
        brightCyan: "#E0FFE0",
    },
};

const DEFAULT_FONTS = [
    { name: "Monospace", value: "monospace" },
    { name: "Fira Code", value: "'Fira Code', monospace" },
    { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
    { name: "Source Code Pro", value: "'Source Code Pro', monospace" },
    { name: "Inconsolata", value: "Inconsolata, monospace" },
    { name: "Ubuntu Mono", value: "'Ubuntu Mono', monospace" },
    { name: "Roboto Mono", value: "'Roboto Mono', monospace" },
    { name: "Hack", value: "Hack, monospace" },
];

const CURSOR_STYLES = [
    { name: "Block", value: "block" },
    { name: "Underline", value: "underline" },
    { name: "Bar", value: "bar" },
];

const ACCENT_COLORS = [
    { name: "Blue", value: "#314BD3" },
    { name: "Purple", value: "#7C3AED" },
    { name: "Pink", value: "#DB2777" },
    { name: "Red", value: "#DC2626" },
    { name: "Orange", value: "#EA580C" },
    { name: "Green", value: "#16A34A" },
    { name: "Teal", value: "#0D9488" },
    { name: "Cyan", value: "#0891B2" },
];

const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null) return undefined;
        current = current[key];
    }
    return current;
};

const setNestedValue = (obj, path, value) => {
    const keys = path.split(".");
    const result = JSON.parse(JSON.stringify(obj || {}));
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== "object") {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return result;
};

const getSystemTheme = () => {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        return "dark";
    }
    return "light";
};

export const PreferencesProvider = ({ children, user }) => {
    const [groupSyncEnabled, setGroupSyncEnabled] = useState(() => {
        const syncState = {};
        PREFERENCE_GROUPS.forEach(group => {
            const stored = localStorage.getItem(`${GROUP_SYNC_KEY_PREFIX}${group}`);
            syncState[group] = stored === null ? true : stored === "true";
        });
        return syncState;
    });

    const [preferences, setPreferences] = useState(() => {
        try {
            const stored = localStorage.getItem(LOCAL_PREFERENCES_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    const [isLoading, setIsLoading] = useState(!!user);
    const debounceRef = useRef(null);
    const pendingUpdatesRef = useRef({});

    const getGroupFromPath = useCallback((path) => {
        const group = path.split(".")[0];
        return PREFERENCE_GROUPS.includes(group) ? group : null;
    }, []);

    const isGroupSynced = useCallback((group) => {
        return groupSyncEnabled[group] || false;
    }, [groupSyncEnabled]);

    useEffect(() => {
        if (user) {
            const serverPrefs = user.preferences || {};
            setPreferences(prev => {
                const merged = { ...prev };
                PREFERENCE_GROUPS.forEach(group => {
                    if (groupSyncEnabled[group] && serverPrefs[group]) {
                        merged[group] = serverPrefs[group];
                    }
                });
                return merged;
            });
        }
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
        }
    }, [preferences, isLoading]);

    const flushToServer = useCallback(async () => {
        if (!user) return;
        
        const updates = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};
        
        if (Object.keys(updates).length === 0) return;
        
        try {
            const result = await patchRequest("accounts/me/preferences", updates);
            if (result.preferences) {
                setPreferences(prev => {
                    const merged = { ...prev };
                    PREFERENCE_GROUPS.forEach(group => {
                        if (groupSyncEnabled[group] && result.preferences[group]) {
                            merged[group] = result.preferences[group];
                        }
                    });
                    return merged;
                });
            }
        } catch (error) {
            console.error("Failed to sync preferences:", error);
        }
    }, [user, groupSyncEnabled]);

    const scheduleFlush = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            flushToServer();
        }, 500);
    }, [flushToServer]);

    const get = useCallback((path, fallback) => {
        const value = getNestedValue(preferences, path);
        return value !== undefined ? value : fallback;
    }, [preferences]);

    const set = useCallback((path, value) => {
        setPreferences(prev => setNestedValue(prev, path, value));
        const group = getGroupFromPath(path);
        if (group && groupSyncEnabled[group] && user) {
            const pathParts = path.split(".");
            let update = pendingUpdatesRef.current;
            for (let i = 0; i < pathParts.length - 1; i++) {
                const key = pathParts[i];
                if (!(key in update) || typeof update[key] !== "object") update[key] = {};
                update = update[key];
            }
            update[pathParts[pathParts.length - 1]] = value;
            scheduleFlush();
        }
    }, [getGroupFromPath, groupSyncEnabled, user, scheduleFlush]);

    const enableGroupSync = useCallback(async (group) => {
        if (!user || !PREFERENCE_GROUPS.includes(group)) return false;
        localStorage.setItem(`${GROUP_SYNC_KEY_PREFIX}${group}`, "true");
        setGroupSyncEnabled(prev => ({ ...prev, [group]: true }));
        const groupPrefs = preferences[group];
        if (groupPrefs) {
            try { await patchRequest("accounts/me/preferences", { [group]: groupPrefs }); }
            catch (e) { console.error(`Failed to sync ${group} preferences:`, e); }
        }
        return true;
    }, [user, preferences]);

    const disableGroupSync = useCallback((group) => {
        if (!PREFERENCE_GROUPS.includes(group)) return;
        localStorage.setItem(`${GROUP_SYNC_KEY_PREFIX}${group}`, "false");
        setGroupSyncEnabled(prev => ({ ...prev, [group]: false }));
    }, []);

    const toggleGroupSync = useCallback((group) => {
        if (groupSyncEnabled[group]) {
            disableGroupSync(group);
        } else {
            enableGroupSync(group);
        }
    }, [groupSyncEnabled, enableGroupSync, disableGroupSync]);

    const themeMode = get("theme.mode", "auto");
    const accentColor = get("theme.accentColor", "#314BD3");

    const actualTheme = themeMode === "auto" ? getSystemTheme() : themeMode;

    useEffect(() => {
        const applyTheme = (mode) => {
            if (mode === "auto") {
                document.documentElement.setAttribute("data-theme", getSystemTheme());
            } else {
                document.documentElement.setAttribute("data-theme", mode);
            }
        };

        applyTheme(themeMode);

        if (themeMode === "auto") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyTheme("auto");
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        }
    }, [themeMode]);

    useEffect(() => {
        document.documentElement.style.setProperty("--accent-color", accentColor);
    }, [accentColor]);

    const selectedTheme = get("terminal.theme", "default");
    const selectedFont = get("terminal.fontFamily", "monospace");
    const fontSize = get("terminal.fontSize", 16);
    const cursorStyle = get("terminal.cursorStyle", "block");
    const cursorBlink = get("terminal.cursorBlink", true);

    const getTerminalTheme = useCallback((theme) => {
        const baseTheme = DEFAULT_TERMINAL_THEMES[theme] || DEFAULT_TERMINAL_THEMES.default;
        if (themeMode === "oled" && theme === "default") {
            return { ...baseTheme, background: "#000000" };
        }
        return baseTheme;
    }, [themeMode]);

    const getCurrentTheme = useCallback(() => getTerminalTheme(selectedTheme), [getTerminalTheme, selectedTheme]);

    const getAvailableThemes = useCallback(() => Object.keys(DEFAULT_TERMINAL_THEMES).map(key => {
        const theme = DEFAULT_TERMINAL_THEMES[key];
        if (themeMode === "oled" && key === "default") {
            return { key, ...theme, background: "#000000" };
        }
        return { key, ...theme };
    }), [themeMode]);

    const getAvailableFonts = useCallback(() => DEFAULT_FONTS, []);
    const getCursorStyles = useCallback(() => CURSOR_STYLES, []);

    const setTheme = useCallback((mode) => set("theme.mode", mode), [set]);
    const setAccentColor = useCallback((color) => set("theme.accentColor", color), [set]);
    const toggleTheme = useCallback(() => {
        setTheme(themeMode === "auto" || themeMode === "dark" ? "light" : "dark");
    }, [setTheme, themeMode]);

    const setSelectedTheme = useCallback((theme) => set("terminal.theme", theme), [set]);
    const setSelectedFont = useCallback((font) => set("terminal.fontFamily", font), [set]);
    const setFontSize = useCallback((size) => set("terminal.fontSize", size), [set]);
    const setCursorStyle = useCallback((style) => set("terminal.cursorStyle", style), [set]);
    const setCursorBlink = useCallback((blink) => set("terminal.cursorBlink", blink), [set]);

    const showThumbnails = get("files.showThumbnails", true);
    const defaultViewMode = get("files.defaultViewMode", "list");
    const showHiddenFiles = get("files.showHiddenFiles", false);
    const confirmBeforeDelete = get("files.confirmBeforeDelete", true);
    const dragDropAction = get("files.dragDropAction", "ask");

    const setShowThumbnails = useCallback((v) => set("files.showThumbnails", v), [set]);
    const setDefaultViewMode = useCallback((v) => set("files.defaultViewMode", v), [set]);
    const setShowHiddenFiles = useCallback((v) => set("files.showHiddenFiles", v), [set]);
    const setConfirmBeforeDelete = useCallback((v) => set("files.confirmBeforeDelete", v), [set]);
    const setDragDropAction = useCallback((v) => set("files.dragDropAction", v), [set]);
    const toggleThumbnails = useCallback(() => setShowThumbnails(!showThumbnails), [setShowThumbnails, showThumbnails]);
    const toggleHiddenFiles = useCallback(() => setShowHiddenFiles(!showHiddenFiles), [setShowHiddenFiles, showHiddenFiles]);
    const toggleConfirmBeforeDelete = useCallback(() => setConfirmBeforeDelete(!confirmBeforeDelete), [setConfirmBeforeDelete, confirmBeforeDelete]);

    const language = get("general.language", null);
    const setLanguage = useCallback((lang) => set("general.language", lang), [set]);

    useEffect(() => {
        if (!isLoading && language && i18n.language !== language) {
            i18n.changeLanguage(language);
        }
    }, [language, isLoading]);

    return (
        <PreferencesContext.Provider value={{
            get, set, isLoading, preferences,
            isGroupSynced, enableGroupSync, disableGroupSync, toggleGroupSync,
            theme: actualTheme, themeMode, setTheme, toggleTheme, accentColor, setAccentColor, accentColors: ACCENT_COLORS,
            selectedTheme, setSelectedTheme, selectedFont, setSelectedFont, fontSize, setFontSize,
            cursorStyle, setCursorStyle, cursorBlink, setCursorBlink,
            getCurrentTheme, getTerminalTheme, getAvailableThemes, getAvailableFonts, getCursorStyles,
            isOledMode: themeMode === "oled",
            showThumbnails, setShowThumbnails, toggleThumbnails,
            defaultViewMode, setDefaultViewMode,
            showHiddenFiles, setShowHiddenFiles, toggleHiddenFiles,
            confirmBeforeDelete, setConfirmBeforeDelete, toggleConfirmBeforeDelete,
            dragDropAction, setDragDropAction,
            language, setLanguage,
        }}>
            {children}
        </PreferencesContext.Provider>
    );
};
