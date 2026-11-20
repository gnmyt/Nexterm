const Entry = require("../models/Entry");
const { resolveIdentity } = require("../utils/identityResolver");
const { getIdentityCredentials } = require("./identity");
const { buildSSHParams, resolveJumpHosts, resolveTrust } = require("../lib/ConnectionService");
const hostTrust = require("../utils/hostTrust");
const { validateEntryAccess } = require("./entry");
const { checkEntryAccessPolicy } = require("../utils/accessPolicy");
const Integration = require("../models/Integration");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { applyEffectiveEntryConfig } = require("../utils/folderInheritance");
const { isConnectionReasonRequired, createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES, CONNECTION_REASON_REQUIRED } = require("./audit");

const execCommand = async (accountId, entryId, identityId, command, { connectionReason = null, ipAddress = null, userAgent = null } = {}) => {
    const entry = await Entry.findByPk(entryId);
    if (!entry) {
        return { code: 404, message: "Entry not found" };
    }

    const accessResult = await validateEntryAccess(accountId, entry);
    if (!accessResult.valid) {
        return { code: 403, message: "Access denied" };
    }

    const effectiveConfig = await applyEffectiveEntryConfig(entry);

    if (entry.disabled) {
        return { code: 403, message: "Server is disabled" };
    }

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;
    const policyCheck = await checkEntryAccessPolicy(accountId, entry, integration);
    if (!policyCheck.allowed) {
        return {
            code: 403,
            message: policyCheck.reason === "engine"
                ? "Access denied: this server must be reached through a different engine"
                : "Access denied: this server IP is not allowed for your account",
        };
    }

    if (effectiveConfig.protocol !== "ssh") {
        return { code: 400, message: "Command execution is only supported for SSH entries" };
    }

    if (!connectionReason && await isConnectionReasonRequired(entry.organizationId)) {
        return CONNECTION_REASON_REQUIRED;
    }

    if (!controlPlane.hasEngine()) {
        return { code: 503, message: "No engine connected" };
    }

    const result = await resolveIdentity(entry, identityId, null, accountId);
    const identity = result?.identity !== undefined ? result.identity : result;

    if (result.accessDenied) {
        return { code: 403, message: "You don't have access to this identity" };
    }

    if (!identity || !identity.id) {
        return { code: 400, message: "No identity available for this entry" };
    }

    const credentials = await getIdentityCredentials(identity.id);
    const params = buildSSHParams(identity, credentials);
    const host = entry.config?.ip;
    const port = entry.config?.port || 22;

    if (!host) {
        return { code: 400, message: "Missing host configuration" };
    }

    await createAuditLog({
        accountId,
        organizationId: entry.organizationId,
        action: AUDIT_ACTIONS.SSH_CONNECT,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entry.id,
        details: { connectionReason },
        ipAddress,
        userAgent,
    });

    const jumpHosts = await resolveJumpHosts(entry, accountId);
    const trust = await resolveTrust(entry, hostTrust.KIND.SSH, host, port, jumpHosts);
    const execResult = await controlPlane.execCommand(host, port, { ...params, ...trust.params }, command, jumpHosts);

    if (execResult.untrustedPeer) {
        return {
            success: false, stdout: "", stderr: "", exitCode: 1,
            errorMessage: hostTrust.unattendedMessage(execResult.untrustedPeer),
            untrustedPeer: hostTrust.describePeer(execResult.untrustedPeer),
        };
    }

    return {
        success: execResult.success,
        stdout: execResult.stdout || "",
        stderr: execResult.stderr || "",
        exitCode: execResult.exitCode ?? (execResult.success ? 0 : 1),
        errorMessage: execResult.errorMessage || null,
    };
};

module.exports = { execCommand };
