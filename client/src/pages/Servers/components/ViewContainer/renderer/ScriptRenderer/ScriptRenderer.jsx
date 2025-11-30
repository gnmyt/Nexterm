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

export const ScriptRenderer = ({ session, updateProgress, savedState, saveState }) => {
    const containerRef = useRef(null);

    const [steps, setSteps] = useState(savedState?.steps || ["Initializing..."]);
    const [currentStep, setCurrentStep] = useState(savedState?.currentStep || 1);
    const [failedStep, setFailedStep] = useState(savedState?.failedStep || null);
    const [isCompleted, setIsCompleted] = useState(savedState?.isCompleted || false);
    const [currentProgress, setCurrentProgress] = useState(savedState?.currentProgress || null);
    const [scriptName, setScriptName] = useState(savedState?.scriptName || "");
    const [terminalContent, setTerminalContent] = useState(savedState?.terminalContent || []);

    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [inputPrompt, setInputPrompt] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [messageBoxData, setMessageBoxData] = useState(null);
    const { sendToast } = useToast();

    useEffect(() => {
        if (saveState) {
            saveState({
                steps, currentStep, failedStep, isCompleted,
                currentProgress, scriptName, terminalContent,
            });
        }
    }, [steps, currentStep, failedStep, isCompleted, currentProgress, scriptName, terminalContent, saveState]);

    const handleMessage = useCallback((event, term) => {
        const data = event.data.toString();
        const type = data.substring(0, 1);
        const message = data.substring(1);

        if (type === "\x01") {
            term.write(message);
            setTerminalContent(prev => {
                const newContent = [...prev, message];
                return newContent.length > 1000 ? newContent.slice(-1000) : newContent;
            });
        } else if (type === "\x02") {
            const step = parseInt(message.split(",")[0]);
            const stepDescription = message.split(",")[1];

            setSteps(currentSteps => {
                const newSteps = [...currentSteps];
                if (newSteps.length <= step) newSteps[step] = stepDescription;
                const progressPercent = Math.round((step / Math.max(newSteps.length, step + 1)) * 100);
                if (updateProgress) updateProgress(session.id, progressPercent);
                return newSteps;
            });

            if (stepDescription === "Script execution completed") {
                setIsCompleted(true);
                setCurrentStep(step + 1);
                if (updateProgress) updateProgress(session.id, 100);
            } else {
                setCurrentStep(step + 1);
            }
            setCurrentProgress(null);
        } else if (type === "\x03") {
            setCurrentStep(curr => {
                setFailedStep(curr);
                return curr;
            });
        } else if (type === "\x05") {
            try {
                const promptData = JSON.parse(message);
                setInputPrompt(promptData);
                setInputDialogOpen(true);
            } catch (e) {
                console.error("Error parsing prompt data:", e);
            }
        } else if (type === "\x06") {
            try {
                const warningData = JSON.parse(message);
                sendToast("Warning", warningData.message);
            } catch (e) {
                console.error("Error parsing warning data:", e);
            }
        } else if (type === "\x07") {
            try {
                const infoData = JSON.parse(message);
                sendToast("Info", infoData.message);
            } catch (e) {
                console.error("Error parsing info data:", e);
            }
        } else if (type === "\x08") {
            try {
                const successData = JSON.parse(message);
                sendToast("Success", successData.message);
            } catch (e) {
                console.error("Error parsing success data:", e);
            }
        } else if (type === "\x09") {
            try {
                const progressData = JSON.parse(message);
                setCurrentProgress(progressData.percentage);
                if (updateProgress) updateProgress(session.id, progressData.percentage);
            } catch (e) {
                console.error("Error parsing progress data:", e);
            }
        } else if (type === "\x0A") {
            setScriptName(message);
        } else if (type === "\x0B") {
            try {
                setSummaryData(JSON.parse(message));
            } catch (e) {
                console.error("Error parsing summary data:", e);
            }
        } else if (type === "\x0C") {
            try {
                setTableData(JSON.parse(message));
            } catch (e) {
                console.error("Error parsing table data:", e);
            }
        } else if (type === "\x0D") {
            try {
                setMessageBoxData(JSON.parse(message));
            } catch (e) {
                console.error("Error parsing message box data:", e);
            }
        } else {
            term.write(data);
            setTerminalContent(prev => {
                const newContent = [...prev, data];
                return newContent.length > 1000 ? newContent.slice(-1000) : newContent;
            });
        }
    }, [sendToast, updateProgress, session.id]);

    const { wsRef } = useTerminal(containerRef, session, {
        onMessage: handleMessage,
        onClose: () => setIsCompleted(true),
        onError: () => setFailedStep(currentStep),
        restoreContent: savedState?.terminalContent,
    });

    const sendInput = useCallback((value) => {
        if (wsRef.current && inputPrompt) {
            wsRef.current.send(JSON.stringify({ 
                type: "input_response", 
                variable: inputPrompt.variable, 
                value 
            }));
            setInputDialogOpen(false);
            setInputPrompt(null);
        }
    }, [inputPrompt, wsRef]);

    const sendSummaryResponse = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
                type: "input_response", 
                variable: "NEXTERM_SUMMARY_RESULT", 
                value: "closed" 
            }));
        }
        setSummaryData(null);
    }, [wsRef]);

    const sendTableResponse = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
                type: "input_response", 
                variable: "NEXTERM_TABLE_RESULT", 
                value: "closed" 
            }));
        }
        setTableData(null);
    }, [wsRef]);

    const sendMessageBoxResponse = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
                type: "input_response", 
                variable: "NEXTERM_MSGBOX_RESULT", 
                value: "closed" 
            }));
        }
        setMessageBoxData(null);
    }, [wsRef]);

    const cancelScript = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "input_cancelled" }));
    }, [wsRef]);

    const getTypeByIndex = (index) => {
        if (index === failedStep - 1) return "error";
        if (failedStep !== null && index > failedStep - 1) return "skip";
        if (index < currentStep - 1) return "success";
        if (index === currentStep - 1) {
            if (isCompleted && index === steps.length - 1) return "success";
            if (currentProgress !== null) return "progress";
            return "loading";
        }
        return "soon";
    };

    return (
        <div className="script-renderer">
            <div className="script-terminal-container">
                <div ref={containerRef} className="script-terminal-wrapper" />
            </div>
            <ScriptProgressPanel
                scriptName={scriptName || session.scriptName || "Script"}
                steps={steps}
                failedStep={failedStep}
                isCompleted={isCompleted}
                currentProgress={currentProgress}
                getTypeByIndex={getTypeByIndex}
                onCancel={cancelScript}
            />
            <InputDialog
                open={inputDialogOpen}
                onSubmit={sendInput}
                prompt={inputPrompt}
            />
            <SummaryDialog
                open={!!summaryData}
                onClose={sendSummaryResponse}
                summaryData={summaryData}
            />
            <TableDialog
                open={!!tableData}
                onClose={sendTableResponse}
                tableData={tableData}
            />
            <MessageBoxDialog
                open={!!messageBoxData}
                onClose={sendMessageBoxResponse}
                messageData={messageBoxData}
            />
        </div>
    );
};
