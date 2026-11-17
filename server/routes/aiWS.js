const { authenticateToken } = require("../middlewares/wsAuth");
const { isDemoGuest } = require("../utils/demoMode");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const { validateEntryAccess } = require("../controllers/entry");
const { getRuntimeSettings, isConfigured } = require("../controllers/ai");
const { buildModel, getModelProviderOptions } = require("../lib/ai/providers");
const { buildSystemPrompt } = require("../lib/ai/systemPrompt");
const { createAgent, createPromptLog } = require("../lib/ai/agent");
const { createToolContext } = require("../lib/agentTools/context");
const { summarizeSessions } = require("../lib/agentTools/tools/discovery");
const { buildAiSdkTools, APPROVAL_MODES } = require("../lib/agentTools/adapters");

const CONVERSATION_GRACE_MS = 5 * 60 * 1000;
const conversations = new Map();

const conversationKey = (accountId, conversationId) => `${accountId}:${conversationId}`;

const takeConversation = (accountId, conversationId) => {
    const key = conversationKey(accountId, conversationId);
    let conversation = conversations.get(key);
    if (!conversation) {
        conversation = { messages: [], prompts: createPromptLog(), reapTimer: null };
        conversations.set(key, conversation);
    }
    if (conversation.reapTimer) {
        clearTimeout(conversation.reapTimer);
        conversation.reapTimer = null;
    }
    return conversation;
};

const dropConversation = (accountId, conversationId) => {
    const key = conversationKey(accountId, conversationId);
    const conversation = conversations.get(key);
    if (!conversation) return;
    if (conversation.reapTimer) clearTimeout(conversation.reapTimer);
    conversations.delete(key);
};

const scheduleReap = (accountId, conversationId) => {
    const key = conversationKey(accountId, conversationId);
    const conversation = conversations.get(key);
    if (!conversation || conversation.reapTimer) return;
    conversation.reapTimer = setTimeout(() => conversations.delete(key), CONVERSATION_GRACE_MS);
    conversation.reapTimer.unref?.();
};

const resolveAllowedEntries = async (accountId, entryIds) => {
    const unique = [...new Set((entryIds || []).map(Number).filter(Number.isInteger))];
    if (!unique.length) return [];
    const entries = await Entry.findAll({ where: { id: unique } });
    const checks = await Promise.all(entries.map(async (entry) => ((await validateEntryAccess(accountId, entry)).valid ? entry : null)));
    return checks.filter(Boolean);
};

module.exports = async function handleAIConnection(ws, req) {
    const auth = await authenticateToken(ws, req.query.sessionToken);
    if (!auth) return;
    const { user } = auth;

    if (isDemoGuest(user))
        return ws.close(4020, "The AI assistant is not available in the demo");

    const settings = await getRuntimeSettings();
    if (!isConfigured(settings)) return ws.close(4020, "AI assistant is not configured");

    const conversationId = typeof req.query.conversationId === "string" && req.query.conversationId
        ? req.query.conversationId : `account-${user.id}`;
    const conversation = takeConversation(user.id, conversationId);

    const send = (payload) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    };

    const ipAddress = req.ip || req.socket?.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const ctx = createToolContext({ user, origin: "ai", ipAddress, userAgent, allowedEntryIds: [], ownSessionsOnly: true });
    let allowedEntries = [];
    let activeEntry = null;
    let approvalMode = "ask";
    const pendingApprovals = new Map();
    const pendingQuestions = new Map();
    let questionCounter = 0;

    const settle = (pending, callId, value) => {
        const resolver = pending.get(callId);
        if (!resolver) return;
        pending.delete(callId);
        resolver(value);
    };

    const settleAll = (pending, value) => {
        for (const callId of [...pending.keys()]) settle(pending, callId, value);
    };

    const applyConfig = async ({ allowedEntryIds, activeEntryId, approvalMode: requestedMode }) => {
        if (allowedEntryIds) {
            allowedEntries = await resolveAllowedEntries(user.id, allowedEntryIds);
            ctx.setAllowedEntries(allowedEntries.map((e) => e.id));
        }
        activeEntry = allowedEntries.find((e) => e.id === Number(activeEntryId)) || null;
        if (APPROVAL_MODES.has(requestedMode) && requestedMode !== approvalMode) {
            approvalMode = requestedMode;

            if (approvalMode === "allow") settleAll(pendingApprovals, true);
            if (approvalMode === "readonly") settleAll(pendingApprovals, false);
        }
        send({ type: "config", allowedEntryIds: allowedEntries.map((e) => e.id), activeEntryId: activeEntry?.id ?? null, approvalMode });
    };

    const requestApproval = (tool, args, callId) => new Promise((resolve) => {
        pendingApprovals.set(callId, resolve);
        send({ type: "confirm-request", callId, tool, args });
    });

    ctx.askUser = (question, toolCallId = null) => new Promise((resolve) => {
        const callId = toolCallId || `question-${Date.now()}-${++questionCounter}`;
        pendingQuestions.set(callId, resolve);
        send({ type: "question", callId, ...question });
    });

    const abortPendingApprovals = () => {
        settleAll(pendingApprovals, false);
        settleAll(pendingQuestions, null);
    };

    const openSessions = () => summarizeSessions(SessionManager.getAutomated(user.id).filter((s) => ctx.canUseSession(s)));

    let agent;
    try {
        agent = await createAgent({
            model: await buildModel(settings),
            providerOptions: getModelProviderOptions(settings),
            system: async () => buildSystemPrompt({ allowedEntries, activeEntry, openSessions: await openSessions() }),
            history: conversation.messages,
            prompts: conversation.prompts,
            buildTools: (tool) => buildAiSdkTools({ tool, ctx, getApprovalMode: () => approvalMode, requestApproval }),
            emit: send,
        });
    } catch (err) {
        logger.error("AI assistant failed to initialise", { error: err.message });
        return ws.close(4022, "Failed to initialise assistant");
    }

    let controller = null;
    let lastTurn = Promise.resolve();
    let windowClosed = false;

    let alive = true;
    ws.on("pong", () => { alive = true; });
    const keepAlive = setInterval(() => {
        if (ws.readyState !== ws.OPEN) return;
        if (!alive) return ws.terminate();
        alive = false;
        try { ws.ping(); } catch {}
    }, 30000);

    const boundSession = typeof req.query.sessionId === "string" ? SessionManager.get(req.query.sessionId) : null;
    if (boundSession && boundSession.accountId === user.id && !boundSession.automated) {
        await applyConfig({ allowedEntryIds: [boundSession.entryId], activeEntryId: boundSession.entryId });
    }

    send({ type: "ready", approvalMode, sessions: await openSessions() });

    const handleAbort = () => {
        if (!controller) return;
        controller.abort();
        controller = null;
        abortPendingApprovals();
        send({ type: "aborted" });
    };

    const startTurn = async (run) => {
        if (controller) return send({ type: "busy" });

        const turn = new AbortController();
        controller = turn;

        const previous = lastTurn;
        lastTurn = (async () => {
            await previous;
            try {
                if (turn.signal.aborted) return;
                await run(turn.signal);
                if (!turn.signal.aborted) send({ type: "done", sessions: await openSessions() });
            } catch (err) {
                if (!turn.signal.aborted) {
                    logger.error("AI assistant turn failed", { error: err.message });
                    send({ type: "error", message: err.message });
                }
            } finally {
                if (controller === turn) controller = null;
            }
        })();
        await lastTurn;
    };

    const beginTurn = (run) => {
        startTurn(run).catch((err) => logger.error("AI assistant turn failed", { error: err.message }));
    };

    const promptIdOf = (value) => (typeof value === "string" && value.length <= 64 ? value : null);
    const contentOf = (message) => (typeof message.content === "string" ? message.content.trim() : "");

    const handleMessage = async (raw) => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (message.type === "config") await applyConfig(message);
        else if (message.type === "confirm") settle(pendingApprovals, message.callId, Boolean(message.allow));
        else if (message.type === "answer") settle(pendingQuestions, message.callId, message.answer ?? null);
        else if (message.type === "abort") handleAbort();
        else if (message.type === "close") {
            windowClosed = true;
            handleAbort();
            dropConversation(user.id, conversationId);
            ws.close(1000, "Window closed");
        }
        else if (message.type === "continue") beginTurn((signal) => agent.continueTurn(signal));
        else if (message.type === "prompt") {
            const content = contentOf(message);
            if (content) beginTurn((signal) => agent.runTurn(content, signal, promptIdOf(message.promptId)));
        }
        else if (message.type === "edit") {
            const content = contentOf(message);
            if (content) beginTurn((signal) => {
                if (!agent.rewindTo(promptIdOf(message.promptId))) throw new Error("This message can no longer be edited.");
                return agent.runTurn(content, signal, promptIdOf(message.newPromptId));
            });
        }
    };

    let inbox = Promise.resolve();
    ws.on("message", (raw) => {
        inbox = inbox.then(() => handleMessage(raw))
            .catch((err) => logger.error("AI assistant message failed", { error: err.message }));
    });

    ws.on("close", () => {
        clearInterval(keepAlive);
        controller?.abort();
        abortPendingApprovals();
        if (windowClosed) dropConversation(user.id, conversationId);
        else scheduleReap(user.id, conversationId);
    });
};
