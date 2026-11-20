const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { createSession, answerTrustChallenge, reconnectSession, getSessions, getSession, hibernateSession, resumeSession, deleteSession, startSharing, stopSharing, updateSharePermissions, duplicateSession, pasteIdentityPassword } = require("../controllers/serverSession");
const { execCommand } = require("../controllers/execCommand");
const { createSessionValidation, reconnectSessionValidation, sessionIdValidation, resumeSessionValidation, duplicateSessionValidation, trustDecisionValidation, shareValidation, pastePasswordValidation, execCommandValidation, execCommandQuery } = require("../validations/serverSession");
const stateBroadcaster = require("../lib/StateBroadcaster");
const SessionManager = require("../lib/SessionManager");
const { isDemoGuest, DEMO_SETTINGS } = require("../utils/demoMode");

const app = Router();

const limitGuestSessions = (req, res, next) => {
    if (isDemoGuest(req.user) && SessionManager.getAll(req.user.id).length >= DEMO_SETTINGS.maxSessionsPerGuest)
        return res.status(429).json({ error: "You reached the session limit of the demo. Close a session to open a new one." });
    next();
};

const blockWritableGuestShares = (req, res, next) => {
    if (isDemoGuest(req.user) && req.body?.writable === true)
        return res.status(403).json({ error: "Writable share links are not available in the demo" });
    next();
};

const sendError = (res, result) =>
    res.status(result.code).json({ error: result.message, ...(result.errorCode && { code: result.errorCode }) });
const getSessionOptions = (req) => {
    const { entryId, identityId, connectionReason, type, directIdentity, tabId, browserId, displayDpi, displayWidth, displayHeight, scriptId, startPath, trustPrompt, connectionGeneration } = req.body;
    return {
        accountId: req.user.id,
        authSessionId: req.session?.id || null,
        entryId,
        identityId,
        connectionReason,
        type,
        directIdentity,
        tabId,
        browserId,
        displayDpi,
        displayWidth,
        displayHeight,
        scriptId,
        startPath,
        trustPrompt: trustPrompt === true,
        connectionGeneration,
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };
};

app.post("/", limitGuestSessions, route({
    summary: "Create connection",
    status: 201,
    description: "Creates a new server connection.",
    body: createSessionValidation,
}), async (req, res) => {
    try {
        const result = await createSession(getSessionOptions(req));
        
        if (result?.code) {
            return sendError(res, result);
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post("/:id/reconnect", route({
    summary: "Reconnect connection",
    description: "Re-establishes a connection whose link to the server was lost, keeping its id.",
    params: sessionIdValidation,
    body: reconnectSessionValidation,
}), async (req, res) => {
    try {
        const result = await reconnectSession({
            ...getSessionOptions(req),
            sessionId: req.params.id,
        });
        if (result?.code) {
            return sendError(res, result);
        }
        res.json(result);
    } catch (error) {
        console.error('Error reconnecting session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get("/", route({
    summary: "Get connections",
    description: "Retrieves all active server connections for the user.",
    returns: objectList,
}), async (req, res) => {
    const { tabId, browserId } = req.query;
    res.json(await getSessions(req.user.id, tabId, browserId));
});

app.get("/:id", route({
    summary: "Get connection",
    description: "Retrieves a specific server connection.",
    params: sessionIdValidation,
}), async (req, res) => {
    const result = await getSession(req.user.id, req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    res.json(result);
});

app.post("/:id/trust", route({
    summary: "Answer certificate question",
    description: "Accepts or rejects the certificate or host key a connection is waiting on. Accepting stores it as trusted and connects again.",
    params: sessionIdValidation,
    body: trustDecisionValidation,
}), async (req, res) => {
    const result = await answerTrustChallenge(req.user.id, req.params.id, req.body, {
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });
    if (result?.code) return res.status(result.code).json({ error: result.message });
    res.json(result);
});

app.post("/:id/hibernate", route({
    summary: "Hibernate connection",
    description: "Hibernates a server connection.",
    params: sessionIdValidation,
}), async (req, res) => {
    const result = await hibernateSession(req.user.id, req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.post("/:id/resume", route({
    summary: "Resume connection",
    description: "Resumes a hibernated server connection.",
    params: sessionIdValidation,
    body: resumeSessionValidation,
}), async (req, res) => {
    const { tabId, browserId } = req.body;
    const result = await resumeSession(req.user.id, req.params.id, tabId, browserId, req.session?.id || null);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.delete("/:id", route({
    summary: "Delete connection",
    description: "Deletes a server connection.",
    params: sessionIdValidation,
}), async (req, res) => {
    const result = await deleteSession(req.user.id, req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.post("/:id/share", blockWritableGuestShares, route({
    summary: "Start sharing",
    description: "Starts sharing a session.",
    params: sessionIdValidation,
    body: shareValidation,
}), (req, res) => {
    const result = startSharing(req.user.id, req.params.id, req.body.writable === true);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.delete("/:id/share", route({
    summary: "Stop sharing",
    description: "Stops sharing a session.",
    params: sessionIdValidation,
}), (req, res) => {
    const result = stopSharing(req.user.id, req.params.id);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.patch("/:id/share", blockWritableGuestShares, route({
    summary: "Update share permissions",
    description: "Updates share permissions for a session.",
    params: sessionIdValidation,
    body: shareValidation,
}), (req, res) => {
    const result = updateSharePermissions(req.user.id, req.params.id, req.body.writable === true);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

app.post("/:id/duplicate", limitGuestSessions, route({
    summary: "Duplicate connection",
    status: 201,
    description: "Creates a new connection with the same configuration as an existing one.",
    params: sessionIdValidation,
    body: duplicateSessionValidation,
}), async (req, res) => {
    const { tabId, browserId } = req.body;
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const result = await duplicateSession(req.user.id, req.params.id, tabId, browserId, ipAddress, userAgent, req.session?.id || null);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.status(201).json(result);
});

app.post("/:id/paste-password", route({
    summary: "Paste identity password into session",
    description: "Inserts the password of an identity attached to the session's server into the active session stream. Defaults to the session's identity; an optional identityId in the body selects another identity attached to the same server.",
    params: sessionIdValidation,
    body: pastePasswordValidation,
}), async (req, res) => {
    const identityId = req.body.identityId ?? null;
    const submit = req.body.submit === true;

    try {
        const result = await pasteIdentityPassword(req.user.id, req.params.id, req.ip, req.headers?.["user-agent"], identityId, submit);
        if (result?.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch (error) {
        console.error('Error pasting identity password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post("/:entryId/exec", route({
    summary: "Execute command",
    description: "Executes a single command on a server entry and returns the output.",
    query: execCommandQuery,
    body: execCommandValidation,
}), async (req, res) => {
    try {
        const entryId = parseInt(req.params.entryId, 10);
        if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

        const { command, connectionReason } = req.body;
        const result = await execCommand(req.user.id, entryId, req.query.identityId ?? null, command, {
            connectionReason: connectionReason?.trim() || null,
            ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
        });

        if (result?.code) {
            return sendError(res, result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = app;
