const { Router } = require("express");
const { createServer, deleteServer, editServer, getServer, listServers, duplicateServer, importSSHConfig } = require("../controllers/server");
const { createServerValidation, updateServerValidation } = require("../validations/server");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * GET /server/list
 * @summary List User Servers
 * @description Retrieves a list of all servers accessible by the authenticated user, including SSH, RDP, and VNC connections.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user servers
 */
app.get("/list", async (req, res) => {
    res.json(await listServers(req.user.id));
});

/**
 * GET /server/{serverId}
 * @summary Get Server Details
 * @description Retrieves detailed information about a specific server by its ID, including connection details and configuration.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the server
 * @return {object} 200 - Server details
 * @return {object} 404 - Server not found
 */
app.get("/:serverId", async (req, res) => {
    const server = await getServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json(server);
});

/**
 * PUT /server
 * @summary Create New Server
 * @description Creates a new server connection configuration with specified protocol (SSH, RDP, or VNC), connection details, and settings.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {CreateServer} request.body.required - Server configuration including name, protocol, connection details, and folder assignment
 * @return {object} 200 - Server successfully created with new server ID
 * @return {object} 400 - Invalid server configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createServerValidation, req.body)) return;

    const server = await createServer(req.user.id, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully created", id: server.id });
});

/**
 * DELETE /server/{serverId}
 * @summary Delete Server
 * @description Permanently removes a server configuration from the user's account. This action cannot be undone.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the server to delete
 * @return {object} 200 - Server successfully deleted
 * @return {object} 404 - Server not found
 */
app.delete("/:serverId", async (req, res) => {
    const server = await deleteServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully deleted" });
});

/**
 * PATCH /server/{serverId}
 * @summary Update Server Configuration
 * @description Updates an existing server's configuration including name, connection details, folder assignment, or other settings.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the server to update
 * @param {UpdateServer} request.body.required - Updated server configuration fields
 * @return {object} 200 - Server successfully updated
 * @return {object} 404 - Server not found
 */
app.patch("/:serverId", async (req, res) => {
    if (validateSchema(res, updateServerValidation, req.body)) return;

    const server = await editServer(req.user.id, req.params.serverId, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully edited" });
});

/**
 * POST /server/{serverId}/duplicate
 * @summary Duplicate Server
 * @description Creates a copy of an existing server configuration with all settings preserved. The new server will have a similar name but be treated as a separate entity.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the server to duplicate
 * @return {object} 200 - Server successfully duplicated
 * @return {object} 404 - Server not found
 */
app.post("/:serverId/duplicate", async (req, res) => {
    const server = await duplicateServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully duplicated" });
});

/**
 * POST /server/import/ssh-config
 * @summary Import SSH Config
 * @description Imports pre-processed server configurations with specific identities already assigned.
 * @tags Server
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Server configurations with identities
 * @return {object} 200 - Servers successfully imported with statistics
 */
app.post("/import/ssh-config", async (req, res) => {
    const result = await importSSHConfig(req.user.id, req.body);
    if (result?.code) return res.json(result);

    res.json(result);
});

module.exports = app;