const wsAuth = require("../middlewares/wsAuth");
const guacamoleHook = require("../hooks/guacamole");
const { createVNCToken, createRDPToken } = require("../utils/tokenGenerator");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;
    if (context.isShared) return guacamoleHook(ws, context);

    const { entry, user, connectionReason, ipAddress, userAgent, serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    SessionManager.resume(serverSession.sessionId);
    const session = SessionManager.get(serverSession.sessionId);
    if (!session) return ws.close(4007, "Session not found");
    if (!session.guacReady || !session.guacConfig) return ws.close(4014, "Guacamole not prepared");

    try {
        const { guacConfig } = session;
        const { protocol, pveConfig, identity, credentials } = guacConfig;
        const cfg = entry.config || {};

        const displayOpts = {
            colorDepth: cfg.colorDepth || "", resizeMethod: cfg.resizeMethod || "display-update",
            keyboardLayout: cfg.keyboardLayout || "en-us-qwerty", enableWallpaper: cfg.enableWallpaper !== false,
            enableTheming: cfg.enableTheming !== false, enableFontSmoothing: cfg.enableFontSmoothing !== false,
            enableFullWindowDrag: cfg.enableFullWindowDrag === true, enableDesktopComposition: cfg.enableDesktopComposition === true,
            enableMenuAnimations: cfg.enableMenuAnimations === true, enableAudio: cfg.enableAudio !== false,
        };

        let connConfig = null;
        if (pveConfig) {
            connConfig = createVNCToken(pveConfig.server.ip, pveConfig.vncTicket.port, undefined, pveConfig.vncTicket.ticket, {
                colorDepth: cfg.colorDepth || "", resizeMethod: cfg.resizeMethod || "display-update", enableAudio: cfg.enableAudio !== false
            });
            logger.system("PVE QEMU connection", { protocol: "pve-qemu", target: pveConfig.server.ip, vmid: pveConfig.vmid, user: user.username });
        } else if (protocol === "rdp") {
            connConfig = createRDPToken(cfg.ip, cfg.port, identity?.username, credentials?.password, displayOpts);
            logger.system("RDP connection", { protocol, target: cfg.ip, port: cfg.port, identity: identity?.name });
        } else if (protocol === "vnc") {
            connConfig = createVNCToken(cfg.ip, cfg.port, identity?.username, credentials?.password, displayOpts);
            logger.system("VNC connection", { protocol, target: cfg.ip, port: cfg.port, identity: identity?.name });
        } else {
            return ws.close(4009, `Unsupported: ${protocol}`);
        }

        if (connConfig) {
            Object.assign(connConfig, { user, server: entry, auditLogId: serverSession.auditLogId || null,
                ipAddress, userAgent, connectionReason, serverSession, organizationId: entry.organizationId });
        }

        await guacamoleHook(ws, { connectionConfig: connConfig });
    } catch (err) {
        logger.error("Guacamole error", { error: err.message, stack: err.stack });
        ws.close(4005, err.message);
    }
};
