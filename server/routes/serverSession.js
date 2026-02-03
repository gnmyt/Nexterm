const { Router } = require("express");
const { createSession, getSessions, getSession, hibernateSession, resumeSession, deleteSession, startSharing, stopSharing, updateSharePermissions, duplicateSession, reconnectSession, pasteIdentityPassword } = require("../controllers/serverSession");
const { createSessionValidation, sessionIdValidation, resumeSessionValidation, duplicateSessionValidation, reconnectSessionValidation } = require("../validations/serverSession");
const { validateSchema } = require("../utils/schema");
const stateBroadcaster = require("../lib/StateBroadcaster");

const app = Router();

/**
 * POST /connections
 * @summary Create Connection
 * @description Creates a new server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Session creation details
 * @return {object} 201 - Session created
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, createSessionValidation, req.body)) return;
    
    try {
        const { entryId, identityId, connectionReason, type, directIdentity, tabId, browserId, scriptId, startPath } = req.body;
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const result = await createSession(req.user.id, entryId, identityId, connectionReason, type, directIdentity, tabId, browserId, scriptId, startPath, ipAddress, userAgent);
        
        if (result?.code) {
            return res.status(result.code).json({ error: result.message });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /connections
 * @summary Get Connections
 * @description Retrieves all active server connections for the user.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of sessions
 */
app.get("/", async (req, res) => {
    const { tabId, browserId } = req.query;
    res.json(await getSessions(req.user.id, tabId, browserId));
});

/**
 * GET /connections/{id}
 * @summary Get Connection
 * @description Retrieves a specific server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Session details
 */
app.get("/:id", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    
    const result = await getSession(req.user.id, req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    res.json(result);
});

/**
 * POST /connections/{id}/hibernate
 * @summary Hibernate Connection
 * @description Hibernates a server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.post("/:id/hibernate", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    
    const result = await hibernateSession(req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/resume
 * @summary Resume Connection
 * @description Resumes a hibernated server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.post("/:id/resume", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    if (validateSchema(res, resumeSessionValidation, req.body)) return;
    
    const { tabId, browserId } = req.body;
    const result = await resumeSession(req.params.id, tabId, browserId);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * DELETE /connections/{id}
 * @summary Delete Connection
 * @description Deletes a server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.delete("/:id", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    
    const result = await deleteSession(req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/share
 * @summary Start Sharing
 * @description Starts sharing a session.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Share details
 */
app.post("/:id/share", (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const result = startSharing(req.user.id, req.params.id, req.body?.writable === true);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * DELETE /connections/{id}/share
 * @summary Stop Sharing
 * @description Stops sharing a session.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.delete("/:id/share", (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const result = stopSharing(req.user.id, req.params.id);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * PATCH /connections/{id}/share
 * @summary Update Share Permissions
 * @description Updates share permissions for a session.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Updated permissions
 */
app.patch("/:id/share", (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const result = updateSharePermissions(req.user.id, req.params.id, req.body?.writable === true);
    if (result?.code) return res.status(result.code).json({ error: result.message });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/duplicate
 * @summary Duplicate Connection
 * @description Creates a new connection with the same configuration as an existing one.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 201 - New session created
 */
app.post("/:id/duplicate", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    if (validateSchema(res, duplicateSessionValidation, req.body)) return;
    
    const { tabId, browserId } = req.body;
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const result = await duplicateSession(req.user.id, req.params.id, tabId, browserId, ipAddress, userAgent);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.status(201).json(result);
});

/**
 * POST /connections/{id}/reconnect
 * @summary Reconnect Connection
 * @description Restarts a server connection using the same session configuration.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 201 - New session created
 */
app.post("/:id/reconnect", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    if (validateSchema(res, reconnectSessionValidation, req.body)) return;

    const { tabId, browserId } = req.body;
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await reconnectSession(req.user.id, req.params.id, tabId, browserId, ipAddress, userAgent);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.status(201).json(result);
});

/**
 * POST /connections/{id}/paste-password
 * @summary Paste identity password into session
 * @description Inserts the password of the identity attached to the session into the active session stream.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 */
app.post("/:id/paste-password", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;

    try {
        const result = await pasteIdentityPassword(req.user.id, req.params.id, req.ip, req.headers?.["user-agent"]);
        if (result?.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch (error) {
        console.error('Error pasting identity password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = app;
