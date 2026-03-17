const { isConnectionReasonRequired } = require("../controllers/audit");
const logger = require("../utils/logger");
const Entry = require("../models/Entry");

const checkConnectionReason = async (ws, req, next) => {
    try {
        const serverId = req.query.serverId;
        if (!serverId) {
            return next();
        }

        const entry = await Entry.findByPk(serverId);
        if (!entry || !entry.organizationId) {
            return next();
        }

        const requiresReason = await isConnectionReasonRequired(entry.organizationId);
        if (requiresReason && !req.query.reason) {
            ws.close(4010, "Connection reason is required for this organization");
            return;
        }

        next();
    } catch (error) {
        logger.error("Error checking connection reason requirement", { serverId: req.query.serverId, error: error.message });
        next();
    }
};

module.exports = { checkConnectionReason };
