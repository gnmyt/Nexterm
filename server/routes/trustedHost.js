const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { listTrustedHosts, deleteTrustedHost } = require("../controllers/trustedHost");
const { createAuditLog, AUDIT_ACTIONS } = require("../controllers/audit");
const { peerAuditDetails } = require("../utils/hostTrust");

const app = Router();

app.get("/list", route({
    summary: "List trusted certificates",
    description: "Lists the TLS certificates and SSH host keys trusted by the user and by the organizations the user belongs to.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listTrustedHosts(req.user.id));
});

app.delete("/:id", route({
    summary: "Remove trusted certificate",
    description: "Removes a trusted certificate or host key. The next connection to that host asks again.",
}), async (req, res) => {
    const result = await deleteTrustedHost(req.user.id, req.params.id);
    if (result?.code) return res.status(result.code).json({ error: result.message });

    const { record } = result;
    await createAuditLog({
        accountId: req.user.id,
        organizationId: record.organizationId || null,
        action: AUDIT_ACTIONS.TRUST_REMOVE,
        details: peerAuditDetails(record),
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });

    res.json({ message: "Trusted certificate removed" });
});

module.exports = app;
