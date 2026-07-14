const wsAuth = require("../middlewares/wsAuth");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");
const { getSFTPAIClient } = require("../lib/ConnectionService");
const { hasResourcePermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { getRuntimeSettings, isConfigured } = require("../controllers/ai");
const { createAuditLog } = require("../controllers/audit");
const { buildModel } = require("../lib/ai/providers");
const { buildSystemPrompt } = require("../lib/ai/systemPrompt");
const { createAgent } = require("../lib/ai/agent");

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

    const send = (payload) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    };

    let sftp;
    try {
        sftp = await getSFTPAIClient(sessionId, entry, user.id);
    } catch (err) {
        logger.error("AI assistant failed to open SFTP channel", { sessionId, error: err.message });
        return ws.close(4021, "Failed to open server channel");
    }

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

    let agent;
    try {
        agent = await createAgent({
            model: await buildModel(settings),
            system: await buildSystemPrompt(entry),
            sftp,
            canModify,
            requireConfirmation: settings.requireConfirmation,
            requestApproval,
            logAudit,
            emit: send,
        });
    } catch (err) {
        logger.error("AI assistant failed to initialise", { sessionId, error: err.message });
        return ws.close(4022, "Failed to initialise assistant");
    }

    let controller = null;

    send({ type: "ready", requireConfirmation: settings.requireConfirmation });

    const abortPendingApprovals = () => {
        for (const callId of pendingApprovals.keys()) resolveApproval(callId, false);
    };

    const handleAbort = () => {
        if (!controller) return;
        controller.abort();
        controller = null;
        abortPendingApprovals();
        send({ type: "aborted" });
    };

    const handlePrompt = async (message) => {
        const content = typeof message.content === "string" ? message.content.trim() : "";
        if (!content) return;
        if (controller) return send({ type: "busy" });

        const turn = new AbortController();
        controller = turn;
        SessionManager.updateActivity(sessionId);

        try {
            await agent.runTurn(content, turn.signal);
            if (!turn.signal.aborted) send({ type: "done" });
        } catch (err) {
            if (!turn.signal.aborted) {
                logger.error("AI assistant turn failed", { sessionId, error: err.message });
                send({ type: "error", message: err.message });
            }
        } finally {
            if (controller === turn) controller = null;
        }
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
        else if (message.type === "prompt") await handlePrompt(message);
    });

    ws.on("close", () => {
        controller?.abort();
        abortPendingApprovals();
    });
};
