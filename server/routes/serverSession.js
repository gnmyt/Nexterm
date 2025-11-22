const { Router } = require("express");
const { createSession, getSessions, hibernateSession, resumeSession, deleteSession } = require("../controllers/serverSession");
const { createSessionValidation, sessionIdValidation } = require("../validations/serverSession");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * POST /server-sessions
 * @summary Create Server Session
 * @description Creates a new server session.
 * @tags Server Session
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Session creation details
 * @return {object} 201 - Session created
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, createSessionValidation, req.body)) return;
    
    try {
        const { entryId, identityId, connectionReason } = req.body;
        const result = await createSession(req.user.id, entryId, identityId, connectionReason);
        
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
 * GET /server-sessions
 * @summary Get Server Sessions
 * @description Retrieves all active server sessions for the user.
 * @tags Server Session
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of sessions
 */
app.get("/", async (req, res) => {
    res.json(await getSessions(req.user.id));
});

/**
 * POST /server-sessions/{id}/hibernate
 * @summary Hibernate Session
 * @description Hibernates a server session.
 * @tags Server Session
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
 * POST /server-sessions/{id}/resume
 * @summary Resume Session
 * @description Resumes a hibernated server session.
 * @tags Server Session
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.post("/:id/resume", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    
    const result = await resumeSession(req.params.id);
    if (result?.code) {
        return res.status(result.code).json({ error: result.message });
    }
    res.json(result);
});

/**
 * DELETE /server-sessions/{id}
 * @summary Delete Session
 * @description Deletes a server session.
 * @tags Server Session
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
