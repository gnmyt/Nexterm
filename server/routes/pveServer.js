const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { getPVEServer, createPVEServer, deletePVEServer, editPVEServer, getPVEServerUnsafe } = require("../controllers/pveServer");
const { createPVEServerValidation, updatePVEServerValidation } = require("../validations/pveServer");
const { startPVEServer, shutdownPVEServer, stopPVEServer } = require("../controllers/pve");
const { updatePVEAccount } = require("../utils/pveUpdater");

const app = Router();

/**
 * GET /pveServer/{serverId}
 * @summary Get PVE Server Details
 * @description Retrieves detailed information about a specific Proxmox VE server configuration including connection details and VM/container information.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the PVE server
 * @return {object} 200 - PVE server details
 * @return {object} 404 - PVE server not found
 */
app.get("/:serverId", async (req, res) => {
    const server = await getPVEServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json(server);
});

/**
 * PUT /pveServer
 * @summary Create PVE Server
 * @description Creates a new Proxmox VE server configuration for managing virtual machines and containers.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @requestBody {object} - PVE server configuration including connection details and authentication
 * @return {object} 200 - PVE server successfully created with new server ID
 * @return {object} 400 - Invalid PVE server configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createPVEServerValidation, req.body)) return;

    const server = await createPVEServer(req.user.id, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully created", id: server.id });
});

/**
 * DELETE /pveServer/{serverId}
 * @summary Delete PVE Server
 * @description Permanently removes a Proxmox VE server configuration from the user's account.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the PVE server to delete
 * @return {object} 200 - PVE server successfully deleted
 * @return {object} 404 - PVE server not found
 */
app.delete("/:serverId", async (req, res) => {
    const server = await deletePVEServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully deleted" });
});

/**
 * PATCH /pveServer/{serverId}
 * @summary Update PVE Server
 * @description Updates an existing Proxmox VE server's configuration such as connection details or authentication credentials.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the PVE server to update
 * @requestBody {object} - Updated PVE server configuration fields
 * @return {object} 200 - PVE server successfully updated
 * @return {object} 404 - PVE server not found
 */
app.patch("/:serverId", async (req, res) => {
    if (validateSchema(res, updatePVEServerValidation, req.body)) return;

    const server = await editPVEServer(req.user.id, req.params.serverId, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully edited" });
});

/**
 * POST /pveServer/{type}/{pveId}/{vmId}/start
 * @summary Start VM/Container
 * @description Starts a virtual machine or LXC container on a Proxmox VE server.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} type.path.required - Type of virtualization (qemu for VM, lxc for container)
 * @param {string} pveId.path.required - The unique identifier of the PVE server
 * @param {string} vmId.path.required - The VM or container ID to start
 * @return {object} 200 - VM/container successfully started
 * @return {object} 400 - Invalid type or server configuration
 * @return {object} 500 - Failed to start VM/container
 */
app.post("/:type/:pveId/:vmId/start", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);


    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await startPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get started" });
    }

    res.json({ message: "Server got successfully started" });
});

/**
 * POST /pveServer/{type}/{pveId}/{vmId}/stop
 * @summary Force Stop VM/Container
 * @description Forcefully stops a virtual machine or LXC container on a Proxmox VE server without graceful shutdown.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} type.path.required - Type of virtualization (qemu for VM, lxc for container)
 * @param {string} pveId.path.required - The unique identifier of the PVE server
 * @param {string} vmId.path.required - The VM or container ID to stop
 * @return {object} 200 - VM/container successfully stopped
 * @return {object} 400 - Invalid type or server configuration
 * @return {object} 500 - Failed to stop VM/container
 */
app.post("/:type/:pveId/:vmId/stop", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);

    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await stopPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get stopped" });
    }

    res.json({ message: "Server got successfully stopped" });
});

/**
 * POST /pveServer/{type}/{pveId}/{vmId}/shutdown
 * @summary Graceful Shutdown VM/Container
 * @description Gracefully shuts down a virtual machine or LXC container on a Proxmox VE server, allowing the OS to properly close applications.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @param {string} type.path.required - Type of virtualization (qemu for VM, lxc for container)
 * @param {string} pveId.path.required - The unique identifier of the PVE server
 * @param {string} vmId.path.required - The VM or container ID to shutdown
 * @return {object} 200 - VM/container successfully shutdown
 * @return {object} 400 - Invalid type or server configuration
 * @return {object} 500 - Failed to shutdown VM/container
 */
app.post("/:type/:pveId/:vmId/shutdown", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);

    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await shutdownPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get shutdown" });
    }

    res.json({ message: "Server got successfully shutdown" });
});

/**
 * POST /pveServer/refresh
 * @summary Refresh PVE Data
 * @description Refreshes and synchronizes data from all configured Proxmox VE servers, updating VM and container information.
 * @tags PVE Server
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - PVE data successfully refreshed
 */
app.post("/refresh", async (req, res) => {
    await updatePVEAccount(req.user.id);

    res.json({ message: "Server got successfully refreshed" });
});

module.exports = app;