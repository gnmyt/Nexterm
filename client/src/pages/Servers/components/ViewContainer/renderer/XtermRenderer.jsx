import { useEffect, useRef, useState, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { AIContext } from "@/common/contexts/AIContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { Terminal as Xterm } from "@xterm/xterm";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { FitAddon } from "@xterm/addon-fit";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import AICommandPopover from "./components/AICommandPopover";
import SnippetsMenu from "./components/SnippetsMenu";
import { createProgressParser } from "../utils/progressParser";
import { mdiContentCopy, mdiContentPaste, mdiCodeBrackets, mdiSelectAll, mdiDelete, mdiKeyboard, mdiKey } from "@mdi/js";
import { useTranslation } from "react-i18next";
import ConnectionLoader from "./components/ConnectionLoader";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import { postRequest } from "@/common/utils/RequestUtil.js";
import "@xterm/xterm/css/xterm.css";
import "./styles/xterm.sass";

const XtermRenderer = ({ session, disconnectFromServer, registerTerminalRef, broadcastMode, terminalRefs, updateProgress, layoutMode, onBroadcastToggle, onFullscreenToggle, isShared = false }) => {
    const ref = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const broadcastModeRef = useRef(broadcastMode);
    const progressParserRef = useRef(null);
    const terminalBufferRef = useRef([]);
    const layoutModeRef = useRef(layoutMode);
    const onBroadcastToggleRef = useRef(onBroadcastToggle);
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const connectionLoaderRef = useRef(null);
    
    const userContext = useContext(UserContext);
    const sessionToken = userContext?.sessionToken;
    const { theme, getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme } = usePreferences();
    const aiContext = useContext(AIContext);
    const isAIAvailable = aiContext?.isAIAvailable || (() => false);
    const { getParsedKeybind } = useKeymaps();
    const { t } = useTranslation();
    const [showAIPopover, setShowAIPopover] = useState(false);
    const contextMenu = useContextMenu();
    const { identities } = useContext(IdentityContext);
    const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);
    const longPressTimeoutRef = useRef(null);
    const longPressStartRef = useRef({ x: 0, y: 0 });
    const longPressTriggeredRef = useRef(false);

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
        if (showAIPopover) {
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

    const clearLongPress = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    const handlePointerDown = (e) => {
        if (isShared || e.pointerType !== "touch") return;
        longPressTriggeredRef.current = false;
        longPressStartRef.current = { x: e.clientX, y: e.clientY };
        clearLongPress();
        longPressTimeoutRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            contextMenu.open(null, { x: longPressStartRef.current.x, y: longPressStartRef.current.y });
        }, 500);
    };

    const handlePointerMove = (e) => {
        if (!longPressTimeoutRef.current) return;
        const dx = Math.abs(e.clientX - longPressStartRef.current.x);
        const dy = Math.abs(e.clientY - longPressStartRef.current.y);
        if (dx > 10 || dy > 10) clearLongPress();
    };

    const handlePointerUp = (e) => {
        if (longPressTriggeredRef.current) {
            e.preventDefault();
            e.stopPropagation();
        }
        clearLongPress();
        longPressTriggeredRef.current = false;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        });
    };

    const handleCopy = () => {
        const selection = termRef.current?.getSelection();
        if (selection) copyToClipboard(selection);
        contextMenu.close();
        termRef.current?.focus();
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) termRef.current?.paste(text);
        } catch (err) {
            console.error('Failed to paste:', err);
        }
        contextMenu.close();
        termRef.current?.focus();
    };

    const handlePasteIdentity = async () => {
        try {
            await postRequest(`connections/${session.id}/paste-password`);
        } catch (err) {
            console.error('Failed to paste identity password via API:', err);
        }
        contextMenu.close();
        termRef.current?.focus();
    };

    const handleSelectAll = () => {
        termRef.current?.selectAll();
        contextMenu.close();
        termRef.current?.focus();
    };

    const handleClearTerminal = () => {
        termRef.current?.clear();
        contextMenu.close();
        termRef.current?.focus();
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
        termRef.current?.focus();
    };

    useEffect(() => {
        if (!sessionToken && !isShared) return;

        let isCleaningUp = false;

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
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(`\x01${term.cols},${term.rows}`);
            }
        };

        window.addEventListener("resize", handleResize);

        const handleNativePaste = (e) => {
            const text = e.clipboardData?.getData('text');
            if (text) {
                e.preventDefault();
                term.paste(text);
            }
        };
        ref.current?.addEventListener('paste', handleNativePaste);

        let ws;

        const wsParams = isShared 
            ? { shareId: session.shareId || session.id.split('/').pop() }
            : { sessionToken, sessionId: session.id };

        const wsUrl = getWebSocketUrl("/api/ws/term", wsParams);

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

        ws.onclose = () => {
            clearInterval(interval);
            if (!isCleaningUp) {
                disconnectFromServer(session.id);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (!isCleaningUp) {
                disconnectFromServer(session.id);
            }
        };

        ws.onmessage = (event) => {
            const data = event.data;

            connectionLoaderRef.current?.hide();

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
                terminalBufferRef.current.push(data);
                if (terminalBufferRef.current.length > 50) terminalBufferRef.current.shift();

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
                        copyToClipboard(selection);
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
            isCleaningUp = true;
            if (registerTerminalRef) {
                registerTerminalRef(session.id, null);
            }
            window.removeEventListener("resize", handleResize);
            ref.current?.removeEventListener('paste', handleNativePaste);
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            }
            term.dispose();
            clearInterval(interval);
            termRef.current = null;
            wsRef.current = null;
        };
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme, isShared]);

    return (
        <div
            className="xterm-container"
            onContextMenu={!isShared ? handleContextMenu : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <ConnectionLoader onReady={(loader) => { connectionLoaderRef.current = loader; }} />
            <div ref={ref} className="xterm-wrapper" />
            {!isShared && isAIAvailable() && (
                <AICommandPopover visible={showAIPopover} onClose={() => setShowAIPopover(false)}
                    onCommandGenerated={handleAICommandGenerated} focusTerminal={() => termRef.current?.focus()}
                    entryId={session.server?.id}
                    recentOutput={terminalBufferRef.current.join('')
                        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
                        .replace(/[\x00-\x1F\x7F]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(-1500)} />
            )}
            {!isShared && (
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
                    {(identities && session.identity && identities.find(i => i.id === session.identity) && ['password','both','password-only'].includes(identities.find(i => i.id === session.identity).type)) && (
                        <ContextMenuItem
                            icon={mdiKey}
                            label={t('servers.contextMenu.pasteIdentityPassword')}
                            onClick={handlePasteIdentity}
                        />
                    )}
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
            )}
            {!isShared && (
                <SnippetsMenu
                    visible={showSnippetsMenu}
                    onSelect={handleSnippetSelect}
                    onClose={() => setShowSnippetsMenu(false)}
                    activeSession={session}
                />
            )}
        </div>
    );
};

export default XtermRenderer;
