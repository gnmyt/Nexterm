const { Router } = require("express");
const { createSession, getSessions, hibernateSession, resumeSession, deleteSession } = require("../controllers/serverSession");
const { createSessionValidation, sessionIdValidation, resumeSessionValidation } = require("../validations/serverSession");
const { validateSchema } = require("../utils/schema");

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
        const { entryId, identityId, connectionReason, type, directIdentity, tabId, browserId } = req.body;
        const result = await createSession(req.user.id, entryId, identityId, connectionReason, type, directIdentity, tabId, browserId);
        
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
    res.json(result);
});

module.exports = app;
