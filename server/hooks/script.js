const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { transformScript, processNextermLine, checkSudoPrompt, stripAnsi } = require("../utils/scriptUtils");
const { parseResizeMessage, setupSSHEventHandlers } = require("../utils/sshEventHandlers");
const logger = require("../utils/logger");

const NEXTERM_COMMANDS = [
    "NEXTERM_INPUT", "NEXTERM_SELECT", "NEXTERM_STEP", "NEXTERM_TABLE", "NEXTERM_MSGBOX",
    "NEXTERM_WARN", "NEXTERM_INFO", "NEXTERM_CONFIRM", "NEXTERM_PROGRESS",
    "NEXTERM_SUCCESS", "NEXTERM_SUMMARY"
];

const setupScriptStreamHandlers = (ws, stream) => {
    let currentStep = 1;
    let pendingInput = null;
    let outputBuffer = "";

    const sendStep = (stepNum, message) => ws.send(`\x02${stepNum},${message}`);
    const sendOutput = (data) => ws.send(`\x01${data}`);
    const sendPrompt = (promptData) => ws.send(`\x05${JSON.stringify(promptData)}`);

    const handleOutput = (data) => {
        const output = data.toString();
        const sudoPrompt = checkSudoPrompt(output);
        if (sudoPrompt) {
            pendingInput = sudoPrompt;
            sendPrompt(sudoPrompt);
            return "";
        }
        return output;
    };

    const processLines = (lines) => {
        for (const line of lines) {
            logger.debug("Processing script line", { line: line.substring(0, 200), length: line.length });
            const nextermCommand = processNextermLine(line);
            
            if (nextermCommand) {
                logger.debug("Found NEXTERM command", { type: nextermCommand.type, command: nextermCommand });
                switch (nextermCommand.type) {
                    case "input":
                    case "select":
                        pendingInput = nextermCommand;
                        sendPrompt(nextermCommand);
                        break;
                    case "step":
                        sendStep(currentStep++, nextermCommand.description);
                        break;
                    case "warning":
                        ws.send(`\x06${JSON.stringify({ type: "warning", message: nextermCommand.message })}`);
                        break;
                    case "info":
                        ws.send(`\x07${JSON.stringify({ type: "info", message: nextermCommand.message })}`);
                        break;
                    case "success":
                        ws.send(`\x08${JSON.stringify({ type: "success", message: nextermCommand.message })}`);
                        break;
                    case "confirm":
                        pendingInput = {
                            ...nextermCommand,
                            variable: "NEXTERM_CONFIRM_RESULT",
                            prompt: nextermCommand.message,
                            type: "confirm",
                        };
                        sendPrompt(pendingInput);
                        break;
                    case "progress":
                        ws.send(`\x09${JSON.stringify({
                            type: "progress",
                            percentage: nextermCommand.percentage,
                            message: nextermCommand.message,
                        })}`);
                        break;
                    case "summary":
                        pendingInput = {
                            ...nextermCommand,
                            variable: "NEXTERM_SUMMARY_RESULT",
                            prompt: "Summary displayed",
                            type: "summary",
                        };
                        ws.send(`\x0B${JSON.stringify({
                            type: "summary",
                            title: nextermCommand.title,
                            data: nextermCommand.data,
                        })}`);
                        break;
                    case "table":
                        pendingInput = {
                            ...nextermCommand,
                            variable: "NEXTERM_TABLE_RESULT",
                            prompt: "Table displayed",
                            type: "table",
                        };
                        ws.send(`\x0C${JSON.stringify({
                            type: "table",
                            title: nextermCommand.title,
                            data: nextermCommand.data,
                        })}`);
                        break;
                    case "msgbox":
                        pendingInput = {
                            ...nextermCommand,
                            variable: "NEXTERM_MSGBOX_RESULT",
                            prompt: "Message box displayed",
                            type: "msgbox",
                        };
                        ws.send(`\x0D${JSON.stringify({
                            type: "msgbox",
                            title: nextermCommand.title,
                            message: nextermCommand.message,
                        })}`);
                        break;
                }
            } else if (line.trim()) {
                const cleanLine = stripAnsi(line);
                if (!NEXTERM_COMMANDS.some(cmd => cleanLine.includes(cmd))) {
                    sendOutput(line + "\n");
                }
            }
        }
    };

    const onData = (data) => {
        if (ws.readyState !== ws.OPEN) return;

        const processedOutput = handleOutput(data);
        if (!processedOutput) return;

        outputBuffer += processedOutput;
        const lines = outputBuffer.split("\n");
        outputBuffer = lines.pop() || "";

        processLines(lines);
    };

    stream.on("data", onData);
    stream.stderr.on("data", (data) => {
        const processedOutput = handleOutput(data);
        if (processedOutput) {
            const cleanOutput = stripAnsi(processedOutput);
            if (!NEXTERM_COMMANDS.some(cmd => cleanOutput.includes(cmd))) {
                sendOutput(processedOutput);
            }
        }
    });

    const messageHandler = (message) => {
        try {
            const resize = parseResizeMessage(message);
            if (resize) {
                stream.setWindow(resize.height, resize.width);
                return;
            }

            const data = JSON.parse(message);
            if (data.type === "input_response" && pendingInput) {
                const value = data.value || pendingInput.default || "";

                if (pendingInput.isSudoPassword) {
                    stream.write(value + "\n");
                    sendOutput("Password entered\n");
                } else {
                    sendOutput(`${pendingInput.prompt}: ${value}\n`);
                    stream.write(value + "\n");
                }

                pendingInput = null;
            } else if (data.type === "input_cancelled") {
                stream.write("\x03");
            }
        } catch (e) {
            // Not a JSON message, ignore
        }
    };

    ws.on("message", messageHandler);

    stream.on("close", (code) => {
        ws.off("message", messageHandler);

        if (outputBuffer.trim()) {
            processLines([outputBuffer]);
        }

        if (code === 0) {
            sendOutput("\nScript execution completed successfully!\n");
            sendStep(currentStep, "Script execution completed");
        } else {
            ws.send(`\x03Script execution failed with exit code ${code}`);
        }
    });

    return onData;
};

module.exports = async (ws, context) => {
    const { auditLogId, serverSession, script } = context;
    let { ssh } = context;
    const connectionStartTime = Date.now();

    ws.send(`\x0A${script.name}`);

    ssh.on("ready", () => {
        const transformedScript = transformScript(script.content);
        
        ssh.exec(transformedScript, { pty: { term: "xterm-256color" } }, (err, stream) => {
            if (err) {
                ws.close(4008, `Exec error: ${err.message}`);
                return;
            }

            if (serverSession) {
                SessionManager.setConnection(serverSession.sessionId, { ssh, stream, auditLogId });
            }

            ws.send(`\x01Starting script execution: ${script.name}\n`);
            
            const onData = setupScriptStreamHandlers(ws, stream);

            ws.on("close", async () => {
                stream.removeListener("data", onData);
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
                ssh.end();
                if (serverSession) SessionManager.remove(serverSession.sessionId);
            });
        });
    });

    setupSSHEventHandlers(ssh, ws, { auditLogId, serverSession, connectionStartTime });
};
