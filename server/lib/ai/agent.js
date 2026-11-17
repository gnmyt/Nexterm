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

const createPromptLog = () => ({ order: [], objects: new Map(), committed: new Set(), summaries: new WeakSet() });

const createAgent = async ({ model, providerOptions, system, history, buildTools, emit, prompts = createPromptLog() }) => {
    const { streamText, generateText, stepCountIs, pruneMessages, tool } = await import("ai");
    const tools = buildTools(tool);
    const messages = history || [];
    const resolveSystem = async () => (typeof system === "function" ? await system() : system);

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

        const summary = { role: "user", content: `[Summary of earlier conversation]\n${text}` };
        prompts.summaries.add(summary);
        messages.splice(0, boundary, summary, { role: "assistant", content: "Understood. Continuing from that summary." });
        emit({ type: "compacted" });
    };

    const stream = async (turnMessages, prefix, abortSignal, onCommit = null) => {
        const stepMessages = [];
        let steps = 0;
        let pendingText = "";
        let errorReported = false;
        let committed = false;

        const result = streamText({
            model, system: await resolveSystem(), messages: turnMessages, tools,
            stopWhen: stepCountIs(MAX_STEPS), abortSignal, providerOptions,
            onStepFinish: (step) => {
                steps++;
                pendingText = "";
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
            if (committed) return;
            committed = true;
            onCommit?.();
            messages.push(...prefix, ...responseMessages);
            trimHistory(messages);
        };

        const partial = () => (pendingText.trim()
            ? [...stepMessages, { role: "assistant", content: pendingText }]
            : stepMessages);

        try {
            for await (const part of result.fullStream) {
                if (abortSignal?.aborted) break;
                switch (part.type) {
                    case "text-delta":
                        pendingText += part.text;
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
                        errorReported = true;
                        emit({ type: "error", message: String(part.error?.message || part.error) });
                        break;
                }
            }

            if (errorReported) return commit(partial());

            if (!abortSignal?.aborted) {
                commit(await result.responseMessages);
                if (steps >= MAX_STEPS && (await result.finishReason) === "tool-calls") {
                    emit({ type: "step-limit" });
                }
                return;
            }
        } catch (err) {
            commit(partial());
            if (abortSignal?.aborted || errorReported) return;
            throw err;
        }

        commit(partial());
    };


    const compactSafely = async (abortSignal) => {
        try {
            await compact(abortSignal);
        } catch (err) {
            if (!abortSignal?.aborted) logger.error("AI assistant failed to compact history", { error: err.message });
        }
    };

    const runTurn = async (content, abortSignal, promptId = null) => {
        await compactSafely(abortSignal);
        const prompt = { role: "user", content };
        if (promptId) {
            if (!prompts.order.includes(promptId)) prompts.order.push(promptId);
            prompts.objects.set(promptId, prompt);
        }
        return stream([...messages, prompt], [prompt], abortSignal, () => promptId && prompts.committed.add(promptId));
    };

    const rewindTo = (promptId) => {
        const at = prompts.order.indexOf(promptId);
        if (at === -1) return false;
        const removed = prompts.order.slice(at);

        let cut = -1;
        for (const id of removed) {
            const index = messages.indexOf(prompts.objects.get(id));
            if (index !== -1) {
                cut = index;
                break;
            }
            if (prompts.committed.has(id)) {
                cut = prompts.summaries.has(messages[0]) ? 2 : 0;
                break;
            }
        }
        if (cut !== -1) messages.splice(cut);

        for (const id of removed) {
            prompts.objects.delete(id);
            prompts.committed.delete(id);
        }
        prompts.order.length = at;
        return true;
    };

    const continueTurn = async (abortSignal) => {
        if (!messages.length) return;
        await compactSafely(abortSignal);
        return stream([...messages], [], abortSignal);
    };

    return { runTurn, continueTurn, rewindTo };
};

module.exports = { createAgent, createPromptLog };
