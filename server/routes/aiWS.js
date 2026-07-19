const wsAuth = require("../middlewares/wsAuth");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");
const { getSFTPAIClient, getSessionPassword } = require("../lib/ConnectionService");
const { hasResourcePermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { getRuntimeSettings, isConfigured } = require("../controllers/ai");
const { createAuditLog } = require("../controllers/audit");
const { buildModel, getModelProviderOptions } = require("../lib/ai/providers");
const { buildSystemPrompt } = require("../lib/ai/systemPrompt");
const { createAgent } = require("../lib/ai/agent");

const CONVERSATION_GRACE_MS = 5 * 60 * 1000;

const takeConversation = (session, conversationId) => {
    if (!session.aiConversations) session.aiConversations = new Map();
    let conversation = session.aiConversations.get(conversationId);
    if (!conversation) {
        conversation = { messages: [], reapTimer: null };
        session.aiConversations.set(conversationId, conversation);
    }
    if (conversation.reapTimer) {
        clearTimeout(conversation.reapTimer);
        conversation.reapTimer = null;
    }
    return conversation;
};

const dropConversation = (session, conversationId) => {
    const conversation = session.aiConversations?.get(conversationId);
    if (!conversation) return;
    if (conversation.reapTimer) clearTimeout(conversation.reapTimer);
    session.aiConversations.delete(conversationId);
};

const scheduleReap = (session, conversationId) => {
    const conversation = session.aiConversations?.get(conversationId);
    if (!conversation || conversation.reapTimer) return;
    conversation.reapTimer = setTimeout(() => {
        session.aiConversations?.delete(conversationId);
    }, CONVERSATION_GRACE_MS);
    conversation.reapTimer.unref?.();
};

const waitForConnection = async (sessionId, timeoutMs = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!SessionManager.get(sessionId)) return false;
        if (SessionManager.getConnection(sessionId)) return true;
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
};

module.exports = async function handleAIConnection(ws, req) {
    const context = await wsAuth(ws, req);
    if (!context) return;

    if (context.isShared) return ws.close(4015, "AI is not available in shared sessions");

    const { entry, user, ipAddress, userAgent, serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    if (!await hasResourcePermission(user.id, entry.organizationId, Permission.FILES_VIEW)) {
        return ws.close(4008, "You do not have permission to use the AI assistant on this server");
    }
    const canModify = await hasResourcePermission(user.id, entry.organizationId, Permission.FILES_MODIFY);

    const settings = await getRuntimeSettings();
    if (!isConfigured(settings)) return ws.close(4020, "AI assistant is not configured");

    const sessionId = serverSession.sessionId;
    SessionManager.resume(sessionId);
    if (!await waitForConnection(sessionId)) return ws.close(4014, "Connection not available");

    const session = SessionManager.get(sessionId);
    const conversationId = typeof req.query.conversationId === "string" && req.query.conversationId
        ? req.query.conversationId : `session-${sessionId}`;
    const conversation = takeConversation(session, conversationId);

    const send = (payload) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    };

    const getSftp = () => getSFTPAIClient(sessionId, entry, user.id);
    try {
        await getSftp();
    } catch (err) {
        logger.error("AI assistant failed to open SFTP channel", { sessionId, error: err.message });
        return ws.close(4021, "Failed to open server channel");
    }

    let passwordPromise = null;
    const getPassword = () => {
        if (!passwordPromise) {
            passwordPromise = getSessionPassword(sessionId, entry, user.id).catch((err) => {
                logger.error("AI assistant failed to resolve the session password", { sessionId, error: err.message });
                return null;
            });
        }
        return passwordPromise;
    };

    const pendingApprovals = new Map();
    const requestApproval = (tool, args, callId) => new Promise((resolve) => {
        pendingApprovals.set(callId, resolve);
        send({ type: "confirm-request", callId, tool, args });
    });

    const logAudit = (action, resource, details) => {
        createAuditLog({ accountId: user.id, organizationId: entry.organizationId, action, resource, resourceId: entry.id, details, ipAddress, userAgent })
            .catch((err) => logger.error("Failed to write AI assistant audit log", { action, error: err.message }));
    };

    const resolveApproval = (callId, allowed) => {
        const resolver = pendingApprovals.get(callId);
        if (!resolver) return;
        pendingApprovals.delete(callId);
        resolver(allowed);
    };

    const inFlightTools = new Set();
    const emit = (payload) => {
        if (payload.type === "tool-call") inFlightTools.add(payload.callId);
        else if (payload.type === "tool-result" || payload.type === "tool-error") inFlightTools.delete(payload.callId);
        send(payload);
    };

    let agent;
    try {
        agent = await createAgent({
            model: await buildModel(settings),
            providerOptions: getModelProviderOptions(settings),
            system: await buildSystemPrompt(entry),
            history: conversation.messages,
            getSftp,
            getPassword,
            canModify,
            requireConfirmation: settings.requireConfirmation,
            requestApproval,
            logAudit,
            emit,
        });
    } catch (err) {
        logger.error("AI assistant failed to initialise", { sessionId, error: err.message });
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

    send({ type: "ready", requireConfirmation: settings.requireConfirmation });

    const abortPendingApprovals = () => {
        for (const callId of pendingApprovals.keys()) resolveApproval(callId, false);
    };

    const resetSftpIfBusy = () => {
        if (inFlightTools.size === 0) return;
        inFlightTools.clear();
        const conn = SessionManager.getConnection(sessionId);
        if (conn?.aiClient) {
            try { conn.aiClient.close(); } catch {}
            conn.aiClient = null;
        }
    };

    const handleAbort = () => {
        if (!controller) return;
        controller.abort();
        controller = null;
        abortPendingApprovals();
        resetSftpIfBusy();
        send({ type: "aborted" });
    };

    const startTurn = async (run) => {
        if (controller) return send({ type: "busy" });

        const turn = new AbortController();
        controller = turn;
        inFlightTools.clear();
        SessionManager.updateActivity(sessionId);

        const previous = lastTurn;
        lastTurn = (async () => {
            await previous;
            try {
                if (turn.signal.aborted) return;
                await run(turn.signal);
                if (!turn.signal.aborted) send({ type: "done" });
            } catch (err) {
                if (!turn.signal.aborted) {
                    logger.error("AI assistant turn failed", { sessionId, error: err.message });
                    send({ type: "error", message: err.message });
                }
            } finally {
                SessionManager.updateActivity(sessionId);
                if (controller === turn) controller = null;
            }
        })();
        await lastTurn;
    };

    ws.on("message", async (raw) => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (message.type === "confirm") resolveApproval(message.callId, Boolean(message.allow));
        else if (message.type === "abort") handleAbort();
        else if (message.type === "close") {
            windowClosed = true;
            handleAbort();
            dropConversation(session, conversationId);
            ws.close(1000, "Window closed");
        }
        else if (message.type === "continue") await startTurn((signal) => agent.continueTurn(signal));
        else if (message.type === "prompt") {
            const content = typeof message.content === "string" ? message.content.trim() : "";
            if (content) await startTurn((signal) => agent.runTurn(content, signal));
        }
    });

    ws.on("close", () => {
        clearInterval(keepAlive);
        controller?.abort();
        abortPendingApprovals();
        resetSftpIfBusy();
        if (windowClosed) dropConversation(session, conversationId);
        else scheduleReap(session, conversationId);
    });
};
