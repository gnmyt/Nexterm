import { useEffect, useRef, useState, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { Terminal as Xterm } from "@xterm/xterm";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { useTerminalSettings } from "@/common/contexts/TerminalSettingsContext.jsx";
import { FitAddon } from "@xterm/addon-fit";
import AICommandPopover from "./components/AICommandPopover";
import { createProgressParser } from "../utils/progressParser";
import "@xterm/xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer, registerTerminalRef, broadcastMode, terminalRefs, updateProgress }) => {
    const ref = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const broadcastModeRef = useRef(broadcastMode);
    const progressParserRef = useRef(null);
    const { sessionToken } = useContext(UserContext);
    const { theme } = useTheme();
    const { getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme } = useTerminalSettings();
    const { isAIAvailable } = useAI();
    const [showAIPopover, setShowAIPopover] = useState(false);
    const [aiPopoverPosition, setAIPopoverPosition] = useState(null);

    useEffect(() => {
        broadcastModeRef.current = broadcastMode;
    }, [broadcastMode]);

    useEffect(() => {
        if (updateProgress) {
            progressParserRef.current = createProgressParser();

            return () => {
                if (progressParserRef.current) {
                    progressParserRef.current.destroy();
                    updateProgress(session.id, 0);
                }
            };
        }
    }, [session.id, updateProgress]);

    const toggleAIPopover = () => {
        if (!showAIPopover && termRef.current) {
            const term = termRef.current;
            const terminalElement = ref.current;

            if (terminalElement) {
                const rect = terminalElement.getBoundingClientRect();
                const buffer = term.buffer.active;

                const charWidth = rect.width / term.cols;
                const charHeight = rect.height / term.rows;

                const cursorX = rect.left + (buffer.cursorX * charWidth);
                const cursorY = rect.top + (buffer.cursorY * charHeight);

                setAIPopoverPosition({ x: cursorX, y: cursorY });
            }
        }
        setShowAIPopover(!showAIPopover);
    };

    const handleAICommandGenerated = (command) => {
        if (termRef.current && wsRef.current) {
            wsRef.current.send(command);
        }
    };

    useEffect(() => {
        if (!sessionToken) return;

        const terminalTheme = getCurrentTheme();
        const isLightTerminalTheme = selectedTheme === "light";
        
        const term = new Xterm({
            cursorBlink: cursorBlink,
            cursorStyle: cursorStyle,
            fontSize: fontSize,
            fontFamily: selectedFont,
            theme: {
                background: (theme === "light" && isLightTerminalTheme) ? "#F3F3F3" : terminalTheme.background,
                foreground: (theme === "light" && isLightTerminalTheme) ? "#000000" : terminalTheme.foreground,
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
                brightWhite: (theme === "light" && isLightTerminalTheme) ? "#464545" : terminalTheme.brightWhite,
                cursor: (theme === "light" && isLightTerminalTheme) ? "#000000" : terminalTheme.cursor
            },
        });

        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(ref.current);

        const handleResize = () => {
            fitAddon.fit();
            wsRef.current.send(`\x01${term.cols},${term.rows}`);
        };

        window.addEventListener("resize", handleResize);

        const protocol = location.protocol === "https:" ? "wss" : "ws";

        let ws;

        let url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/ws/term` : "localhost:6989/api/ws/term";

        let wsUrl = `${protocol}://${url}?sessionToken=${sessionToken}&entryId=${session.server.id}&identityId=${session.identity}`;
        if (session.connectionReason) {
            wsUrl += `&connectionReason=${encodeURIComponent(session.connectionReason)}`;
        }

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        if (registerTerminalRef) {
            registerTerminalRef(session.id, { term, ws });
        }

        let interval = setInterval(() => {
            if (ws.readyState === ws.OPEN) handleResize();
        }, 300);

        ws.onopen = () => {
            ws.send(`\x01${term.cols},${term.rows}`);
        }

        ws.onclose = (event) => {
            if (event.wasClean) {
                clearInterval(interval);
                disconnectFromServer(session.id);
            }
        };

        ws.onmessage = (event) => {
            const data = event.data;

            if (data.startsWith("\x02")) {
                const prompt = data.substring(1);
                term.write(prompt);

                let totpCode = "";
                const onKey = term.onKey((key) => {
                    if (key.domEvent.key === "Enter") {
                        ws.send(`\x03${totpCode}`);
                        term.write("\r\n");
                        totpCode = "";
                        onKey.dispose();
                    } else if (key.domEvent.key === "Backspace" && totpCode.length > 0) {
                        totpCode = totpCode.slice(0, -1);
                        term.write("\b \b");
                    } else {
                        totpCode += key.key;
                        term.write(key.key);
                    }
                });
            } else {
                term.write(data);

                if (progressParserRef.current && updateProgress) {
                    const progress = progressParserRef.current.parseData(data);
                    if (progress !== null) {
                        updateProgress(session.id, progress);
                    } else if (!progressParserRef.current.isTrackingProgress()) {
                        const currentProgress = progressParserRef.current.getProgress();
                        if (currentProgress === 0) {
                            updateProgress(session.id, 0);
                        }
                    }
                }
            }
        };

        term.onData((data) => {
            ws.send(data);

            if (broadcastModeRef.current && terminalRefs?.current) {
                Object.entries(terminalRefs.current).forEach(([sessionId, refs]) => {
                    if (sessionId !== session.id && refs.ws && refs.ws.readyState === WebSocket.OPEN) {
                        refs.ws.send(data);
                    }
                });
            }
        });

        term.attachCustomKeyEventHandler((event) => {
            if (event.ctrlKey && event.key === "k" && event.type === "keydown" && isAIAvailable()) {
                event.preventDefault();
                toggleAIPopover();
                return false;
            }
            return true;
        });

        return () => {
            if (registerTerminalRef) {
                registerTerminalRef(session.id, null);
            }
            window.removeEventListener("resize", handleResize);
            ws.close();
            term.dispose();
            clearInterval(interval);
            termRef.current = null;
            wsRef.current = null;
        };
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme]);

    return (
        <div className="xterm-container">
            <div ref={ref} className="xterm-wrapper" />
            {isAIAvailable() && (
                <AICommandPopover visible={showAIPopover} onClose={() => setShowAIPopover(false)}
                                  onCommandGenerated={handleAICommandGenerated} position={aiPopoverPosition}
                                  focusTerminal={() => termRef.current?.focus()} />
            )}
        </div>
    );
};

export default XtermRenderer;
