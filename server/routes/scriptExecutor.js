const { authenticateWS } = require("../utils/wsAuth");
const { getScript } = require("../controllers/script");
const { transformScript, processNextermLine, checkSudoPrompt } = require("../utils/scriptUtils");

const executeScript = async (ssh, ws, scriptContent) => {
    let currentStep = 1;
    let pendingInput = null;

    const sendStep = (stepNum, message) => ws.send(`\x02${stepNum},${message}`);
    const sendOutput = (data) => ws.send(`\x01${data}`);
    const sendPrompt = (promptData) => ws.send(`\x05${JSON.stringify(promptData)}`);

    const transformedScript = transformScript(scriptContent);

    return new Promise((resolve, reject) => {
        let sshStream;

        const messageHandler = (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === "input_response" && pendingInput && sshStream) {
                    const value = data.value || pendingInput.default || "";

                    if (pendingInput.isSudoPassword) {
                        sshStream.stdin.write(value + "\n");
                        sendOutput("Password entered\n");
                    } else {
                        sendOutput(`${pendingInput.prompt}: ${value}\n`);
                        sshStream.stdin.write(value + "\n");
                    }

                    pendingInput = null;
                } else if (data.type === "input_cancelled") {
                    if (sshStream) sshStream.stdin.write("\x03");
                    reject(new Error("Script execution cancelled by user"));
                }
            } catch (e) {
            }
        };

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
                const nextermCommand = processNextermLine(line);

                if (nextermCommand) {
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
                    }
                } else if (line.trim()) {
                    sendOutput(line + "\n");
                }
            }
        };

        ws.on("message", messageHandler);

        ssh.exec(transformedScript, (err, stream) => {
            if (err) {
                ws.off("message", messageHandler);
                reject(new Error(`Failed to start script execution: ${err.message}`));
                return;
            }

            sshStream = stream;
            let outputBuffer = "";

            sshStream.on("data", (data) => {
                const processedOutput = handleOutput(data);
                if (!processedOutput) return;

                outputBuffer += processedOutput;
                const lines = outputBuffer.split("\n");
                outputBuffer = lines.pop() || "";

                processLines(lines);
            });

            sshStream.stderr.on("data", (data) => {
                const processedOutput = handleOutput(data);
                if (!processedOutput) return;

                if (!["NEXTERM_INPUT", "NEXTERM_SELECT", "NEXTERM_STEP", "NEXTERM_TABLE"].some(cmd => processedOutput.includes(cmd))) {
                    sendOutput(processedOutput);
                }
            });

            sshStream.on("close", (code) => {
                ws.off("message", messageHandler);

                if (code === 0) {
                    sendOutput("\nScript execution completed successfully!\n");
                    sendStep(currentStep, "Script execution completed");
                    resolve();
                } else {
                    reject(new Error(`Script execution failed with exit code ${code}`));
                }
            });

            sshStream.on("error", (error) => {
                ws.off("message", messageHandler);
                reject(new Error(`Script execution error: ${error.message}`));
            });
        });
    });
};

module.exports = async (ws, req) => {
    const authResult = await authenticateWS(ws, req, { requiredParams: ["sessionToken", "serverId", "scriptId"] });

    if (!authResult) return;

    const { user, ssh } = authResult;

    const script = getScript(req.query.scriptId, user.id);
    if (!script) {
        ws.close(4010, "The script does not exist");
        return;
    }

    ssh.on("ready", async () => {
        try {
            ws.send(`\x01Starting script execution: ${script.name}\n`);
            await executeScript(ssh, ws, script.content);
            ssh.end();
        } catch (err) {
            ws.send(`\x03${err.message}`);
            ssh.end();
        }
    });
};
