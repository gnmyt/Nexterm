const wsAuth = require("../middlewares/wsAuth");
const guacamoleHook = require("../hooks/guacamole");
const { createTicket, getNodeForServer, openVNCConsole } = require("../controllers/pve");
const { getIdentityCredentials } = require("../controllers/identity");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createVNCToken, createRDPToken } = require("../utils/tokenGenerator");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, integration, identity, user, connectionReason, ipAddress, userAgent, serverSession } = context;
    if (serverSession) SessionManager.resume(serverSession.sessionId);

    try {
        let connectionConfig = null;
        const auditLogId = serverSession?.auditLogId || null;

        const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;
        const isRdpVnc = protocol === "rdp" || protocol === "vnc";
        const isPveQemu = entry.type === "pve-qemu";

        if (isRdpVnc) {
            logger.verbose(`Initiating ${protocol.toUpperCase()} connection`, {
                entryId: entry.id,
                entryName: entry.name,
                target: entry.config.ip,
                port: entry.config.port,
                identity: identity.name,
                user: user.username,
            });

            let credentials;
            if (identity.isDirect && identity.directCredentials) {
                credentials = identity.directCredentials;
            } else {
                credentials = await getIdentityCredentials(identity.id);
            }

            logger.verbose(`Creating ${protocol.toUpperCase()} token`, {
                target: entry.config.ip,
                port: entry.config.port
            });

            const displayOptions = {
                colorDepth: entry.config.colorDepth || "",
                resizeMethod: entry.config.resizeMethod || "display-update",
                keyboardLayout: entry.config.keyboardLayout || "en-us-qwerty",
                enableWallpaper: entry.config.enableWallpaper !== false,
                enableTheming: entry.config.enableTheming !== false,
                enableFontSmoothing: entry.config.enableFontSmoothing !== false,
                enableFullWindowDrag: entry.config.enableFullWindowDrag === true,
                enableDesktopComposition: entry.config.enableDesktopComposition === true,
                enableMenuAnimations: entry.config.enableMenuAnimations === true,
            };

            if (protocol === "rdp") {
                connectionConfig = createRDPToken(
                    entry.config.ip,
                    entry.config.port,
                    identity.username,
                    credentials.password,
                    displayOptions,
                );
            } else {
                connectionConfig = createVNCToken(
                    entry.config.ip,
                    entry.config.port,
                    identity.username,
                    credentials.password,
                    displayOptions,
                );
            }

            logger.system(`${protocol.toUpperCase()} connection established`, {
                protocol: protocol,
                target: entry.config.ip,
                port: entry.config.port,
                identity: identity.name,
            });
        } else if (isPveQemu) {
            const vmid = entry.config?.vmid;

            logger.verbose(`Initiating PVE QEMU connection`, {
                entryId: entry.id,
                entryName: entry.name,
                integrationId: integration.id,
                integrationName: integration.name,
                vmid: vmid,
                user: user.username,
            });

            const integrationCreds = await getIntegrationCredentials(integration.id);
            const server = { ...integration.config, ...entry.config, password: integrationCreds.password };

            logger.verbose(`Creating PVE ticket`, {
                server: server.ip,
                port: server.port,
                username: server.username,
            });

            const ticket = await createTicket(
                { ip: server.ip, port: server.port },
                server.username,
                server.password,
            );

            logger.verbose(`Getting PVE node`, { server: server.ip });

            const node = await getNodeForServer(server, ticket);

            logger.verbose(`Opening VNC console for QEMU`, { node: node, vmid: vmid });

            const vncTicket = await openVNCConsole(
                { ip: server.ip, port: server.port },
                node,
                vmid,
                ticket,
            );

            connectionConfig = createVNCToken(
                server.ip,
                vncTicket.port,
                undefined,
                vncTicket.ticket,
                {
                    colorDepth: entry.config.colorDepth || "",
                    resizeMethod: entry.config.resizeMethod || "display-update",
                },
            );

            logger.system(`PVE QEMU connection established`, {
                protocol: "pve-qemu",
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
                reason: connectionReason || "none",
            });
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
            connectionConfig.serverSession = serverSession;
        }

        await guacamoleHook(ws, { connectionConfig });
    } catch (error) {
        logger.error("Guacamole connection error", { error: error.message, stack: error.stack });
        ws.close(4005, error.message);
    }
};
