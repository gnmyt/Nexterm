const wsAuth = require("../middlewares/wsAuth");
const logger = require("../utils/logger");
const { createSSHConnection } = require("../utils/sshConnection");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, identity, user } = context;
    const remoteHost = req.query.remoteHost || "127.0.0.1";
    const remotePort = parseInt(req.query.remotePort, 10);

    if (!remotePort || isNaN(remotePort)) {
        ws.close(4001, "Missing or invalid remotePort parameter");
        return;
    }

    const isSSH = entry.type === "ssh" || (entry.type === "server" && entry.config?.protocol === "ssh");
    if (!isSSH) {
        ws.close(4002, "Port forwarding is only supported for SSH servers");
        return;
    }

    logger.info(`Starting tunnel`, { user: user.username, server: entry.name, remoteHost, remotePort });

    let ssh = null;
    let forwardStream = null;

    const cleanup = () => {
        if (forwardStream) {
            try {
                forwardStream.destroy();
            } catch (e) {
            }
            forwardStream = null;
        }
        if (ssh) {
            try {
                if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
                ssh.end();
            } catch (e) {
            }
            ssh = null;
        }
    };

    try {
        ssh = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("SSH connection timeout")), 30000);
            createSSHConnection(entry, identity).then(conn => {
                conn.on("ready", () => {
                    clearTimeout(timeout);
                    resolve(conn);
                });
                conn.on("error", (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            }).catch(err => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        forwardStream = await new Promise((resolve, reject) => {
            ssh.forwardOut("127.0.0.1", 0, remoteHost, remotePort, (err, stream) => {
                err ? reject(new Error(`Port forward failed: ${err.message}`)) : resolve(stream);
            });
        });

        logger.info(`Tunnel established`, { user: user.username, server: entry.name, remoteHost, remotePort });
        ws.send(JSON.stringify({ type: "ready" }));

        forwardStream.on("data", (data) => ws.readyState === ws.OPEN && ws.send(data));
        forwardStream.on("close", () => {
            logger.info(`Tunnel stream closed`, { server: entry.name, remotePort });
            ws.close(1000, "Tunnel closed");
        });
        forwardStream.on("error", (err) => {
            logger.error(`Tunnel stream error`, { error: err.message });
            ws.close(4003, `Stream error: ${err.message}`);
        });

        ws.on("message", (data) => {
            if (!forwardStream?.writable) return;
            const str = data.toString();
            if (str.startsWith("{")) {
                try {
                    if (JSON.parse(str).type === "ping") {
                        ws.send(JSON.stringify({ type: "pong" }));
                        return;
                    }
                } catch (e) {
                }
            }
            forwardStream.write(data);
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
