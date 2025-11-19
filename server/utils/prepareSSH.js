const sshd = require("ssh2");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES, updateAuditLogWithSessionDuration } = require("../controllers/audit");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");
const { getIdentityCredentials } = require("../controllers/identity");

module.exports = async (entry, identity, ws, res, userInfo = {}) => {
    if (ws && entry.organizationId && userInfo.accountId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !userInfo.connectionReason) {
            if (ws) {
                ws.close(4008, "Connection reason required");
            } else if (res) {
                res.status(400).json({ error: "Connection reason required", requireConnectionReason: true });
            }
            return;
        }
    }

    const credentials = await getIdentityCredentials( identity.id);

    const options = {
        host: entry.config.ip,
        port: entry.config.port,
        username: identity.username,
        tryKeyboard: true,
        ...(identity.type === "password" ? { password: credentials.password } : { privateKey: credentials["ssh-key"], passphrase: credentials.passphrase })
    };

    let ssh = new sshd.Client();
    if (ws) {
        ssh.connectionStartTime = Date.now();

        ssh.on("error", (error) => {
            if(error.level === "client-timeout") {
                ws.close(4007, "Client Timeout reached");
            } else {
                ws.close(4005, error.message);
            }
        });

        ssh.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
            ws.send(`\x02${prompts[0].prompt}`);

            ws.on("message", (data) => {
                if (data.toString().startsWith("\x03")) {
                    const totpCode = data.substring(1);
                    finish([totpCode]);
                }
            });
        });
    }

    try {
        ssh.connect(options);
    } catch (err) {
        if (ws) ws.close(4004, err.message);
        if (res) res.status(500).send(err.message);
    }

    if (ws) {
        ssh.on("end", () => {
            updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
            ws.close(4006, "Connection closed");
        });

        ssh.on("exit", () => {
            updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
            ws.close(4006, "Connection exited");
        });

        ssh.on("close", () => {
            updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
            ws.close(4007, "Connection closed");
        });
    }

    if (ws) {
        console.log("Authorized connection to entry " + entry.config.ip + " with identity " + identity.name);

        let auditLogId = null;
        if (userInfo.accountId) {
            auditLogId = await createAuditLog({
                accountId: userInfo.accountId,
                organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.SSH_CONNECT,
                resource: RESOURCE_TYPES.ENTRY,
                resourceId: entry.id,
                details: {
                    connectionReason: userInfo.connectionReason,
                },
                ipAddress: userInfo.ip,
                userAgent: userInfo.userAgent
            });
        }

        ssh.auditLogId = auditLogId;
        ssh.organizationId = entry.organizationId;
    } else {
        console.log("Authorized file download from entry " + entry.config.ip + " with identity " + identity.name);
    }

    return ssh;
}