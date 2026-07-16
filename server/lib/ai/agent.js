const { buildTools } = require("./tools");

const MAX_STEPS = 25;
const MAX_HISTORY_MESSAGES = 40;

const trimHistory = (messages) => {
    if (messages.length <= MAX_HISTORY_MESSAGES) return;
    let start = messages.length - MAX_HISTORY_MESSAGES;
    while (start < messages.length && messages[start].role !== "user") start++;
    messages.splice(0, start);
};

const createAgent = async ({ model, providerOptions, system, history, getSftp, canModify, requireConfirmation, requestApproval, logAudit, emit }) => {
    const { streamText, stepCountIs, tool } = await import("ai");
    const tools = buildTools({ getSftp, canModify, requireConfirmation, requestApproval, logAudit, tool });
    const messages = history || [];

    const runTurn = async (content, abortSignal) => {
        const turnMessages = [...messages, { role: "user", content }];
        const stepMessages = [];

        const result = streamText({
            model, system, messages: turnMessages, tools,
            stopWhen: stepCountIs(MAX_STEPS), abortSignal, providerOptions,
            onStepFinish: (step) => stepMessages.push(...step.response.messages),
        });

        const commit = (responseMessages) => {
            if (!responseMessages.length) return;
            messages.push({ role: "user", content }, ...responseMessages);
            trimHistory(messages);
        };

        try {
            for await (const part of result.fullStream) {
                if (abortSignal?.aborted) break;
                switch (part.type) {
                    case "text-delta":
                        emit({ type: "text-delta", delta: part.text });
                        break;
                    case "tool-call":
                        emit({ type: "tool-call", callId: part.toolCallId, tool: part.toolName, args: part.input });
                        break;
                    case "tool-result":
                        emit({ type: "tool-result", callId: part.toolCallId, tool: part.toolName, result: part.output });
                        break;
                    case "tool-error":
                        emit({ type: "tool-error", callId: part.toolCallId, tool: part.toolName, error: String(part.error?.message || part.error) });
                        break;
                    case "error":
                        emit({ type: "error", message: String(part.error?.message || part.error) });
                        break;
                }
            }

            if (!abortSignal?.aborted) {
                commit(await result.responseMessages);
                return;
            }
        } catch (err) {
            commit(stepMessages);
            if (abortSignal?.aborted) return;
            throw err;
        }

        commit(stepMessages);
    };

    return { runTurn };
};

module.exports = { createAgent };
