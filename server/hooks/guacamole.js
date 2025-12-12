const guacamoleProxy = require("../controllers/guacamoleProxy");
const SessionManager = require("../lib/SessionManager");
const GuacdClient = require("../lib/GuacdClient");

class SharedGuacConnection {
    constructor(ws, sessionId, connection) {
        this.webSocket = ws;
        this.sessionId = sessionId;
        this.guacdClient = null;
        this.closed = false;
        const primary = connection?.clientConnection;
        this.connectionSettings = primary?.connectionSettings || { connection: { width: 1024, height: 768, dpi: 96 } };
        this.connectionType = primary?.connectionType || 'vnc';
        this.GUAC_AUDIO = primary?.GUAC_AUDIO || [];
        this.GUAC_VIDEO = primary?.GUAC_VIDEO || [];
    }

    send(message) {
        if (!this.closed && this.webSocket.readyState === this.webSocket.OPEN)
            this.webSocket.send(message, { binary: false, mask: false });
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.guacdClient?.close();
        SessionManager.removeWebSocket(this.sessionId, this.webSocket, true);
    }

    error() { this.close(); }
}

const handleSharedGuac = (ws, context) => {
    const { serverSession } = context;
    const sessionId = serverSession.sessionId;
    const connection = SessionManager.getConnection(sessionId);
    const joinConnectionId = connection?.guacdClient?.guacdConnectionId;
    if (!joinConnectionId) return ws.close(4014, "Session not connected");

    const sharedConn = new SharedGuacConnection(ws, sessionId, connection);
    sharedConn.guacdClient = new GuacdClient(sharedConn, joinConnectionId);
    
    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);

    const keepAliveInterval = setInterval(() => {
        if (sharedConn.guacdClient && sharedConn.guacdClient.state === sharedConn.guacdClient.STATE_OPEN) {
            sharedConn.guacdClient.sendOpCode(['nop']);
        }
    }, 5000);
    
    ws.on("message", (msg) => {
        if (!SessionManager.get(sessionId)?.shareWritable) return;
        const msgStr = msg.toString();
        const isInteraction = msgStr.includes('.key,') || (msgStr.match(/\.mouse,\d+\.\d+,\d+\.\d+,(\d+)\.(\d+);/)?.[2] > 0);
        if (isInteraction) SessionManager.setActiveWs(sessionId, ws);
        if (msgStr.includes('.size,') && !SessionManager.isActiveWs(sessionId, ws)) return;
        sharedConn.guacdClient.send(msg);
    });
    
    ws.on("close", () => {
        clearInterval(keepAliveInterval);
        sharedConn.close();
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleSharedGuac(ws, context);
    guacamoleProxy(ws, context.connectionConfig);
};
