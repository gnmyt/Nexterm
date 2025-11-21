const wsAuth = require("../middlewares/wsAuth");
const sshHook = require("../hooks/ssh");
const pveLxcHook = require("../hooks/pve-lxc");
const telnetHook = require("../hooks/telnet");
const { createTicket, getNodeForServer, openLXCConsole } = require("../controllers/pve");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createSSHConnection } = require("../utils/sshConnection");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, integration, identity, user, containerId, connectionReason, ipAddress, userAgent } = context;

    try {
        let auditLogId = null;
        let hookContext = null;

        const isSSH = entry.type === "ssh" || (entry.type === "server" && entry.config?.protocol === "ssh");
        const isTelnet = entry.type === "telnet" || (entry.type === "server" && entry.config?.protocol === "telnet");
        const isPveLxc = entry.type === "pve-lxc" || entry.type === "pve-shell";

        if (isSSH) {
            auditLogId = await createAuditLog({
                    accountId: user.id,
                    organizationId: entry.organizationId,
                    action: AUDIT_ACTIONS.SSH_CONNECT,
                    resource: RESOURCE_TYPES.ENTRY,
                    resourceId: entry.id,
                    details: { connectionReason },
                    ipAddress,
                    userAgent,
            });

            const ssh = await createSSHConnection(entry, identity, ws);

            console.log(`Authorized SSH connection to ${entry.config.ip} with identity ${identity.name}`);

            hookContext = { ssh, auditLogId };
            await sshHook(ws, hookContext);
        } else if (isTelnet) {
            auditLogId = await createAuditLog({
                accountId: user.id,
                organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.SSH_CONNECT,
                resource: RESOURCE_TYPES.ENTRY,
                resourceId: entry.id,
                details: { connectionReason, protocol: 'telnet' },
                ipAddress,
                userAgent,
            });

            console.log(`Authorized Telnet connection to ${entry.config.ip}`);

            hookContext = { entry, auditLogId };
            await telnetHook(ws, hookContext);
        } else if (isPveLxc) {
            const vmid = entry.config?.vmid ?? containerId;

            auditLogId = await createAuditLog({
                accountId: user.id,
                organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.PVE_CONNECT,
                resource: RESOURCE_TYPES.SERVER,
                resourceId: entry.id,
                details: {
                    containerId: vmid,
                    containerType: 'lxc',
                    connectionReason,
                },
                ipAddress,
                userAgent,
            });

            const integrationCreds = await getIntegrationCredentials(integration.id);
            const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
            const ticket = await createTicket(
                { ip: server.ip, port: server.port }, 
                server.username, 
                server.password
            );
            const node = await getNodeForServer(server, ticket);
            const vncTicket = await openLXCConsole(
                { ip: server.ip, port: server.port }, 
                node, 
                vmid, 
                ticket
            );

            console.log(`Authorized PVE LXC connection to ${server.ip} container ${vmid}`);

            hookContext = { integration, entry, containerId: vmid, ticket, node, vncTicket, auditLogId };
            await pveLxcHook(ws, hookContext);
        } else {
            ws.close(4009, `Unsupported entry type for terminal: ${entry.type}`);
        }
    } catch (error) {
        console.error("Terminal connection error:", error.message);
        ws.close(4005, error.message);
    }
};
