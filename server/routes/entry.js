const { Router } = require("express");
const { createEntry, deleteEntry, editEntry, getEntry, listEntries, duplicateEntry, importSSHConfig, repositionEntry, getRecentConnections, wakeEntry } = require("../controllers/entry");
const { createServerValidation, updateServerValidation, repositionServerValidation } = require("../validations/server");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * GET /entry/recent
 * @summary Get Recent Connections
 * @description Retrieves a list of recently connected entries for the authenticated user, useful for quick reconnection.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {number} limit.query - Maximum number of recent connections to return (default: 5)
 * @return {array} 200 - List of recent connections with entry details
 */
app.get("/recent", async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    res.json(await getRecentConnections(req.user.id, limit));
});

/**
 * GET /entry/list
 * @summary List User Entries
 * @description Retrieves a list of all entries accessible by the authenticated user, including SSH, RDP, VNC connections, and PVE resources.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user entries
 */
app.get("/list", async (req, res) => {
    res.json(await listEntries(req.user.id));
});

/**
 * GET /entry/{entryId}
 * @summary Get Entry Details
 * @description Retrieves detailed information about a specific entry by its ID, including connection details and configuration.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - Entry details
 * @return {object} 404 - Entry not found
 */
app.get("/:entryId", async (req, res) => {
    const entry = await getEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json(entry);
});

/**
 * PUT /entry
 * @summary Create New Entry
 * @description Creates a new entry configuration with specified protocol (SSH, RDP, or VNC), connection details, and settings.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {CreateServer} request.body.required - Entry configuration including name, protocol, connection details, and folder assignment
 * @return {object} 200 - Entry successfully created with new entry ID
 * @return {object} 400 - Invalid entry configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createServerValidation, req.body)) return;

    const entry = await createEntry(req.user.id, req.body);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully created", id: entry.id });
});

/**
 * DELETE /entry/{entryId}
 * @summary Delete Entry
 * @description Permanently removes an entry configuration from the user's account. This action cannot be undone.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry to delete
 * @return {object} 200 - Entry successfully deleted
 * @return {object} 404 - Entry not found
 */
app.delete("/:entryId", async (req, res) => {
    const entry = await deleteEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully deleted" });
});

/**
 * PATCH /entry/{entryId}
 * @summary Update Entry Configuration
 * @description Updates an existing entry's configuration including name, connection details, folder assignment, or other settings.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry to update
 * @param {UpdateServer} request.body.required - Updated entry configuration fields
 * @return {object} 200 - Entry successfully updated
 * @return {object} 404 - Entry not found
 */
app.patch("/:entryId", async (req, res) => {
    if (validateSchema(res, updateServerValidation, req.body)) return;

    const entry = await editEntry(req.user.id, req.params.entryId, req.body);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully edited" });
});

/**
 * POST /entry/{entryId}/duplicate
 * @summary Duplicate Entry
 * @description Creates a copy of an existing entry configuration with all settings preserved. The new entry will have a similar name but be treated as a separate entity.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry to duplicate
 * @return {object} 200 - Entry successfully duplicated
 * @return {object} 404 - Entry not found
 */
app.post("/:entryId/duplicate", async (req, res) => {
    const entry = await duplicateEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully duplicated" });
});

/**
 * POST /entry/import/ssh-config
 * @summary Import SSH Config
 * @description Imports pre-processed entry configurations with specific identities already assigned.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Entry configurations with identities
 * @return {object} 200 - Entries successfully imported with statistics
 */
app.post("/import/ssh-config", async (req, res) => {
    const result = await importSSHConfig(req.user.id, req.body);
    if (result?.code) return res.json(result);

    res.json(result);
});

/**
 * PATCH /entry/{entryId}/reposition
 * @summary Reposition Entry
 * @description Repositions an entry relative to another entry or at the end of a folder/root. Uses server-side position calculation to ensure consistent ordering.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry to reposition
 * @param {RepositionServer} request.body.required - Reposition parameters
 * @return {object} 200 - Entry successfully repositioned
 * @return {object} 404 - Entry or target not found
 */
app.patch("/:entryId/reposition", async (req, res) => {
    if (validateSchema(res, repositionServerValidation, req.body)) return;

    const result = await repositionEntry(req.user.id, req.params.entryId, req.body);
    if (result?.code) return res.json(result);

    res.json({ message: "Entry successfully repositioned" });
});

/**
 * POST /entry/{entryId}/wake
 * @summary Wake Entry Server
 * @description Sends a Wake-On-LAN magic packet to wake up a server. Requires the server to have a MAC address configured.
 * @tags Entry
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry to wake
 * @return {object} 200 - Wake-On-LAN packet sent successfully
 * @return {object} 400 - No MAC address configured or entry type not supported
 * @return {object} 404 - Entry not found
 */
app.post("/:entryId/wake", async (req, res) => {
    const result = await wakeEntry(req.user.id, req.params.entryId);
    if (result?.code) return res.json(result);

    res.json({ message: "Wake-On-LAN packet sent successfully" });
});

module.exports = app;
