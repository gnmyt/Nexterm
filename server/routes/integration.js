const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { getIntegration, createIntegration, deleteIntegration, editIntegration, getIntegrationUnsafe } = require("../controllers/integration");
const { createPVEServerValidation, updatePVEServerValidation } = require("../validations/pveServer");
const { startPVEServer, shutdownPVEServer, stopPVEServer } = require("../controllers/pve");
const Entry = require("../models/Entry");

const app = Router();

/**
 * GET /integration/{integrationId}
 * @summary Get Integration Details
 * @description Retrieves detailed information about a specific integration configuration including connection details.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @return {object} 200 - Integration details
 * @return {object} 404 - Integration not found
 */
app.get("/:integrationId", async (req, res) => {
    const integration = await getIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return res.json(integration);

    res.json(integration);
});

/**
 * PUT /integration
 * @summary Create Integration
 * @description Creates a new integration configuration for managing external systems like Proxmox VE.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @requestBody {object} - Integration configuration including connection details and authentication
 * @return {object} 200 - Integration successfully created with new integration ID
 * @return {object} 400 - Invalid integration configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createPVEServerValidation, req.body)) return;

    const integration = await createIntegration(req.user.id, req.body);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully created", id: integration.id });
});

/**
 * DELETE /integration/{integrationId}
 * @summary Delete Integration
 * @description Permanently removes an integration configuration from the user's account.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration to delete
 * @return {object} 200 - Integration successfully deleted
 * @return {object} 404 - Integration not found
 */
app.delete("/:integrationId", async (req, res) => {
    const integration = await deleteIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully deleted" });
});

/**
 * PATCH /integration/{integrationId}
 * @summary Update Integration
 * @description Updates an existing integration's configuration such as connection details or authentication credentials.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration to update
 * @requestBody {object} - Updated integration configuration fields
 * @return {object} 200 - Integration successfully updated
 * @return {object} 404 - Integration not found
 */
app.patch("/:integrationId", async (req, res) => {
    if (validateSchema(res, updatePVEServerValidation, req.body)) return;

    const integration = await editIntegration(req.user.id, req.params.integrationId, req.body);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully edited" });
});

const handlePVEAction = async (req, res, action, actionName) => {
    const entry = await Entry.findByPk(req.params.entryId);
    if (!entry) return res.json({ code: 404, message: "Entry not found" });

    if (!entry.type.startsWith("pve-")) return res.json({ code: 400, message: "Invalid entry type" });

    const integration = await getIntegrationUnsafe(req.user.id, entry.integrationId);
    if (integration?.code) return res.json(integration);

    const vmId = entry.config?.vmid;
    if (!vmId) return res.json({ code: 400, message: "Entry missing vmid" });

    const type = entry.type === "pve-qemu" ? "qemu" : "lxc";

    try {
        const status = await action(integration, vmId, type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: `Server could not get ${actionName}` });
    }

    res.json({ message: `Server got successfully ${actionName}` });
};

/**
 * POST /integration/entry/{entryId}/start
 * @summary Start VM/Container by Entry ID
 * @description Starts a virtual machine or LXC container on a Proxmox VE server using the entry ID.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container successfully started
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 * @return {object} 500 - Failed to start VM/container
 */
app.post("/entry/:entryId/start", (req, res) => 
    handlePVEAction(req, res, startPVEServer, "started")
);

/**
 * POST /integration/entry/{entryId}/stop
 * @summary Force Stop VM/Container by Entry ID
 * @description Forcefully stops a virtual machine or LXC container on a Proxmox VE server without graceful shutdown.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container successfully stopped
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 * @return {object} 500 - Failed to stop VM/container
 */
app.post("/entry/:entryId/stop", (req, res) => 
    handlePVEAction(req, res, stopPVEServer, "stopped")
);

/**
 * POST /integration/entry/{entryId}/shutdown
 * @summary Graceful Shutdown VM/Container by Entry ID
 * @description Gracefully shuts down a virtual machine or LXC container on a Proxmox VE server, allowing the OS to properly close applications.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container successfully shutdown
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 * @return {object} 500 - Failed to shutdown VM/container
 */
app.post("/entry/:entryId/shutdown", (req, res) => 
    handlePVEAction(req, res, shutdownPVEServer, "shutdown")
);

module.exports = app;
