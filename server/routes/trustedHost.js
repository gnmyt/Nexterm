const { Router } = require("express");
const { listTrustedHosts, deleteTrustedHost } = require("../controllers/trustedHost");
const { createAuditLog, AUDIT_ACTIONS } = require("../controllers/audit");
const { peerAuditDetails } = require("../utils/hostTrust");

const app = Router();

/**
 * GET /trusted-hosts/list
 * @summary List Trusted Certificates
 * @description Lists the TLS certificates and SSH host keys trusted by the user and by the organizations the user belongs to.
 * @tags Trusted Certificates
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - Trusted certificates
 */
app.get("/list", async (req, res) => {
    res.json(await listTrustedHosts(req.user.id));
});

/**
 * DELETE /trusted-hosts/{id}
 * @summary Remove Trusted Certificate
 * @description Removes a trusted certificate or host key. The next connection to that host asks again.
 * @tags Trusted Certificates
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the trusted certificate
 * @return {object} 200 - Trusted certificate removed
 * @return {object} 403 - Missing permission
 * @return {object} 404 - Trusted certificate not found
 */
app.delete("/:id", async (req, res) => {
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
