import { useEffect, useRef, useState, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { Terminal as Xterm } from "@xterm/xterm";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { useTerminalSettings } from "@/common/contexts/TerminalSettingsContext.jsx";
import { FitAddon } from "@xterm/addon-fit";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import AICommandPopover from "./components/AICommandPopover";
import SnippetsMenu from "./components/SnippetsMenu";
import { createProgressParser } from "../utils/progressParser";
import { mdiContentCopy, mdiContentPaste, mdiCodeBrackets, mdiSelectAll, mdiRefresh, mdiClose, mdiDelete, mdiKeyboard } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "@xterm/xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer, registerTerminalRef, broadcastMode, terminalRefs, updateProgress, layoutMode, onBroadcastToggle, onFullscreenToggle }) => {
    const ref = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const broadcastModeRef = useRef(broadcastMode);
    const progressParserRef = useRef(null);
    const layoutModeRef = useRef(layoutMode);
    const onBroadcastToggleRef = useRef(onBroadcastToggle);
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    
    const { sessionToken } = useContext(UserContext);
    const { theme } = useTheme();
    const { getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme } = useTerminalSettings();
    const { isAIAvailable } = useAI();
    const { getParsedKeybind } = useKeymaps();
    const { t } = useTranslation();
    const [showAIPopover, setShowAIPopover] = useState(false);
    const [aiPopoverPosition, setAIPopoverPosition] = useState(null);
    const contextMenu = useContextMenu();
    const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);

    useEffect(() => {
        broadcastModeRef.current = broadcastMode;
    }, [broadcastMode]);

    useEffect(() => {
        layoutModeRef.current = layoutMode;
    }, [layoutMode]);

    useEffect(() => {
        onBroadcastToggleRef.current = onBroadcastToggle;
    }, [onBroadcastToggle]);

    useEffect(() => {
        onFullscreenToggleRef.current = onFullscreenToggle;
    }, [onFullscreenToggle]);

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
        if (!showAIPopover) {
            const term = termRef.current;
            const terminalElement = ref.current;
            if (term && terminalElement) {
                const rect = terminalElement.getBoundingClientRect();
                const buffer = term.buffer.active;
                const charWidth = rect.width / term.cols;
                const charHeight = rect.height / term.rows;
                setAIPopoverPosition({
                    x: rect.left + (buffer.cursorX * charWidth),
                    y: rect.top + (buffer.cursorY * charHeight)
                });
            }
        } else {
            setTimeout(() => termRef.current?.focus(), 0);
        }
        setShowAIPopover(!showAIPopover);
    };

    const handleAICommandGenerated = (command) => {
        if (termRef.current && wsRef.current) {
            wsRef.current.send(command);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    const handleCopy = () => {
        const selection = termRef.current?.getSelection();
        if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
        }
        contextMenu.close();
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(text);
            }
        } catch (err) {
            console.error('Failed to paste:', err);
        }
        contextMenu.close();
    };

    const handleSelectAll = () => {
        termRef.current?.selectAll();
        contextMenu.close();
    };

    const handleClearTerminal = () => {
        termRef.current?.clear();
        contextMenu.close();
    };

    const handleInsertSnippet = () => {
        contextMenu.close();
        setShowSnippetsMenu(true);
    };

    const handleSnippetSelect = (command) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(command + '\r');
        }
        setShowSnippetsMenu(false);
        termRef.current?.focus();
    };

    const handleSendCtrlC = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send('\x03');
        }
        contextMenu.close();
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

        let wsUrl = `${protocol}://${url}?sessionToken=${sessionToken}&entryId=${session.server.id}&identityId=${session.identity}&sessionId=${session.id}`;
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
            if (event.type === "keydown") {
                const copyKeybind = getParsedKeybind("copy");
                if (copyKeybind && matchesKeybind(event, copyKeybind)) {
                    const selection = term.getSelection();
                    if (selection) {
                        event.preventDefault();
                        event.stopPropagation();
                        navigator.clipboard.writeText(selection).catch(() => { });
                        return false;
                    }
                }

                const aiKeybind = getParsedKeybind("ai-menu");
                if (aiKeybind && isAIAvailable() && matchesKeybind(event, aiKeybind)) {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleAIPopover();
                    return false;
                }

                const snippetsKeybind = getParsedKeybind("snippets");
                if (snippetsKeybind && matchesKeybind(event, snippetsKeybind)) {
                    event.preventDefault();
                    event.stopPropagation();
                    window.dispatchEvent(new CustomEvent('terminal-snippets-shortcut'));
                    return false;
                }

                const keyboardShortcutsKeybind = getParsedKeybind("keyboard-shortcuts");
                if (keyboardShortcutsKeybind && matchesKeybind(event, keyboardShortcutsKeybind)) {
                    event.preventDefault();
                    event.stopPropagation();
                    window.dispatchEvent(new CustomEvent('terminal-keyboard-shortcuts-shortcut'));
                    return false;
                }

                const currentLayoutMode = layoutModeRef.current;
                const currentOnBroadcastToggle = onBroadcastToggleRef.current;
                if (currentLayoutMode !== "single" && currentOnBroadcastToggle) {
                    const broadcastKeybind = getParsedKeybind("broadcast");
                    if (broadcastKeybind && matchesKeybind(event, broadcastKeybind)) {
                        event.preventDefault();
                        event.stopPropagation();
                        currentOnBroadcastToggle();
                        return false;
                    }
                }

                const currentOnFullscreenToggle = onFullscreenToggleRef.current;
                if (currentOnFullscreenToggle) {
                    const fullscreenKeybind = getParsedKeybind("fullscreen");
                    if (fullscreenKeybind && matchesKeybind(event, fullscreenKeybind)) {
                        event.preventDefault();
                        event.stopPropagation();
                        currentOnFullscreenToggle();
                        return false;
                    }
                }
            }
            return true;
        });

        return () => {
            if (registerTerminalRef) {
                registerTerminalRef(session.id, null);
            }
            window.removeEventListener("resize", handleResize);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
            term.dispose();
            clearInterval(interval);
            termRef.current = null;
            wsRef.current = null;
        };
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme]);

    return (
        <div className="xterm-container" onContextMenu={handleContextMenu}>
            <div ref={ref} className="xterm-wrapper" />
            {isAIAvailable() && (
                <AICommandPopover visible={showAIPopover} onClose={() => setShowAIPopover(false)}
                    onCommandGenerated={handleAICommandGenerated} position={aiPopoverPosition}
                    focusTerminal={() => termRef.current?.focus()} />
            )}
            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                onClose={contextMenu.close}
                trigger={contextMenu.triggerRef}
            >
                <ContextMenuItem
                    icon={mdiContentCopy}
                    label={t('servers.fileManager.contextMenu.copy')}
                    onClick={handleCopy}
                    disabled={!termRef.current?.getSelection()}
                />
                <ContextMenuItem
                    icon={mdiContentPaste}
                    label={t('servers.fileManager.contextMenu.paste')}
                    onClick={handlePaste}
                />
                <ContextMenuItem
                    icon={mdiSelectAll}
                    label={t('servers.fileManager.contextMenu.selectAll')}
                    onClick={handleSelectAll}
                />
                <ContextMenuSeparator />
                <ContextMenuItem
                    icon={mdiCodeBrackets}
                    label={t('servers.fileManager.contextMenu.insertSnippet')}
                    onClick={handleInsertSnippet}
                />
                <ContextMenuSeparator />
                <ContextMenuItem
                    icon={mdiKeyboard}
                    label={t('servers.fileManager.contextMenu.sendCtrlC')}
                    onClick={handleSendCtrlC}
                />
                <ContextMenuItem
                    icon={mdiDelete}
                    label={t('servers.fileManager.contextMenu.clearTerminal')}
                    onClick={handleClearTerminal}
                />
            </ContextMenu>
            <SnippetsMenu
                visible={showSnippetsMenu}
                onSelect={handleSnippetSelect}
                onClose={() => setShowSnippetsMenu(false)}
            />
        </div>
    );
};

export default XtermRenderer;
