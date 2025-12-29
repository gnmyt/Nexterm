import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";
import { patchRequest, getRequest } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { hasPreferenceOverride, readPreferenceOverride, writePreferenceOverride, removePreferenceOverride } from "@/common/utils/PreferenceOverrideUtil.js";

const TerminalSettingsContext = createContext({});

export const useTerminalSettings = () => useContext(TerminalSettingsContext);

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

export const TerminalSettingsProvider = ({ children }) => {
    const { themeMode } = useTheme();
    const { user } = useContext(UserContext);

    const getTerminalPrefsFrom = (prefs) => {
        const root = prefs && typeof prefs === "object" ? prefs : {};
        const terminal = root.terminal && typeof root.terminal === "object" ? root.terminal : {};
        const font = terminal.font && typeof terminal.font === "object" ? terminal.font : {};
        const cursor = terminal.cursor && typeof terminal.cursor === "object" ? terminal.cursor : {};
        const theme = terminal.theme && typeof terminal.theme === "object" ? terminal.theme : {};

        const selectedFont = font.selectedFont ?? terminal.selectedFont ?? root.selectedFont;
        const fontSize = font.fontSize ?? terminal.fontSize ?? root.fontSize;
        const cursorStyle = cursor.cursorStyle ?? terminal.cursorStyle ?? root.cursorStyle;
        const cursorBlink = cursor.cursorBlink ?? terminal.cursorBlink ?? root.cursorBlink;
        const selectedTheme = theme.selectedTheme ?? terminal.selectedTheme ?? root.selectedTheme;

        return {
            selectedFont: typeof selectedFont === "string" ? selectedFont : undefined,
            fontSize: typeof fontSize === "number" ? fontSize : (typeof fontSize === "string" ? parseInt(fontSize) : undefined),
            cursorStyle: typeof cursorStyle === "string" ? cursorStyle : undefined,
            cursorBlink: typeof cursorBlink === "boolean" ? cursorBlink : (typeof cursorBlink === "string" ? cursorBlink === "true" : undefined),
            selectedTheme: typeof selectedTheme === "string" ? selectedTheme : undefined,
        };
    };
    
    const [selectedTheme, setSelectedTheme] = useState(() => {
        const saved = localStorage.getItem("terminal-theme");
        return saved && DEFAULT_TERMINAL_THEMES[saved] ? saved : "default";
    });

    const [selectedFont, setSelectedFont] = useState(() => {
        const saved = localStorage.getItem("terminal-font");
        const validFont = DEFAULT_FONTS.find(font => font.value === saved);
        return validFont ? saved : "monospace";
    });

    const [fontSize, setFontSize] = useState(() => {
        const saved = localStorage.getItem("terminal-font-size");
        const parsedSize = saved ? parseInt(saved) : 16;
        return parsedSize >= 10 && parsedSize <= 32 ? parsedSize : 16;
    });

    const [cursorStyle, setCursorStyle] = useState(() => {
        const saved = localStorage.getItem("terminal-cursor-style");
        const validStyle = CURSOR_STYLES.find(style => style.value === saved);
        return validStyle ? saved : "block";
    });

    const [cursorBlink, setCursorBlink] = useState(() => {
        const saved = localStorage.getItem("terminal-cursor-blink");
        return saved ? saved === "true" : true;
    });

    const [overrideFont, setOverrideFont] = useState(() => {
        return false;
    });
    const [overrideCursor, setOverrideCursor] = useState(() => {
        return false;
    });
    const [overrideTheme, setOverrideTheme] = useState(() => {
        return false;
    });

    const wsRef = useRef(null);
    const suppressFontSyncRef = useRef(false);
    const suppressCursorSyncRef = useRef(false);
    const suppressThemeSyncRef = useRef(false);

    useEffect(() => {
        if (!user?.id) return;

        suppressFontSyncRef.current = true;
        suppressCursorSyncRef.current = true;
        suppressThemeSyncRef.current = true;

        const localFont = readPreferenceOverride(user.id, "terminal_font");
        const localCursor = readPreferenceOverride(user.id, "terminal_cursor");
        const localTheme = readPreferenceOverride(user.id, "terminal_theme");

        if (localFont) {
            if (!overrideFont) setOverrideFont(true);
            if (localFont?.selectedFont) setSelectedFont(localFont.selectedFont);
            if (localFont?.fontSize) setFontSize(localFont.fontSize);
        } else {
            if (overrideFont) setOverrideFont(false);
        }

        if (localCursor) {
            if (!overrideCursor) setOverrideCursor(true);
            if (localCursor?.cursorStyle) setCursorStyle(localCursor.cursorStyle);
            if (typeof localCursor?.cursorBlink !== "undefined") setCursorBlink(localCursor.cursorBlink);
        } else {
            if (overrideCursor) setOverrideCursor(false);
        }

        if (localTheme) {
            if (!overrideTheme) setOverrideTheme(true);
            if (localTheme?.selectedTheme) setSelectedTheme(localTheme.selectedTheme);
        } else {
            if (overrideTheme) setOverrideTheme(false);
        }

        const serverTerminal = getTerminalPrefsFrom(user?.preferences);

        if (!localFont) {
            if (serverTerminal.selectedFont) setSelectedFont(serverTerminal.selectedFont);
            if (typeof serverTerminal.fontSize === "number") setFontSize(serverTerminal.fontSize);
        }

        if (!localCursor) {
            if (serverTerminal.cursorStyle) setCursorStyle(serverTerminal.cursorStyle);
            if (typeof serverTerminal.cursorBlink !== "undefined") setCursorBlink(serverTerminal.cursorBlink);
        }

        if (!localTheme) {
            if (serverTerminal.selectedTheme) setSelectedTheme(serverTerminal.selectedTheme);
        }

        setTimeout(() => {
            suppressFontSyncRef.current = false;
            suppressCursorSyncRef.current = false;
            suppressThemeSyncRef.current = false;
        }, 0);
    }, [user]);

    useEffect(() => {
        localStorage.setItem("terminal-theme", selectedTheme);
    }, [selectedTheme]);

    useEffect(() => {
        localStorage.setItem("terminal-font", selectedFont);
    }, [selectedFont]);

    useEffect(() => {
        localStorage.setItem("terminal-font-size", fontSize.toString());
    }, [fontSize]);

    useEffect(() => {
        localStorage.setItem("terminal-cursor-style", cursorStyle);
    }, [cursorStyle]);

    useEffect(() => {
        localStorage.setItem("terminal-cursor-blink", cursorBlink.toString());
    }, [cursorBlink]);

    useEffect(() => {
        if (!overrideFont) return;
        if (!user?.id) return;
        if (!hasPreferenceOverride(user.id, "terminal_font")) return;
        writePreferenceOverride(user.id, "terminal_font", { selectedFont, fontSize });
    }, [selectedFont, fontSize, overrideFont, user]);

    useEffect(() => {
        if (!overrideCursor) return;
        if (!user?.id) return;
        if (!hasPreferenceOverride(user.id, "terminal_cursor")) return;
        writePreferenceOverride(user.id, "terminal_cursor", { cursorStyle, cursorBlink });
    }, [cursorStyle, cursorBlink, overrideCursor, user]);

    useEffect(() => {
        if (!overrideTheme) return;
        if (!user?.id) return;
        if (!hasPreferenceOverride(user.id, "terminal_theme")) return;
        writePreferenceOverride(user.id, "terminal_theme", { selectedTheme });
    }, [selectedTheme, overrideTheme, user]);

    useEffect(() => {
        const token = localStorage.getItem("sessionToken") || localStorage.getItem("overrideToken");
        if (!token) return;
        const wsUrl = getWebSocketUrl("/api/ws/state", { sessionToken: token, tabId: getTabId(), browserId: getBrowserId() });
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.addEventListener("message", (ev) => {
            try {
                const { type, data } = JSON.parse(ev.data);
                if (type === "PREFERENCES" && data?.group === "terminal") {
                    const values = data.values || {};
                    // values may be nested: { font: {...}, cursor: {...}, theme: {...} }
                    if (values.font && !overrideFont) {
                        const f = values.font;
                        if (f.selectedFont) setSelectedFont(f.selectedFont);
                        if (f.fontSize) setFontSize(f.fontSize);
                    }
                    if (values.cursor && !overrideCursor) {
                        const c = values.cursor;
                        if (c.cursorStyle) setCursorStyle(c.cursorStyle);
                        if (typeof c.cursorBlink !== 'undefined') setCursorBlink(c.cursorBlink);
                    }
                    if (values.theme && !overrideTheme) {
                        const th = values.theme;
                        if (th.selectedTheme) setSelectedTheme(th.selectedTheme);
                    }
                    // legacy flat values support
                    if (!values.font && !values.cursor && !values.theme) {
                        if (!overrideTheme && values.selectedTheme) setSelectedTheme(values.selectedTheme);
                        if (!overrideFont && values.selectedFont) setSelectedFont(values.selectedFont);
                        if (!overrideFont && values.fontSize) setFontSize(values.fontSize);
                        if (!overrideCursor && values.cursorStyle) setCursorStyle(values.cursorStyle);
                        if (!overrideCursor && typeof values.cursorBlink !== 'undefined') setCursorBlink(values.cursorBlink);
                    }
                }
            } catch {}
        });
        return () => {
            try { ws.close(); } catch {}
            wsRef.current = null;
        };
    }, [overrideFont, overrideCursor, overrideTheme]);

    const getTerminalTheme = (theme) => {
        const baseTheme = DEFAULT_TERMINAL_THEMES[theme] || DEFAULT_TERMINAL_THEMES.default;
        if (themeMode === "oled" && theme === "default") {
            return { ...baseTheme, background: "#000000" };
        }
        return baseTheme;
    };
    const getCurrentTheme = () => getTerminalTheme(selectedTheme);
    const getAvailableThemes = () => Object.keys(DEFAULT_TERMINAL_THEMES).map(key => {
        const theme = DEFAULT_TERMINAL_THEMES[key];
        if (themeMode === "oled" && key === "default") {
            return { key, ...theme, background: "#000000" };
        }
        return { key, ...theme };
    });
    const getAvailableFonts = () => DEFAULT_FONTS;
    const getCursorStyles = () => CURSOR_STYLES;

    // broadcast updates per subgroup when changed and not overridden
    useEffect(() => {
        try {
            if (suppressFontSyncRef.current) return;
            if (!user?.id) return;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !overrideFont) {
                wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "terminal", values: { font: { selectedFont, fontSize } } }));
            }
        } catch {}
        try { if (!overrideFont && !suppressFontSyncRef.current && user?.id) patchRequest("accounts/preferences", { group: "terminal", values: { font: { selectedFont, fontSize } } }); } catch {}
    }, [selectedFont, fontSize, overrideFont]);

    useEffect(() => {
        try {
            if (suppressCursorSyncRef.current) return;
            if (!user?.id) return;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !overrideCursor) {
                wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "terminal", values: { cursor: { cursorStyle, cursorBlink } } }));
            }
        } catch {}
        try { if (!overrideCursor && !suppressCursorSyncRef.current && user?.id) patchRequest("accounts/preferences", { group: "terminal", values: { cursor: { cursorStyle, cursorBlink } } }); } catch {}
    }, [cursorStyle, cursorBlink, overrideCursor]);

    useEffect(() => {
        try {
            if (suppressThemeSyncRef.current) return;
            if (!user?.id) return;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !overrideTheme) {
                wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "terminal", values: { theme: { selectedTheme } } }));
            }
        } catch {}
        try { if (!overrideTheme && !suppressThemeSyncRef.current && user?.id) patchRequest("accounts/preferences", { group: "terminal", values: { theme: { selectedTheme } } }); } catch {}
    }, [selectedTheme, overrideTheme]);

    const setOverrideFontPreference = (value) => {
        const next = typeof value === "function" ? value(overrideFont) : value;
        if (user?.id) {
            if (next) {
                writePreferenceOverride(user.id, "terminal_font", { selectedFont, fontSize });
                setOverrideFont(true);
                return;
            } else {
                removePreferenceOverride(user.id, "terminal_font");
                suppressFontSyncRef.current = true;

                (async () => {
                    let prefs;
                    try {
                        const me = await getRequest("accounts/me");
                        prefs = me?.preferences;
                    } catch {
                        prefs = user?.preferences;
                    }

                    const serverTerminal = getTerminalPrefsFrom(prefs);
                    if (serverTerminal.selectedFont) setSelectedFont(serverTerminal.selectedFont);
                    if (typeof serverTerminal.fontSize === "number") setFontSize(serverTerminal.fontSize);
                    setOverrideFont(false);
                    setTimeout(() => { suppressFontSyncRef.current = false; }, 0);
                })();
                return;
            }
        }
        setOverrideFont(next);
    };

    const setOverrideCursorPreference = (value) => {
        const next = typeof value === "function" ? value(overrideCursor) : value;
        if (user?.id) {
            if (next) {
                writePreferenceOverride(user.id, "terminal_cursor", { cursorStyle, cursorBlink });
                setOverrideCursor(true);
                return;
            } else {
                removePreferenceOverride(user.id, "terminal_cursor");
                suppressCursorSyncRef.current = true;

                (async () => {
                    let prefs;
                    try {
                        const me = await getRequest("accounts/me");
                        prefs = me?.preferences;
                    } catch {
                        prefs = user?.preferences;
                    }

                    const serverTerminal = getTerminalPrefsFrom(prefs);
                    if (serverTerminal.cursorStyle) setCursorStyle(serverTerminal.cursorStyle);
                    if (typeof serverTerminal.cursorBlink !== "undefined") setCursorBlink(serverTerminal.cursorBlink);
                    setOverrideCursor(false);
                    setTimeout(() => { suppressCursorSyncRef.current = false; }, 0);
                })();
                return;
            }
        }
        setOverrideCursor(next);
    };

    const setOverrideThemePreference = (value) => {
        const next = typeof value === "function" ? value(overrideTheme) : value;
        if (user?.id) {
            if (next) {
                writePreferenceOverride(user.id, "terminal_theme", { selectedTheme });
                setOverrideTheme(true);
                return;
            } else {
                removePreferenceOverride(user.id, "terminal_theme");
                suppressThemeSyncRef.current = true;

                (async () => {
                    let prefs;
                    try {
                        const me = await getRequest("accounts/me");
                        prefs = me?.preferences;
                    } catch {
                        prefs = user?.preferences;
                    }

                    const serverTerminal = getTerminalPrefsFrom(prefs);
                    if (serverTerminal.selectedTheme) setSelectedTheme(serverTerminal.selectedTheme);
                    setOverrideTheme(false);
                    setTimeout(() => { suppressThemeSyncRef.current = false; }, 0);
                })();
                return;
            }
        }
        setOverrideTheme(next);
    };

    return (
        <TerminalSettingsContext.Provider value={{
            selectedTheme, setSelectedTheme, selectedFont, setSelectedFont,
            fontSize, setFontSize, cursorStyle, setCursorStyle, cursorBlink, setCursorBlink,
            getCurrentTheme, getTerminalTheme, getAvailableThemes, getAvailableFonts, getCursorStyles,
            isOledMode: themeMode === "oled",
            overrideFont,
            setOverrideFont: setOverrideFontPreference,
            overrideCursor,
            setOverrideCursor: setOverrideCursorPreference,
            overrideTheme,
            setOverrideTheme: setOverrideThemePreference,
        }}>
            {children}
        </TerminalSettingsContext.Provider>
    );
};
