const { buildTools } = require("./tools");
const logger = require("../../utils/logger");

const MAX_STEPS = 25;
const MAX_HISTORY_MESSAGES = 240;

const COMPACT_TOKEN_THRESHOLD = Number(process.env.AI_COMPACT_TOKENS) || 100000;
const KEEP_RECENT_MESSAGES = 20;

const estimateTokens = (messages) => JSON.stringify(messages).length / 4;

const COMPACT_SYSTEM = "You compact a transcript of an AI assistant operating on a remote server. "
    + "Write a dense factual summary that lets the assistant continue without the original messages.";

const COMPACT_INSTRUCTION = "Summarise everything above as a handover note for yourself. Preserve: the user's goals and "
    + "any still-open request, what you already inspected and what you found (exact paths, hostnames, versions, config "
    + "values), every change you made, commands that failed and why, and any decision or constraint the user stated. "
    + "Drop chit-chat and superseded detail. Write it as notes, not prose. Do not invent anything.";

const findCompactBoundary = (messages) => {
    let boundary = Math.max(0, messages.length - KEEP_RECENT_MESSAGES);
    while (boundary > 0 && messages[boundary].role !== "user") boundary--;
    return boundary;
};

const trimHistory = (messages) => {
    if (messages.length <= MAX_HISTORY_MESSAGES) return;

    let start = messages.length - MAX_HISTORY_MESSAGES;
    while (start > 0 && messages[start].role !== "user") start--;
    if (start > 0) messages.splice(0, start);
    if (messages.length <= MAX_HISTORY_MESSAGES) return;

    let cut = messages.length - MAX_HISTORY_MESSAGES + 1;
    while (cut < messages.length && messages[cut].role !== "assistant") cut++;
    if (cut < messages.length) messages.splice(1, cut - 1);
};

const createAgent = async ({ model, providerOptions, system, history, getSftp, getPassword, canModify, requireConfirmation, requestApproval, logAudit, emit }) => {
    const { streamText, generateText, stepCountIs, pruneMessages, tool } = await import("ai");
    const tools = buildTools({ getSftp, getPassword, canModify, requireConfirmation, requestApproval, logAudit, tool });
    const messages = history || [];

    const compact = async (abortSignal) => {
        if (estimateTokens(messages) < COMPACT_TOKEN_THRESHOLD) return;

        const boundary = findCompactBoundary(messages);
        if (boundary <= 0) return;

        const older = messages.slice(0, boundary);
        const { text } = await generateText({
            model, providerOptions, abortSignal,
            system: COMPACT_SYSTEM,
            messages: [...older, { role: "user", content: COMPACT_INSTRUCTION }],
        });
        if (!text) return;

        messages.splice(0, boundary,
            { role: "user", content: `[Summary of earlier conversation]\n${text}` },
            { role: "assistant", content: "Understood. Continuing from that summary." },
        );
        emit({ type: "compacted" });
    };

    const stream = async (turnMessages, prefix, abortSignal) => {
        const stepMessages = [];
        let steps = 0;

        const result = streamText({
            model, system, messages: turnMessages, tools,
            stopWhen: stepCountIs(MAX_STEPS), abortSignal, providerOptions,
            onStepFinish: (step) => {
                steps++;
                stepMessages.push(...step.response.messages);
            },
            prepareStep: ({ messages: stepMsgs }) => {
                if (estimateTokens(stepMsgs) < COMPACT_TOKEN_THRESHOLD) return {};
                return {
                    messages: pruneMessages({
                        messages: stepMsgs,
                        reasoning: "all",
                        toolCalls: "before-last-3-messages",
                        emptyMessages: "remove",
                    }),
                };
            },
        });

        const commit = (responseMessages) => {
            if (!responseMessages.length) return;
            messages.push(...prefix, ...responseMessages);
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
                if (steps >= MAX_STEPS && (await result.finishReason) === "tool-calls") {
                    emit({ type: "step-limit" });
                }
                return;
            }
        } catch (err) {
            commit(stepMessages);
            if (abortSignal?.aborted) return;
            throw err;
        }

        commit(stepMessages);
    };


    const compactSafely = async (abortSignal) => {
        try {
            await compact(abortSignal);
        } catch (err) {
            if (!abortSignal?.aborted) logger.error("AI assistant failed to compact history", { error: err.message });
        }
    };

    const runTurn = async (content, abortSignal) => {
        await compactSafely(abortSignal);
        return stream([...messages, { role: "user", content }], [{ role: "user", content }], abortSignal);
    };

    const continueTurn = async (abortSignal) => {
        await compactSafely(abortSignal);
        return stream([...messages], [], abortSignal);
    };

    return { runTurn, continueTurn };
};

module.exports = { createAgent };
