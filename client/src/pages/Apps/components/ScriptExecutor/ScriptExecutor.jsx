import Button from "@/common/components/Button";
import { mdiConsoleLine, mdiScript, mdiStop } from "@mdi/js";
import InstallStep from "@/pages/Apps/components/AppInstaller/components/InstallStep";
import "./styles.sass";
import { useContext, useEffect, useState, useImperativeHandle, forwardRef, useRef } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import LinuxImage from "../AppInstaller/os_images/linux.png";
import LogDialog from "@/pages/Apps/components/AppInstaller/components/LogDialog";
import Icon from "@mdi/react";
import InputDialog from "./components/InputDialog";
import SummaryDialog from "./components/SummaryDialog";
import TableDialog from "./components/TableDialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const ScriptExecutor = forwardRef(({ serverId, script, setRunning }, ref) => {
    const { sessionToken } = useContext(UserContext);
    const { sendToast } = useToast();

    const [logOpen, setLogOpen] = useState(false);
    const [logContent, setLogContent] = useState("");

    const [steps, setSteps] = useState(["Initializing script execution"]);
    const [currentStep, setCurrentStep] = useState(1);
    const [failedStep, setFailedStep] = useState(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const [currentProgress, setCurrentProgress] = useState(null);

    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [inputPrompt, setInputPrompt] = useState(null);
    const [ws, setWs] = useState(null);

    const [summaryData, setSummaryData] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [executionKey, setExecutionKey] = useState(0);
    const timeoutRef = useRef(null);
    const wsRef = useRef(null);

    const executeScript = () => {
        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/scripts/executor` : "localhost:6989/api/scripts/executor";

        const websocket = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=${serverId}&scriptId=${script?.id}`);
        setWs(websocket);
        wsRef.current = websocket;

        websocket.onmessage = (event) => {
            const data = event.data.toString();
            const type = data.substring(0, 1);
            const message = data.substring(1);

            if (type === "\x01") {
                setLogContent(logContent => logContent + message);
            } else if (type === "\x02") {
                let step = parseInt(message.split(",")[0]);
                let stepDescription = message.split(",")[1];

                setLogContent(logContent => logContent + "Step " + step + " completed: " + stepDescription + "\n");

                setSteps(currentSteps => {
                    const newSteps = [...currentSteps];
                    if (newSteps.length <= step) newSteps[step] = stepDescription;
                    return newSteps;
                });

                if (stepDescription === "Script execution completed") {
                    setIsCompleted(true);
                    setCurrentStep(step + 1);
                } else {
                    setCurrentStep(step + 1);
                }

                setCurrentProgress(null);
            } else if (type === "\x03") {
                setCurrentStep(currentStep => {
                    setFailedStep(currentStep);
                    setLogContent(logContent => logContent + "Step " + currentStep + " failed: " + message + "\n");
                    return currentStep;
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
                } catch (e) {
                    console.error("Error parsing progress data:", e);
                }
            } else if (type === "\x0B") {
                try {
                    const summaryData = JSON.parse(message);
                    setSummaryData(summaryData);
                } catch (e) {
                    console.error("Error parsing summary data:", e);
                }
            } else if (type === "\x0C") {
                try {
                    const tableData = JSON.parse(message);
                    setTableData(tableData);
                } catch (e) {
                    console.error("Error parsing table data:", e);
                }
            }
        };

        websocket.onclose = () => {
            setLogContent(logContent => logContent + "Script execution finished\n");
            setIsCompleted(true);
            setRunning(false);
            setInputDialogOpen(false);
            setWs(null);
            wsRef.current = null;
        };

        websocket.onerror = (error) => {
            setLogContent(logContent => logContent + "WebSocket error: " + error + "\n");
            setFailedStep(currentStep);
            setRunning(false);
            setInputDialogOpen(false);
            setWs(null);
            wsRef.current = null;
        };
    };

    const sendInput = (value) => {
        if (ws && inputPrompt) {
            const response = { type: "input_response", variable: inputPrompt.variable, value: value };
            ws.send(JSON.stringify(response));
            setInputDialogOpen(false);
            setInputPrompt(null);
        }
    };

    const sendSummaryResponse = () => {
        if (ws) {
            const response = { type: "input_response", variable: "NEXTERM_SUMMARY_RESULT", value: "closed" };
            ws.send(JSON.stringify(response));
            setSummaryData(null);
        }
    };

    const sendTableResponse = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const response = { type: "input_response", variable: "NEXTERM_TABLE_RESULT", value: "closed" };
            ws.send(JSON.stringify(response));
        }
        setTableData(null);
    };

    const cancelScript = () => {
        if (ws) {
            ws.send(JSON.stringify({ type: "input_cancelled" }));
            ws.close();
            setRunning(false);
            setInputDialogOpen(false);
            setInputPrompt(null);
            setLogContent(logContent => logContent + "Script execution cancelled by user\n");
        }
        wsRef.current = null;
    };

    const resetAndExecute = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setWs(null);

        setCurrentStep(1);
        setFailedStep(null);
        setIsCompleted(false);
        setLogContent("");
        setSteps(["Initializing script execution"]);
        setInputDialogOpen(false);
        setInputPrompt(null);
        setCurrentProgress(null);
        setSummaryData(null);
        setTableData(null);
        setRunning(true);

        timeoutRef.current = setTimeout(() => {
            executeScript();
            timeoutRef.current = null;
        }, 1000);
    };

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

    useEffect(() => {
        if (!script) return;

        resetAndExecute();

        return () => {
            setRunning(false);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setWs(null);
        };
    }, [script, serverId, executionKey]);

    return (
        <div className="script-executor">
            <LogDialog open={logOpen} onClose={() => setLogOpen(false)} content={logContent} />
            <InputDialog open={inputDialogOpen} onSubmit={sendInput} prompt={inputPrompt} />
            <SummaryDialog open={!!summaryData} onClose={sendSummaryResponse}
                           summaryData={summaryData} />
            <TableDialog open={!!tableData} onClose={sendTableResponse}
                         tableData={tableData} />

            <div className="script-header">
                <div className="script-img">
                    <Icon path={mdiScript} />
                </div>
                <div className="script-info">
                    <h2>{script.name}</h2>
                    <p>{failedStep ? "Script execution failed" : isCompleted ? "Script execution completed" : "Executing script..."}</p>
                </div>
            </div>

            <div className="script-progress">
                {steps.map((step, index) => <InstallStep key={index} progressValue={currentProgress} text={step}
                                                         imgContent={LinuxImage} type={getTypeByIndex(index)} />)}
            </div>

            <div className="script-actions">
                <Button text="Logs" icon={mdiConsoleLine} onClick={() => setLogOpen(true)} />
                {(!isCompleted && !failedStep) &&
                    <Button text="Stop Script" icon={mdiStop} onClick={cancelScript} type="danger" />}
            </div>
        </div>
    );
});
