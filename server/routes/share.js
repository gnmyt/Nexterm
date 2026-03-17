const { Router } = require("express");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const Organization = require("../models/Organization");

const app = Router();

/**
 * GET /share/{shareId}
 * @summary Get Shared Session Details
 * @description Retrieves information about a shared session by its unique share ID. Returns session details including the associated entry information, permissions, and organization context. This endpoint is used to access sessions that have been shared by other users.
 * @tags Share
 * @produces application/json
 * @param {string} shareId.path.required - The unique identifier of the shared session
 * @return {object} 200 - Shared session details including server info, permissions, and organization
 * @return {object} 404 - Shared session or associated entry not found
 */
app.get("/:shareId", async (req, res) => {
    const session = SessionManager.getByShareId(req.params.shareId);
    if (!session) return res.status(404).json({ error: "Shared session not found" });

    const entry = await Entry.findByPk(session.entryId, {
        attributes: ["id", "name", "type", "icon", "config", "organizationId"],
    });
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const orgName = entry.organizationId
        ? (await Organization.findByPk(entry.organizationId, { attributes: ["name"] }))?.name
        : null;

    res.json({
        id: session.sessionId,
        server: {
            id: entry.id,
            name: entry.name,
            type: entry.type,
            icon: entry.icon,
            renderer: session.configuration.renderer || "terminal",
            protocol: entry.config?.protocol,
        },
        writable: session.shareWritable,
        type: session.configuration.type || undefined,
        organizationId: entry.organizationId || null,
        organizationName: orgName,
    });
});

module.exports = app;
