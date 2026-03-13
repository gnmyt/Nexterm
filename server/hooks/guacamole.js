const SessionManager = require("../lib/SessionManager");
const GuacdClient = require("../lib/GuacdClient");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const logger = require("../utils/logger");

const handleGuacJoin = async (ws, sessionId, isShared, shareWritable) => {
    const conn = SessionManager.getConnection(sessionId);
    if (!conn?.guacdClient) {
        logger.debug("handleGuacJoin: no master connection", { sessionId });
        ws.close(4014, "Master connection not found");
        return;
    }

    const masterClient = conn.guacdClient;
    if (masterClient.state === "closed") {
        logger.debug("handleGuacJoin: master is closed", { sessionId });
        ws.close(4014, "Master connection closed");
        return;
    }

    const guacConnectionId = masterClient.connectionId;
    if (!guacConnectionId) {
        logger.debug("handleGuacJoin: no connection id yet", { sessionId });
        ws.close(4014, "Connection not ready");
        return;
    }

    if (!controlPlane.hasEngine()) {
        ws.close(4014, "No engine connected");
        return;
    }

    let joinSocket;
    try {
        joinSocket = await controlPlane.joinSession(sessionId);
    } catch (err) {
        logger.error("Failed to get join data socket", { sessionId, error: err.message });
        ws.close(4014, "Failed to join session");
        return;
    }

    if (ws.readyState !== ws.OPEN) {
        joinSocket.destroy();
        return;
    }

    const joinClient = new GuacdClient({
        sessionId,
        joinConnectionId: guacConnectionId,
        connectionSettings: masterClient.connectionSettings,
        existingSocket: joinSocket,
        onData: (data) => {
            try {
                if (ws.readyState === ws.OPEN) ws.send(data, { binary: false, mask: false });
            } catch {
            }
        },
        onClose: (reason) => {
            try {
                if (ws.readyState <= 1) ws.close(4014, reason);
            } catch {
            }
        },
    });
    joinClient.connect();

    SessionManager.addWebSocket(sessionId, ws, isShared);
    if (!isShared || shareWritable) {
        SessionManager.setActiveWs(sessionId, ws);
    }

    const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.ping();
    }, 15000);

    ws.on("message", (msg) => {
        const msgStr = msg.toString();

        if (isShared && !SessionManager.get(sessionId)?.shareWritable) return;

        const isInteraction = msgStr.includes(".key,") ||
            (msgStr.match(/\.mouse,\d+\.\d+,\d+\.\d+,(\d+)\.(\d+);/)?.[2] > 0);
        if (isInteraction) SessionManager.setActiveWs(sessionId, ws);

        if (msgStr.includes(".size,") && !SessionManager.isActiveWs(sessionId, ws)) {
            return;
        }

        SessionManager.updateActivity(sessionId);
        joinClient.send(msgStr);
    });

    ws.on("close", () => {
        clearInterval(pingInterval);
        joinClient.close();
        SessionManager.removeWebSocket(sessionId, ws, isShared);
    });

    ws.on("error", () => {
        clearInterval(pingInterval);
        joinClient.close();
        SessionManager.removeWebSocket(sessionId, ws, isShared);
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) {
        const { serverSession } = context;
        const sessionId = serverSession.sessionId;
        const session = SessionManager.get(sessionId);
        if (!session) return ws.close(4014, "Session not found");

        return handleGuacJoin(ws, sessionId, true, serverSession.shareWritable);
    }

    const sessionId = context.connectionConfig?.serverSession?.sessionId;
    if (!sessionId) return ws.close(4014, "Session not found");

    return handleGuacJoin(ws, sessionId, false, false);
};
