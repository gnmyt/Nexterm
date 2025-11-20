const wsAuth = require("../middlewares/wsAuth");
const guacamoleHook = require("../hooks/guacamole");
const { createTicket, getNodeForServer, openVNCConsole } = require("../controllers/pve");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { getIdentityCredentials } = require("../controllers/identity");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createVNCToken, createRDPToken } = require("../utils/tokenGenerator");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, integration, identity, user, connectionReason, ipAddress, userAgent } = context;

    try {
        let connectionConfig = null;
        let auditLogId = null;

        const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;
        const isRdpVnc = protocol === "rdp" || protocol === "vnc";
        const isPveQemu = entry.type === "pve-qemu";

        if (isRdpVnc) {
            const credentials = await getIdentityCredentials(identity.id);

            const actionType = protocol === "rdp" 
                ? AUDIT_ACTIONS.RDP_CONNECT 
                : AUDIT_ACTIONS.VNC_CONNECT;

            auditLogId = await createAuditLog({
                accountId: user.id,
                organizationId: entry.organizationId,
                action: actionType,
                resource: RESOURCE_TYPES.SERVER,
                resourceId: entry.id,
                details: { connectionReason },
                ipAddress,
                userAgent,
            });

            if (protocol === "rdp") {
                connectionConfig = createRDPToken(
                    entry.config.ip, 
                    entry.config.port, 
                    identity.username, 
                    credentials.password,
                    entry.config.keyboardLayout || "en-us-qwerty"
                );
            } else {
                connectionConfig = createVNCToken(
                    entry.config.ip, 
                    entry.config.port, 
                    identity.username, 
                    credentials.password,
                    entry.config.keyboardLayout || "en-us-qwerty"
                );
            }

            console.log(`Authorized ${protocol.toUpperCase()} connection to ${entry.config.ip} with identity ${identity.name}`);
        } else if (isPveQemu) {
            const vmid = entry.config?.vmid;

            auditLogId = await createAuditLog({
                accountId: user.id,
                organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.PVE_CONNECT,
                resource: RESOURCE_TYPES.SERVER,
                resourceId: entry.id,
                details: {
                    containerId: vmid,
                    containerType: 'qemu',
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
            const vncTicket = await openVNCConsole(
                { ip: server.ip, port: server.port }, 
                node, 
                vmid, 
                ticket
            );

            connectionConfig = createVNCToken(
                server.ip, 
                vncTicket.port, 
                undefined, 
                vncTicket.ticket
            );

            console.log(`Authorized PVE QEMU connection to ${server.ip} VM ${vmid}`);
        } else {
            ws.close(4009, `Unsupported entry type for guacamole: ${entry.type}`);
            return;
        }

        if (connectionConfig && auditLogId) {
            connectionConfig.user = user;
            connectionConfig.server = entry;
            connectionConfig.auditLogId = auditLogId;
            connectionConfig.ipAddress = ipAddress;
            connectionConfig.userAgent = userAgent;
            connectionConfig.connectionReason = connectionReason;
        }

        await guacamoleHook(ws, { connectionConfig });
    } catch (error) {
        console.error("Guacamole connection error:", error.message);
        ws.close(4005, error.message);
    }
};
