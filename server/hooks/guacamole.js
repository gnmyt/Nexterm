const guacamoleProxy = require("../controllers/guacamoleProxy");
const SessionManager = require("../lib/SessionManager");
const GuacdClient = require("../lib/GuacdClient");
const logger = require("../utils/logger");

const handleSharedGuac = (ws, context) => {
    const { serverSession } = context;
    const sessionId = serverSession.sessionId;
    const session = SessionManager.get(sessionId);
    
    if (!session) {
        ws.close(4014, "Session not found");
        return;
    }
    
    const masterConnection = session.masterConnection;
    const joinConnectionId = masterConnection?.guacdConnectionId;
    
    if (!joinConnectionId) {
        ws.close(4014, "Session not connected");
        return;
    }
    
    logger.info(`Shared connection joining session`, { sessionId, connectionId: joinConnectionId });

    const sharedGuacd = new GuacdClient({
        sessionId,
        connectionSettings: { connection: { width: 1024, height: 768, dpi: 96 } },
        joinConnectionId,
        isMaster: false,
        onData: (data) => {
            try {
                if (ws.readyState === ws.OPEN) {
                    ws.send(data, { binary: false, mask: false });
                }
            } catch (e) {}
        },
        onClose: () => {
            try { ws.close(4016, "Session closed"); } catch (e) {}
        },
    });
    
    sharedGuacd.connect();

    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) {
        SessionManager.setActiveWs(sessionId, ws);
    }

    ws.on("message", (msg) => {
        if (!SessionManager.get(sessionId)?.shareWritable) return;
        
        const msgStr = msg.toString();

        const isInteraction = msgStr.includes('.key,') || 
            (msgStr.match(/\.mouse,\d+\.\d+,\d+\.\d+,(\d+)\.(\d+);/)?.[2] > 0);
        if (isInteraction) {
            SessionManager.setActiveWs(sessionId, ws);
        }

        if (msgStr.includes('.size,') && !SessionManager.isActiveWs(sessionId, ws)) {
            return;
        }
        
        sharedGuacd.send(msg);
    });
    
    ws.on("close", () => {
        SessionManager.removeWebSocket(sessionId, ws, true);
        sharedGuacd.close();
    });
    
    ws.on("error", () => {
        SessionManager.removeWebSocket(sessionId, ws, true);
        sharedGuacd.close();
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) {
        return handleSharedGuac(ws, context);
    }
    guacamoleProxy(ws, context.connectionConfig);
};
