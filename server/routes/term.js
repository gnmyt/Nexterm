const wsAuth = require("../middlewares/wsAuth");
const sshHook = require("../hooks/ssh");
const pveLxcHook = require("../hooks/pve-lxc");
const telnetHook = require("../hooks/telnet");
const { createTicket, getNodeForServer, openLXCConsole } = require("../controllers/pve");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createSSHConnection } = require("../utils/sshConnection");
const logger = require("../utils/logger");

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
            logger.verbose(`Initiating SSH connection`, {
                entryId: entry.id,
                entryName: entry.name,
                target: entry.config.ip,
                port: entry.config.port || 22,
                identity: identity.name,
                user: user.username
            });

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

            logger.verbose(`Creating SSH connection`, {
                entryId: entry.id,
                auditLogId: auditLogId
            });

            const ssh = await createSSHConnection(entry, identity, ws);

            logger.system(`SSH connection established`, {
                protocol: 'ssh',
                target: entry.config.ip,
                port: entry.config.port || 22,
                identity: identity.name,
                identityType: identity.type,
                entryId: entry.id,
                entryName: entry.name,
                user: user.username,
                userId: user.id,
                sourceIp: ipAddress,
                jumpHosts: entry.config?.jumpHosts?.length || 0,
                reason: connectionReason || 'none'
            });

            hookContext = { ssh, auditLogId };
            await sshHook(ws, hookContext);
        } else if (isTelnet) {
            logger.verbose(`Initiating Telnet connection`, {
                entryId: entry.id,
                entryName: entry.name,
                target: entry.config.ip,
                port: entry.config.port || 23,
                user: user.username
            });

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

            logger.verbose(`Telnet audit log created`, {
                entryId: entry.id,
                auditLogId: auditLogId
            });

            logger.system(`Telnet connection established`, {
                protocol: 'telnet',
                target: entry.config.ip,
                port: entry.config.port || 23,
                entryId: entry.id,
                entryName: entry.name,
                user: user.username,
                userId: user.id,
                sourceIp: ipAddress,
                reason: connectionReason || 'none'
            });

            hookContext = { entry, auditLogId };
            await telnetHook(ws, hookContext);
        } else if (isPveLxc) {
            const vmid = entry.config?.vmid ?? containerId;

            logger.verbose(`Initiating PVE LXC connection`, {
                entryId: entry.id,
                entryName: entry.name,
                integrationId: integration.id,
                integrationName: integration.name,
                vmid: vmid,
                user: user.username
            });

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

            logger.verbose(`Retrieving PVE credentials`, {
                integrationId: integration.id
            });

            const integrationCreds = await getIntegrationCredentials(integration.id);
            const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
            
            logger.verbose(`Creating PVE ticket`, {
                server: server.ip,
                port: server.port,
                username: server.username
            });

            const ticket = await createTicket(
                { ip: server.ip, port: server.port }, 
                server.username, 
                server.password
            );
            
            logger.verbose(`Getting PVE node`, {
                server: server.ip
            });

            const node = await getNodeForServer(server, ticket);
            
            logger.verbose(`Opening LXC console`, {
                node: node,
                vmid: vmid
            });

            const vncTicket = await openLXCConsole(
                { ip: server.ip, port: server.port }, 
                node, 
                vmid, 
                ticket
            );

            logger.system(`PVE LXC connection established`, {
                protocol: 'pve-lxc',
                target: server.ip,
                port: server.port,
                node: node,
                vmid: vmid,
                vncPort: vncTicket.port,
                pveUsername: server.username,
                entryId: entry.id,
                entryName: entry.name,
                integrationId: integration.id,
                integrationName: integration.name,
                user: user.username,
                userId: user.id,
                sourceIp: ipAddress,
                reason: connectionReason || 'none'
            });

            hookContext = { integration, entry, containerId: vmid, ticket, node, vncTicket, auditLogId };
            await pveLxcHook(ws, hookContext);
        } else {
            ws.close(4009, `Unsupported entry type for terminal: ${entry.type}`);
        }
    } catch (error) {
        logger.error("Terminal connection error", { error: error.message, stack: error.stack });
        ws.close(4005, error.message);
    }
};
