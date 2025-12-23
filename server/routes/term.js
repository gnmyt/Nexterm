const wsAuth = require("../middlewares/wsAuth");
const sshHook = require("../hooks/ssh");
const scriptHook = require("../hooks/script");
const pveLxcHook = require("../hooks/pve-lxc");
const telnetHook = require("../hooks/telnet");
const { createTicket, getNodeForServer, openLXCConsole } = require("../controllers/pve");
const { getIntegrationCredentials } = require("../controllers/integration");
const { getScript } = require("../controllers/script");
const { createSSHConnection } = require("../utils/sshConnection");
const logger = require("../utils/logger");
const OrganizationMember = require("../models/OrganizationMember");
const SessionManager = require("../lib/SessionManager");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    if (context.isShared) {
        const isSSH = context.entry.type === "ssh" || (context.entry.type === "server" && context.entry.config?.protocol === "ssh");
        const isPveLxc = context.entry.type === "pve-lxc" || context.entry.type === "pve-shell";
        if (isSSH) return sshHook(ws, context);
        if (isPveLxc) return pveLxcHook(ws, context);
        ws.close(4015, "Sharing not supported for this session type");
        return;
    }

    const { entry, integration, identity, user, containerId, connectionReason, ipAddress, userAgent, serverSession } = context;

    if (serverSession) {
        SessionManager.resume(serverSession.sessionId);
    }

    try {
        let auditLogId = serverSession?.auditLogId || null;
        let hookContext = null;

        const isSSH = entry.type === "ssh" || (entry.type === "server" && entry.config?.protocol === "ssh");
        const isTelnet = entry.type === "telnet" || (entry.type === "server" && entry.config?.protocol === "telnet");
        const isPveLxc = entry.type === "pve-lxc" || entry.type === "pve-shell";

        if (isSSH) {
            const scriptId = req.query.scriptId || (serverSession?.configuration?.scriptId);
            let script = null;
            
            if (scriptId) {
                const memberships = await OrganizationMember.findAll({ where: { accountId: user.id } });
                const organizationIds = memberships.map(m => m.organizationId);
                
                script = await getScript(user.id, scriptId, null, organizationIds);
                if (!script || script.code) {
                    ws.close(4010, script?.message || "Script not found");
                    return;
                }
            }

            logger.verbose(`Initiating SSH connection`, {
                entryId: entry.id,
                entryName: entry.name,
                target: entry.config.ip,
                port: entry.config.port || 22,
                identity: identity.name,
                user: user.username,
                scriptMode: !!scriptId
            });

            if (!auditLogId) {
                auditLogId = await createAuditLog({
                    accountId: user.id,
                    organizationId: entry.organizationId,
                    action: scriptId ? AUDIT_ACTIONS.SCRIPT_EXECUTE : AUDIT_ACTIONS.SSH_CONNECT,
                    resource: scriptId ? RESOURCE_TYPES.SCRIPT : RESOURCE_TYPES.ENTRY,
                    resourceId: scriptId || entry.id,
                    details: { 
                        connectionReason,
                        ...(scriptId && { scriptName: script?.name, serverId: entry.id })
                    },
                    ipAddress,
                    userAgent,
                });
            }

            logger.verbose(`Creating SSH connection`, {
                entryId: entry.id,
                auditLogId: auditLogId
            });

            if (serverSession) {
                const pending = SessionManager.getConnectingPromise(serverSession.sessionId);
                if (pending) {
                    await pending.catch(() => {});
                    const existing = SessionManager.getConnection(serverSession.sessionId);
                    if (existing) {
                        hookContext = { ssh: existing.ssh, auditLogId, serverSession, script, user, reuseConnection: true, entry };
                        await (script ? scriptHook(ws, hookContext) : sshHook(ws, hookContext));
                        return;
                    }
                }
            }

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
                reason: connectionReason || 'none',
                scriptMode: !!scriptId
            });

            hookContext = { ssh, auditLogId, serverSession, script, user, entry };
            
            if (script) {
                await scriptHook(ws, hookContext);
            } else {
                await sshHook(ws, hookContext);
            }
        } else if (isTelnet) {
            logger.verbose(`Initiating Telnet connection`, {
                entryId: entry.id,
                entryName: entry.name,
                target: entry.config.ip,
                port: entry.config.port || 23,
                user: user.username
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

            hookContext = { entry, auditLogId, serverSession };
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

            hookContext = { integration, entry, containerId: vmid, ticket, node, vncTicket, auditLogId, serverSession };
            await pveLxcHook(ws, hookContext);
        } else {
            ws.close(4009, `Unsupported entry type for terminal: ${entry.type}`);
        }
    } catch (error) {
        logger.error("Terminal connection error", { error: error.message, stack: error.stack });
        if (serverSession) {
            SessionManager.remove(serverSession.sessionId);
        }
        ws.close(4005, error.message);
    }
};
