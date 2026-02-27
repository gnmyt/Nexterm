import { useRef, useState, useCallback, useEffect, useContext } from "react";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import ScriptOverlay from "./components/ScriptOverlay";
import InputDialog from "./components/InputDialog";
import SummaryDialog from "./components/SummaryDialog";
import TableDialog from "./components/TableDialog";
import MessageBoxDialog from "./components/MessageBoxDialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "@xterm/xterm/css/xterm.css";
import "./styles.sass";

const SCRIPT_MAGIC = "\x1F";

const MSG = {
    SCRIPT_START: "script_start", STEP: "step", PROMPT: "prompt", WARNING: "warning",
    INFO: "info", SUCCESS: "success", CONFIRM: "confirm", PROGRESS: "progress",
    SUMMARY: "summary", TABLE: "table", MSGBOX: "msgbox", SCRIPT_END: "script_end",
    SCRIPT_ERROR: "script_error", INPUT_RESPONSE: "input_response", INPUT_CANCELLED: "input_cancelled",
};

const DIALOG_TYPES = { input: "input", summary: "summary", table: "table", msgbox: "msgbox" };

export const ScriptRenderer = ({ session, updateProgress, savedState, saveState }) => {
    const containerRef = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);
    const isAnyDialogOpenRef = useRef(false);
    const handlersRef = useRef({});
    
    const { sendToast } = useToast();
    const { sessionToken } = useContext(UserContext);
    const { theme, getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme } = usePreferences();

    const [state, setState] = useState({
        steps: savedState?.steps || ["Initializing..."],
        currentStep: savedState?.currentStep || 1,
        failedStep: savedState?.failedStep || null,
        isCompleted: savedState?.isCompleted || false,
        currentProgress: savedState?.currentProgress || null,
        scriptName: savedState?.scriptName || "",
        terminalContent: savedState?.terminalContent || [],
    });

    const [dialogs, setDialogs] = useState({
        inputOpen: false,
        inputPrompt: null,
        summaryData: null,
        tableData: null,
        messageBoxData: null,
    });
    const [promptQueue, setPromptQueue] = useState([]);

    const isAnyDialogOpen = dialogs.inputOpen || !!dialogs.summaryData || !!dialogs.tableData || !!dialogs.messageBoxData;
    isAnyDialogOpenRef.current = isAnyDialogOpen;

    useEffect(() => {
        saveState?.({ ...state });
    }, [state, saveState]);

    const showDialog = useCallback((dialogType, data) => {
        setDialogs(prev => {
            switch (dialogType) {
                case DIALOG_TYPES.input: return { ...prev, inputPrompt: data, inputOpen: true };
                case DIALOG_TYPES.summary: return { ...prev, summaryData: data };
                case DIALOG_TYPES.table: return { ...prev, tableData: data };
                case DIALOG_TYPES.msgbox: return { ...prev, messageBoxData: data };
                default: return prev;
            }
        });
    }, []);

    useEffect(() => {
        if (!isAnyDialogOpen && promptQueue.length > 0) {
            const [next, ...rest] = promptQueue;
            setPromptQueue(rest);
            showDialog(next.dialogType, next.data);
        }
    }, [isAnyDialogOpen, promptQueue, showDialog]);

    const queueOrShowPrompt = useCallback((dialogType, data) => {
        if (isAnyDialogOpenRef.current) {
            setPromptQueue(prev => [...prev, { dialogType, data }]);
        } else {
            showDialog(dialogType, data);
        }
    }, [showDialog]);

    const appendTerminalContent = useCallback((content) => {
        setState(prev => ({
            ...prev,
            terminalContent: [...prev.terminalContent.slice(-999), content],
        }));
    }, []);

    const sendControl = useCallback((type, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(SCRIPT_MAGIC + JSON.stringify({ type, ...payload }));
        }
    }, []);

    const handleControlMessage = useCallback((data) => {
        switch (data.type) {
            case MSG.SCRIPT_START:
                setState(prev => ({ ...prev, scriptName: data.name }));
                break;
            case MSG.STEP:
                setState(prev => {
                    const newSteps = [...prev.steps];
                    if (newSteps.length <= data.number) newSteps[data.number] = data.description;
                    return { ...prev, steps: newSteps, currentStep: data.number + 1, currentProgress: null };
                });
                setTimeout(() => updateProgress?.(session.id, Math.round((data.number / Math.max(1, data.number + 1)) * 100)), 0);
                break;
            case MSG.PROMPT:
            case MSG.CONFIRM:
                queueOrShowPrompt(DIALOG_TYPES.input, data);
                break;
            case MSG.WARNING: sendToast("Warning", data.message); break;
            case MSG.INFO: sendToast("Info", data.message); break;
            case MSG.SUCCESS: sendToast("Success", data.message); break;
            case MSG.PROGRESS:
                setState(prev => ({ ...prev, currentProgress: data.percentage }));
                setTimeout(() => updateProgress?.(session.id, data.percentage), 0);
                break;
            case MSG.SUMMARY: queueOrShowPrompt(DIALOG_TYPES.summary, data); break;
            case MSG.TABLE: queueOrShowPrompt(DIALOG_TYPES.table, data); break;
            case MSG.MSGBOX: queueOrShowPrompt(DIALOG_TYPES.msgbox, data); break;
            case MSG.SCRIPT_END:
                setState(prev => ({ ...prev, isCompleted: true, failedStep: data.success ? null : prev.currentStep }));
                setTimeout(() => updateProgress?.(session.id, data.success ? 100 : -1), 0);
                break;
            case MSG.SCRIPT_ERROR:
                setState(prev => ({ ...prev, failedStep: prev.currentStep }));
                break;
        }
    }, [sendToast, updateProgress, session.id, queueOrShowPrompt]);

    const processMessage = useCallback((data) => {
        const term = termRef.current;
        if (!term || typeof data !== 'string') return;

        const magicIndex = data.indexOf(SCRIPT_MAGIC);
        if (magicIndex === -1) {
            term.write(data);
            appendTerminalContent(data);
            return;
        }

        if (magicIndex > 0) {
            const terminalData = data.slice(0, magicIndex);
            term.write(terminalData);
            appendTerminalContent(terminalData);
        }

        const jsonStart = magicIndex + 1;
        let jsonEnd = data.indexOf(SCRIPT_MAGIC, jsonStart);
        if (jsonEnd === -1) jsonEnd = data.length;

        try {
            handleControlMessage(JSON.parse(data.slice(jsonStart, jsonEnd)));
        } catch (e) {
            console.error("Failed to parse script control message:", e);
        }

        if (jsonEnd < data.length) processMessage(data.slice(jsonEnd));
    }, [handleControlMessage, appendTerminalContent]);

    useEffect(() => {
        handlersRef.current = { processMessage, handleControlMessage, appendTerminalContent };
    }, [processMessage, handleControlMessage, appendTerminalContent]);

    const initialTerminalContentRef = useRef(savedState?.terminalContent || []);

    useEffect(() => {
        if (!sessionToken || !containerRef.current) return;

        let isCleaningUp = false;

        const terminalTheme = getCurrentTheme();
        const isLightTerminalTheme = selectedTheme === "light";

        const term = new Xterm({
            cursorBlink,
            cursorStyle,
            fontSize,
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
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        if (initialTerminalContentRef.current?.length > 0) {
            initialTerminalContentRef.current.forEach(content => term.write(content));
        }

        const handleResize = () => {
            fitAddon.fit();
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(`\x01${term.cols},${term.rows}`);
            }
        };

        window.addEventListener("resize", handleResize);

        const wsUrl = getWebSocketUrl("/api/ws/term", { sessionToken, sessionId: session.id });
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) handleResize();
        }, 300);

        ws.onopen = () => {
            ws.send(`\x01${term.cols},${term.rows}`);
        };

        ws.onclose = (event) => {
            clearInterval(interval);
            if (!isCleaningUp) {
                // Show toast if connection closed with an error
                if (event.code >= 4000 && event.reason) {
                    const errorMessage = event.reason.replace('error: ', '').toLowerCase();
                    let friendlyMessage;
                    
                    if (errorMessage.includes('connection not available') || errorMessage.includes('not available')) {
                        friendlyMessage = t('common.errors.connection.hostUnreachable');
                    } else if (errorMessage.includes('timeout')) {
                        friendlyMessage = t('common.errors.connection.timeout');
                    } else if (errorMessage.includes('refused')) {
                        friendlyMessage = t('common.errors.connection.refused');
                    } else if (errorMessage.includes('authentication')) {
                        friendlyMessage = t('common.errors.connection.authenticationFailed');
                    } else {
                        friendlyMessage = event.reason.replace('error: ', '').replace(/\(see logs\)/gi, '').trim();
                    }
                    
                    sendToast("Error", friendlyMessage);
                } else if (event.code !== 1000 && event.code !== 1005) {
                    sendToast("Error", t('common.errors.connection.scriptClosedUnexpectedly'));
                }
                setState(prev => ({ ...prev, isCompleted: true }));
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (!isCleaningUp) {
                sendToast("Error", t('common.errors.connection.scriptError'));
                setState(prev => ({ ...prev, failedStep: prev.currentStep }));
            }
        };

        ws.onmessage = (event) => {
            let data;
            if (event.data instanceof ArrayBuffer) {
                data = new TextDecoder().decode(event.data);
            } else if (event.data instanceof Blob) {
                event.data.text().then(text => handlersRef.current.processMessage?.(text));
                return;
            } else {
                data = event.data;
            }
            handlersRef.current.processMessage?.(data);
        };

        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

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
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme, session.id, getCurrentTheme, theme, t, sendToast]);

    const sendInput = useCallback((value) => {
        if (dialogs.inputPrompt) {
            sendControl(MSG.INPUT_RESPONSE, { variable: dialogs.inputPrompt.variable, value });
            setDialogs(prev => ({ ...prev, inputOpen: false, inputPrompt: null }));
        }
    }, [dialogs.inputPrompt, sendControl]);

    const closeDialog = useCallback((variable, field) => () => {
        sendControl(MSG.INPUT_RESPONSE, { variable, value: "closed" });
        setDialogs(prev => ({ ...prev, [field]: null }));
    }, [sendControl]);

    const handleCancel = useCallback(() => {
        sendControl(MSG.INPUT_CANCELLED);
        setDialogs(prev => ({ ...prev, inputOpen: false, inputPrompt: null }));
    }, [sendControl]);

    const getTypeByIndex = useCallback((index) => {
        const { failedStep, currentStep, isCompleted, currentProgress, steps } = state;
        if (index === failedStep - 1) return "error";
        if (failedStep !== null && index > failedStep - 1) return "skip";
        if (index < currentStep - 1) return "success";
        if (index === currentStep - 1) {
            if (isCompleted && index === steps.length - 1) return "success";
            return currentProgress !== null ? "progress" : "loading";
        }
        return "soon";
    }, [state]);

    return (
        <div className="script-renderer">
            <div ref={containerRef} className="script-terminal" />
            <ScriptOverlay
                scriptName={state.scriptName || session.scriptName || "Script"}
                steps={state.steps}
                failedStep={state.failedStep}
                isCompleted={state.isCompleted}
                currentStep={state.currentStep}
                currentProgress={state.currentProgress}
                getTypeByIndex={getTypeByIndex}
                onCancel={handleCancel}
            />
            <InputDialog open={dialogs.inputOpen} onSubmit={sendInput} onCancel={handleCancel} prompt={dialogs.inputPrompt} />
            <SummaryDialog open={!!dialogs.summaryData} onClose={closeDialog("NEXTERM_SUMMARY_RESULT", "summaryData")} summaryData={dialogs.summaryData} />
            <TableDialog open={!!dialogs.tableData} onClose={closeDialog("NEXTERM_TABLE_RESULT", "tableData")} tableData={dialogs.tableData} />
            <MessageBoxDialog open={!!dialogs.messageBoxData} onClose={closeDialog("NEXTERM_MSGBOX_RESULT", "messageBoxData")} messageData={dialogs.messageBoxData} />
        </div>
    );
};
