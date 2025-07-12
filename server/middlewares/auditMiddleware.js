const { isConnectionReasonRequired } = require("../controllers/audit");
const Server = require("../models/Server");

const checkConnectionReason = async (ws, req, next) => {
    try {
        const serverId = req.query.serverId;
        if (!serverId) {
            return next();
        }

        const server = await Server.findByPk(serverId);
        if (!server || !server.organizationId) {
            return next();
        }

        const requiresReason = await isConnectionReasonRequired(server.organizationId);
        if (requiresReason && !req.query.reason) {
            ws.close(4010, "Connection reason is required for this organization");
            return;
        }

        next();
    } catch (error) {
        console.error("Error checking connection reason requirement:", error);
        next();
    }
};

module.exports = { checkConnectionReason };
