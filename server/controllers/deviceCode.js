const DeviceCode = require("../models/DeviceCode");
const Session = require("../models/Session");
const { issueNewToken } = require("../utils/loginSession");
const { Op } = require("sequelize");
const logger = require("../utils/logger");
const { CODE_EXPIRY_MS, cleanupExpiredCodes, expireDeviceCode } = require("../utils/deviceCodeCleanup");

const getExpiryCutoff = () => new Date(Date.now() - CODE_EXPIRY_MS);

const destroyOrphanSession = async sessionId => {
    try {
        await Session.destroy({ where: { id: sessionId } });
    } catch (error) {
        logger.warn("Failed to remove orphaned device login session", {
            sessionId,
            error: error.message,
        });
    }
};

module.exports.createCode = async ({ clientType, ipAddress, userAgent }) => {
    await cleanupExpiredCodes();
    
    const deviceCode = await DeviceCode.create({ clientType, ipAddress, userAgent });
    
    logger.system(`Device code created for ${clientType}`, { 
        ip: ipAddress 
    });

    return {
        code: deviceCode.code,
        token: deviceCode.token,
        expiresAt: new Date(new Date(deviceCode.createdAt).getTime() + CODE_EXPIRY_MS),
    };
};

module.exports.authorizeCode = async ({ code, accountId }) => {
    await cleanupExpiredCodes();

    const deviceCode = await DeviceCode.findOne({
        where: {
            code: code.toUpperCase(),
            createdAt: { [Op.gt]: getExpiryCutoff() },
        },
    });

    if (!deviceCode) return { code: 404, message: "Invalid or expired device code" };
    if (deviceCode.sessionId || deviceCode.redeemedAt) {
        return { code: 400, message: "Device code has already been authorized" };
    }

    const session = await Session.create({
        accountId,
        ip: deviceCode.ipAddress,
        userAgent: deviceCode.userAgent,
    });

    const [claimed] = await DeviceCode.update(
        { sessionId: session.id },
        {
            where: {
                id: deviceCode.id,
                sessionId: null,
                redeemedAt: null,
                createdAt: { [Op.gt]: getExpiryCutoff() },
            },
        },
    ).catch(async error => {
        await destroyOrphanSession(session.id);
        throw error;
    });

    if (claimed === 0) {
        await destroyOrphanSession(session.id);
        return { code: 400, message: "Device code has already been authorized" };
    }

    logger.system(`Device code authorized`, { accountId, sessionId: session.id });

    return {
        message: "Device authorized successfully",
        deviceInfo: {
            ipAddress: deviceCode.ipAddress,
            userAgent: deviceCode.userAgent,
            clientType: deviceCode.clientType,
        },
    };
};

module.exports.pollToken = async ({ token }) => {
    const deviceCode = await DeviceCode.findOne({ where: { token } });
    if (!deviceCode) return { status: "invalid" };
    if (deviceCode.redeemedAt) return { status: "invalid" };

    const createdTime = new Date(deviceCode.createdAt).getTime();
    if (Date.now() > createdTime + CODE_EXPIRY_MS) {
        await expireDeviceCode(deviceCode);
        return { status: "invalid" };
    }

    if (deviceCode.sessionId) {
        const session = await Session.findByPk(deviceCode.sessionId);
        if (!session) {
            await DeviceCode.update({ sessionId: null }, { where: { id: deviceCode.id } });
            return { status: "invalid" };
        }

        const [redeemed] = await DeviceCode.update(
            { sessionId: null, redeemedAt: new Date() },
            { where: { id: deviceCode.id, sessionId: deviceCode.sessionId, redeemedAt: null } },
        );

        if (redeemed === 0) return { status: "invalid" };

        const sessionToken = await issueNewToken(session);
        logger.system(`Device code redeemed for session`, { sessionId: session.id });

        return { status: "authorized", token: sessionToken };
    }

    return { status: "pending" };
};

module.exports.checkLinkStatus = async ({ code }) => {
    const deviceCode = await DeviceCode.findOne({
        where: { code: code.toUpperCase() },
    });

    // Redeemed codes stay as tombstones so the QR dialog can observe the claim.
    // A missing row must not be reported as claimed; otherwise an expired or
    // already purged code would look like a successful link.
    if (!deviceCode) return { status: "expired" };

    if (deviceCode.redeemedAt) return { status: "claimed" };

    const createdTime = new Date(deviceCode.createdAt).getTime();
    if (Date.now() > createdTime + CODE_EXPIRY_MS) {
        await expireDeviceCode(deviceCode);
        return { status: "expired" };
    }

    if (deviceCode.sessionId) return { status: "authorized" };
    return { status: "pending" };
};

module.exports.getCodeInfo = async ({ code }) => {
    await cleanupExpiredCodes();

    const deviceCode = await DeviceCode.findOne({
        where: {
            code: code.toUpperCase(),
            createdAt: { [Op.gt]: getExpiryCutoff() },
        },
    });

    if (!deviceCode) return { code: 404, message: "Invalid or expired device code" };
    if (deviceCode.sessionId || deviceCode.redeemedAt) {
        return { code: 400, message: "Device code has already been authorized" };
    }

    return {
        ipAddress: deviceCode.ipAddress,
        userAgent: deviceCode.userAgent,
        clientType: deviceCode.clientType,
        expiresAt: new Date(new Date(deviceCode.createdAt).getTime() + CODE_EXPIRY_MS),
    };
};
