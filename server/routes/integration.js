const { Router } = require("express");
const { route } = require("../utils/route");
const { acceptFingerprintValidation } = require("../validations/common");
const { getIntegration, createIntegration, deleteIntegration, editIntegration, syncIntegration, performEntryAction } = require("../controllers/integration");
const { createPVEServerValidation, updatePVEServerValidation } = require("../validations/pveServer");

const app = Router();

app.get("/:integrationId", route({
    summary: "Get integration details",
    description: "Retrieves detailed information about a specific integration configuration including connection details.",
}), async (req, res) => {
    const integration = await getIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return res.json(integration);

    res.json(integration);
});

app.put("/", route({
    summary: "Create integration",
    description: "Creates a new integration configuration for managing external systems like Proxmox VE.",
    body: createPVEServerValidation,
}), async (req, res) => {
    const integration = await createIntegration(req.user.id, req.body);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully created", id: integration.id });
});

app.delete("/:integrationId", route({
    summary: "Delete integration",
    description: "Permanently removes an integration configuration from the user's account.",
}), async (req, res) => {
    const integration = await deleteIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully deleted" });
});

app.patch("/:integrationId", route({
    summary: "Update integration",
    description: "Updates an existing integration's configuration such as connection details or authentication credentials.",
    body: updatePVEServerValidation,
}), async (req, res) => {
    const integration = await editIntegration(req.user.id, req.params.integrationId, req.body);
    if (integration?.code) return res.json(integration);

    res.json({ message: "Integration got successfully edited" });
});

app.post("/:integrationId/sync", route({
    summary: "Sync integration resources",
    description: "Synchronizes the integration with the external system, refreshing all nodes and resources.",
    body: acceptFingerprintValidation,
}), async (req, res) => {
    const result = await syncIntegration(req.user.id, req.params.integrationId, req.body.acceptFingerprint || null);
    if (result?.code) return res.json(result);

    res.json(result);
});

const handlePVEAction = async (req, res, action, actionName) => {
    const result = await performEntryAction(req.user.id, req.params.entryId, action);
    if (result?.code) return res.json(result);

    res.json({ message: `Server got successfully ${actionName}` });
};

app.post("/entry/:entryId/start", route({
    summary: "Start VM/Container by entry ID",
    description: "Starts a virtual machine or LXC container on a Proxmox VE server using the entry ID.",
}), (req, res) =>
    handlePVEAction(req, res, "start", "started")
);

app.post("/entry/:entryId/stop", route({
    summary: "Force stop VM/Container by entry ID",
    description: "Forcefully stops a virtual machine or LXC container on a Proxmox VE server without graceful shutdown.",
}), (req, res) =>
    handlePVEAction(req, res, "stop", "stopped")
);

app.post("/entry/:entryId/shutdown", route({
    summary: "Graceful shutdown VM/Container by entry ID",
    description: "Gracefully shuts down a virtual machine or LXC container on a Proxmox VE server, allowing the OS to properly close applications.",
}), (req, res) =>
    handlePVEAction(req, res, "shutdown", "shutdown")
);

module.exports = app;
