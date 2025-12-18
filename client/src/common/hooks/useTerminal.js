import { useEffect, useRef, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { useTerminalSettings } from "@/common/contexts/TerminalSettingsContext.jsx";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export const buildTerminalWebSocketUrl = (sessionToken, session) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NODE_ENV === "production" 
        ? `${window.location.host}/api/ws/term` 
        : "localhost:6989/api/ws/term";

    return `${protocol}://${host}?sessionToken=${sessionToken}&sessionId=${session.id}`;
};

export const createTerminalTheme = (appTheme, terminalTheme, selectedTheme) => {
    const isLightTerminalTheme = selectedTheme === "light";
    const isLightMode = appTheme === "light" && isLightTerminalTheme;

    return {
        background: isLightMode ? "#F3F3F3" : terminalTheme.background,
        foreground: isLightMode ? "#000000" : terminalTheme.foreground,
        black: terminalTheme.black,
        red: terminalTheme.red,
        green: terminalTheme.green,
        yellow: terminalTheme.yellow,
        blue: terminalTheme.blue,
        magenta: terminalTheme.magenta,
        cyan: terminalTheme.cyan,
        white: terminalTheme.white,
        brightBlack: terminalTheme.brightBlack,
        brightRed: terminalTheme.brightRed,
        brightGreen: terminalTheme.brightGreen,
        brightYellow: terminalTheme.brightYellow,
        brightBlue: terminalTheme.brightBlue,
        brightMagenta: terminalTheme.brightMagenta,
        brightCyan: terminalTheme.brightCyan,
        brightWhite: isLightMode ? "#464545" : terminalTheme.brightWhite,
        cursor: isLightMode ? "#000000" : terminalTheme.cursor,
    };
};

export const useTerminal = (containerRef, session, options = {}) => {
    const {
        onMessage,
        onOpen,
        onClose,
        onError,
        onData,
        onReady,
        restoreContent,
    } = options;

    const termRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);

    const { sessionToken } = useContext(UserContext);
    const { theme } = useTheme();
    const { getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme, isOledMode } = useTerminalSettings();

    useEffect(() => {
        if (!sessionToken || !containerRef.current) return;

        let isCleaningUp = false;

        const terminalTheme = getCurrentTheme();
        const term = new Xterm({
            cursorBlink,
            cursorStyle,
            fontSize,
            fontFamily: selectedFont,
            theme: createTerminalTheme(theme, terminalTheme, selectedTheme),
        });

        termRef.current = term;

        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        if (restoreContent?.length > 0) {
            restoreContent.forEach(content => term.write(content));
        }

        const handleResize = () => {
            fitAddon.fit();
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(`\x01${term.cols},${term.rows}`);
            }
        };

        window.addEventListener("resize", handleResize);

        const wsUrl = buildTerminalWebSocketUrl(sessionToken, session);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) handleResize();
        }, 300);

        ws.onopen = () => {
            ws.send(`\x01${term.cols},${term.rows}`);
            onOpen?.(term, ws);
        };

        ws.onclose = () => {
            clearInterval(interval);
            if (!isCleaningUp) {
                onClose?.(term, ws);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (!isCleaningUp) {
                onError?.(error, term, ws);
            }
        };

        ws.onmessage = (event) => {
            onMessage?.(event, term, ws);
        };

        if (onData) {
            term.onData((data) => onData(data, term, ws));
        }

        onReady?.(term, ws);

        return () => {
            isCleaningUp = true;
            window.removeEventListener("resize", handleResize);
            clearInterval(interval);
            
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            }
            
            term.dispose();
            termRef.current = null;
            wsRef.current = null;
            fitAddonRef.current = null;
        };
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme, isOledMode]);

    return { termRef, wsRef, fitAddonRef };
};