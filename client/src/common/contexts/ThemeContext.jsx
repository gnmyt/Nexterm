import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";
import { patchRequest } from "@/common/utils/RequestUtil.js";

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

const DEFAULT_ACCENT_COLOR = "#314BD3";

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

const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return "dark";
    }
    return "light";
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        return savedTheme || "auto";
    });

    const [accentColor, setAccentColorState] = useState(() => {
        return localStorage.getItem("accentColor") || DEFAULT_ACCENT_COLOR;
    });

    const [actualTheme, setActualTheme] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        if (!savedTheme || savedTheme === "auto") {
            return getSystemTheme();
        }
        return savedTheme;
    });

    const [overrideAppearance, setOverrideAppearance] = useState(() => {
        const saved = localStorage.getItem("override_appearance");
        return saved ? saved === "true" : false;
    });

    const wsRef = useRef(null);

    useEffect(() => {
        localStorage.setItem("override_appearance", overrideAppearance.toString());
    }, [overrideAppearance]);

    useEffect(() => {
        if (themeMode === "auto") {
            const updateTheme = () => {
                const systemTheme = getSystemTheme();
                setActualTheme(systemTheme);
                document.documentElement.setAttribute("data-theme", systemTheme);
            };

            updateTheme();

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => {
                const newTheme = e.matches ? "dark" : "light";
                setActualTheme(newTheme);
                document.documentElement.setAttribute("data-theme", newTheme);
            };

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            setActualTheme(themeMode === "oled" ? "oled" : themeMode);
            document.documentElement.setAttribute("data-theme", themeMode);
        }
    }, [themeMode]);

    useEffect(() => {
        localStorage.setItem("theme", themeMode);
    }, [themeMode]);

    useEffect(() => {
        document.documentElement.style.setProperty("--accent-color", accentColor);
        localStorage.setItem("accentColor", accentColor);
    }, [accentColor]);

    // When user re-enables syncing (overrideAppearance === false), commit current appearance values
    useEffect(() => {
        if (!overrideAppearance) {
            try {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "appearance", values: { themeMode, accentColor } }));
                }
            } catch {}
            try { patchRequest("accounts/preferences", { group: "appearance", values: { themeMode, accentColor } }); } catch {}
        }
    }, [overrideAppearance]);

    useEffect(() => {
        const token = localStorage.getItem("sessionToken") || localStorage.getItem("overrideToken");
        if (!token) return;
        const wsUrl = getWebSocketUrl("/api/ws/state", { sessionToken: token, tabId: getTabId(), browserId: getBrowserId() });
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.addEventListener("message", (ev) => {
            try {
                const { type, data } = JSON.parse(ev.data);
                if (type === "PREFERENCES" && data?.group === "appearance") {
                    if (overrideAppearance) return;
                    const { values } = data;
                    if (values?.themeMode) setThemeMode(values.themeMode);
                    if (values?.accentColor) setAccentColorState(values.accentColor);
                }
            } catch {}
        });
        return () => {
            try { ws.close(); } catch {};
            wsRef.current = null;
        };
    }, [overrideAppearance]);

    const setTheme = (mode) => {
        setThemeMode(mode);
        try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !overrideAppearance) {
                wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "appearance", values: { themeMode: mode } }));
            }
        } catch {}
        try { if (!overrideAppearance) patchRequest("accounts/preferences", { group: "appearance", values: { themeMode: mode } }); } catch {}
    };

    const setAccentColor = (color) => {
        setAccentColorState(color);
        try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !overrideAppearance) {
                wsRef.current.send(JSON.stringify({ action: "preferencesUpdate", group: "appearance", values: { accentColor: color } }));
            }
        } catch {}
        try { if (!overrideAppearance) patchRequest("accounts/preferences", { group: "appearance", values: { accentColor: color } }); } catch {}
    };

    const toggleTheme = () => {
        setThemeMode(prevMode => {
            if (prevMode === "auto" || prevMode === "dark") return "light";
            return "dark";
        });
    };

    return (
        <ThemeContext.Provider value={{ 
            theme: actualTheme, 
            themeMode, 
            setTheme, 
            toggleTheme, 
            accentColor, 
            setAccentColor, 
            accentColors: ACCENT_COLORS,
            overrideAppearance,
            setOverrideAppearance,
        }}>
            {children}
        </ThemeContext.Provider>
    );
};