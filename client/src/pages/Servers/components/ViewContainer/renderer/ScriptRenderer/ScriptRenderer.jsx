import { useRef, useState, useCallback, useEffect } from "react";
import { useTerminal } from "@/common/hooks/useTerminal.js";
import ScriptProgressPanel from "./components/ScriptProgressPanel";
import InputDialog from "./components/InputDialog";
import SummaryDialog from "./components/SummaryDialog";
import TableDialog from "./components/TableDialog";
import MessageBoxDialog from "./components/MessageBoxDialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "@xterm/xterm/css/xterm.css";
import "./styles.sass";

const MESSAGE_TYPES = {
    OUTPUT: "\x01",
    STEP: "\x02",
    ERROR: "\x03",
    PROMPT: "\x05",
    WARNING: "\x06",
    INFO: "\x07",
    SUCCESS: "\x08",
    PROGRESS: "\x09",
    SCRIPT_NAME: "\x0A",
    SUMMARY: "\x0B",
    TABLE: "\x0C",
    MSGBOX: "\x0D",
};

const DIALOG_TYPES = { input: "input", summary: "summary", table: "table", msgbox: "msgbox" };

export const ScriptRenderer = ({ session, updateProgress, savedState, saveState }) => {
    const containerRef = useRef(null);
    const isAnyDialogOpenRef = useRef(false);
    const { sendToast } = useToast();

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

    const handleMessage = useCallback((event, term) => {
        const data = event.data.toString();
        const type = data[0];
        const message = data.slice(1);

        const parseJSON = (msg, onSuccess) => {
            try { onSuccess(JSON.parse(msg)); } 
            catch { /* ignore parse errors */ }
        };

        switch (type) {
            case MESSAGE_TYPES.OUTPUT:
                term.write(message);
                appendTerminalContent(message);
                break;

            case MESSAGE_TYPES.STEP: {
                const [stepStr, stepDescription] = message.split(",");
                const step = parseInt(stepStr);
                setState(prev => {
                    const newSteps = [...prev.steps];
                    if (newSteps.length <= step) newSteps[step] = stepDescription;
                    updateProgress?.(session.id, Math.round((step / Math.max(newSteps.length, step + 1)) * 100));
                    
                    if (stepDescription === "Script execution completed") {
                        updateProgress?.(session.id, 100);
                        return { ...prev, steps: newSteps, currentStep: step + 1, isCompleted: true, currentProgress: null };
                    }
                    return { ...prev, steps: newSteps, currentStep: step + 1, currentProgress: null };
                });
                break;
            }

            case MESSAGE_TYPES.ERROR:
                setState(prev => ({ ...prev, failedStep: prev.currentStep }));
                break;

            case MESSAGE_TYPES.PROMPT:
                parseJSON(message, data => queueOrShowPrompt(DIALOG_TYPES.input, data));
                break;

            case MESSAGE_TYPES.WARNING:
                parseJSON(message, data => sendToast("Warning", data.message));
                break;

            case MESSAGE_TYPES.INFO:
                parseJSON(message, data => sendToast("Info", data.message));
                break;

            case MESSAGE_TYPES.SUCCESS:
                parseJSON(message, data => sendToast("Success", data.message));
                break;

            case MESSAGE_TYPES.PROGRESS:
                parseJSON(message, data => {
                    setState(prev => ({ ...prev, currentProgress: data.percentage }));
                    updateProgress?.(session.id, data.percentage);
                });
                break;

            case MESSAGE_TYPES.SCRIPT_NAME:
                setState(prev => ({ ...prev, scriptName: message }));
                break;

            case MESSAGE_TYPES.SUMMARY:
                parseJSON(message, data => queueOrShowPrompt(DIALOG_TYPES.summary, data));
                break;

            case MESSAGE_TYPES.TABLE:
                parseJSON(message, data => queueOrShowPrompt(DIALOG_TYPES.table, data));
                break;

            case MESSAGE_TYPES.MSGBOX:
                parseJSON(message, data => queueOrShowPrompt(DIALOG_TYPES.msgbox, data));
                break;

            default:
                term.write(data);
                appendTerminalContent(data);
        }
    }, [sendToast, updateProgress, session.id, queueOrShowPrompt, appendTerminalContent]);

    const { wsRef } = useTerminal(containerRef, session, {
        onMessage: handleMessage,
        onClose: () => setState(prev => ({ ...prev, isCompleted: true })),
        onError: () => setState(prev => ({ ...prev, failedStep: prev.currentStep })),
        restoreContent: savedState?.terminalContent,
    });

    const sendResponse = useCallback((variable, value, clearFn) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "input_response", variable, value }));
        }
        clearFn();
    }, [wsRef]);

    const sendInput = useCallback((value) => {
        if (dialogs.inputPrompt) {
            sendResponse(dialogs.inputPrompt.variable, value, () => 
                setDialogs(prev => ({ ...prev, inputOpen: false, inputPrompt: null }))
            );
        }
    }, [dialogs.inputPrompt, sendResponse]);

    const closeDialog = useCallback((variable, field) => () => {
        sendResponse(variable, "closed", () => setDialogs(prev => ({ ...prev, [field]: null })));
    }, [sendResponse]);

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
            <div className="script-terminal-container">
                <div ref={containerRef} className="script-terminal-wrapper" />
            </div>
            <ScriptProgressPanel
                scriptName={state.scriptName || session.scriptName || "Script"}
                steps={state.steps}
                failedStep={state.failedStep}
                isCompleted={state.isCompleted}
                currentProgress={state.currentProgress}
                getTypeByIndex={getTypeByIndex}
                onCancel={() => wsRef.current?.send(JSON.stringify({ type: "input_cancelled" }))}
            />
            <InputDialog open={dialogs.inputOpen} onSubmit={sendInput} prompt={dialogs.inputPrompt} />
            <SummaryDialog open={!!dialogs.summaryData} onClose={closeDialog("NEXTERM_SUMMARY_RESULT", "summaryData")} summaryData={dialogs.summaryData} />
            <TableDialog open={!!dialogs.tableData} onClose={closeDialog("NEXTERM_TABLE_RESULT", "tableData")} tableData={dialogs.tableData} />
            <MessageBoxDialog open={!!dialogs.messageBoxData} onClose={closeDialog("NEXTERM_MSGBOX_RESULT", "messageBoxData")} messageData={dialogs.messageBoxData} />
        </div>
    );
};
