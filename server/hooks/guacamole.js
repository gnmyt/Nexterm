const SessionManager = require("../lib/SessionManager");
const GuacdClient = require("../lib/GuacdClient");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const logger = require("../utils/logger");
const { buildParticipant, createWriteGuard } = require("../utils/sessionParticipant");
const { safeCloseWs } = require("../utils/wsClose");

const SIZED_MONITOR = /\.size,\d+\.-?\d+,\d+\.-?\d+,\d+\.(-?\d+)/;
const MOUSE_BUTTONS = /\.mouse,\d+\.\d+,\d+\.\d+,(\d+)\.(\d+);/;

const sizedMonitorOf = (msgStr) => {
    if (!msgStr.includes(".size,")) return null;
    const match = msgStr.match(SIZED_MONITOR);
    return match ? Number.parseInt(match[1], 10) : 0;
};

const DISPLAY_SIZE = /\.size,\d+\.(\d+),\d+\.(\d+)/;

const rememberDisplaySize = (sessionId, msgStr) => {
    const match = msgStr.match(DISPLAY_SIZE);
    if (!match) return;
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    const session = SessionManager.get(sessionId);
    if (session && width > 0 && height > 0) session.displaySize = { width, height };
};

const handleGuacJoin = async (ws, sessionId, ctx, pinnedMonitor = null) => {
    const isShared = !!ctx.isShared;
    const canWrite = createWriteGuard(ctx, sessionId);
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
        serveFiles: !isShared && ctx.user?.id != null
            && SessionManager.get(sessionId)?.accountId === ctx.user.id,
        connectionSettings: masterClient.connectionSettings,
        existingSocket: joinSocket,
        onData: (data) => {
            SessionManager.updateActivity(sessionId, { touchLoginSession: !isShared });
            try {
                if (ws.readyState === ws.OPEN) ws.send(data, { binary: false, mask: false });
            } catch {
            }
        },
        onClose: (reason) => {
            safeCloseWs(ws, 4014, reason);
        },
    });
    joinClient.connect();

    SessionManager.addWebSocket(sessionId, ws, isShared, buildParticipant(ctx));

    if (pinnedMonitor !== null) SessionManager.pinMonitor(sessionId, ws, pinnedMonitor);
    else if (canWrite()) SessionManager.claimActiveWs(sessionId, ws);

    const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.ping();
    }, 15000);

    ws.on("message", (msg) => {
        const msgStr = msg.toString();

        if (!canWrite()) return;

        const sizedMonitor = sizedMonitorOf(msgStr);
        if (msgStr.includes(".key,")) SessionManager.markTyping(sessionId, ws);

        if (pinnedMonitor !== null) {
            if (sizedMonitor !== null && sizedMonitor !== pinnedMonitor) return;
        } else {
            const isInteraction = msgStr.includes(".key,")
                || msgStr.match(MOUSE_BUTTONS)?.[2] > 0
                || sizedMonitor > 0;
            if (isInteraction) SessionManager.setActiveWs(sessionId, ws);
            else if (sizedMonitor !== null) SessionManager.claimActiveWs(sessionId, ws);

            if (sizedMonitor !== null && (!SessionManager.isActiveWs(sessionId, ws)
                || SessionManager.isMonitorPinnedByOther(sessionId, ws, sizedMonitor))) return;
        }

        if (sizedMonitor === 0) rememberDisplaySize(sessionId, msgStr);
        SessionManager.updateActivity(sessionId, { touchLoginSession: !isShared });
        joinClient.send(msgStr);
    });

    ws.on("close", () => {
        clearInterval(pingInterval);
        joinClient.close();
        SessionManager.unpinMonitor(sessionId, ws);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
    });

    ws.on("error", () => {
        clearInterval(pingInterval);
        joinClient.close();
        SessionManager.unpinMonitor(sessionId, ws);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
    });
};

module.exports = async (ws, context) => {
    const sessionId = context.serverSession?.sessionId;
    if (!sessionId || !SessionManager.get(sessionId)) return ws.close(4014, "Session not found");

    return handleGuacJoin(ws, sessionId, context, context.pinnedMonitor ?? null);
};
