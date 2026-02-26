const wsAuth = require("../middlewares/wsAuth");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");
const { getIdentityCredentials } = require("../controllers/identity");
const { SessionType } = require("../lib/generated/control_plane_generated");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { buildSSHParams } = require("../lib/ConnectionService");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, identity, user } = context;
    const remoteHost = req.query.remoteHost || "127.0.0.1";
    const remotePort = Number.parseInt(req.query.remotePort, 10);

    if (!remotePort || Number.isNaN(remotePort)) {
        ws.close(4001, "Missing or invalid remotePort parameter");
        return;
    }

    const isSSH = entry.type === "ssh" || (entry.type === "server" && entry.config?.protocol === "ssh");
    if (!isSSH) {
        ws.close(4002, "Port forwarding is only supported for SSH servers");
        return;
    }

    if (!controlPlane.hasEngine()) {
        ws.close(4003, "No engine connected. Tunnels require the Nexterm Engine.");
        return;
    }

    logger.info(`Starting tunnel`, { user: user.username, server: entry.name, remoteHost, remotePort });

    const sessionId = `tunnel-${uuidv4()}`;
    let dataSocket = null;

    const cleanup = () => {
        if (dataSocket) {
            try { dataSocket.destroy(); } catch {}
            dataSocket = null;
        }
        controlPlane.closeSession(sessionId);
    };

    try {
        const credentials = identity.isDirect && identity.directCredentials
            ? identity.directCredentials : await getIdentityCredentials(identity.id);

        const host = entry.config?.ip;
        const port = entry.config?.port || 22;
        if (!host) {
            ws.close(4004, "Missing host configuration");
            return;
        }

        const params = {
            ...buildSSHParams(identity, credentials),
            remoteHost,
            remotePort: String(remotePort),
        };

        const dataSocketPromise = controlPlane.waitForDataConnection(sessionId);
        await controlPlane.openSession(sessionId, SessionType.Tunnel, host, port, params);
        dataSocket = await dataSocketPromise;

        logger.info(`Tunnel established`, { user: user.username, server: entry.name, remoteHost, remotePort });
        ws.send(JSON.stringify({ type: "ready" }));

        dataSocket.on("data", (data) => ws.readyState === ws.OPEN && ws.send(data));
        dataSocket.on("close", () => {
            logger.info(`Tunnel data connection closed`, { server: entry.name, remotePort });
            ws.close(1000, "Tunnel closed");
        });
        dataSocket.on("error", (err) => {
            logger.error(`Tunnel data socket error`, { error: err.message });
            ws.close(4005, `Stream error: ${err.message}`);
        });

        ws.on("message", (data) => {
            if (!dataSocket?.writable) return;
            const str = data.toString();
            if (str.startsWith("{")) {
                try {
                    if (JSON.parse(str).type === "ping") {
                        ws.send(JSON.stringify({ type: "pong" }));
                        return;
                    }
                } catch {}
            }
            dataSocket.write(data);
        });

        ws.on("close", () => {
            logger.info(`Tunnel WebSocket closed`, { server: entry.name, remotePort });
            cleanup();
        });
        ws.on("error", (err) => {
            logger.error(`Tunnel WebSocket error`, { error: err.message });
            cleanup();
        });

    } catch (error) {
        logger.error(`Tunnel setup failed`, { error: error.message, stack: error.stack });
        ws.close(4004, `Tunnel setup failed: ${error.message}`);
        cleanup();
    }
};
