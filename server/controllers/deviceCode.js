const DeviceCode = require("../models/DeviceCode");
const Session = require("../models/Session");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

const CODE_EXPIRY_MS = 10 * 60 * 1000;

const cleanupExpiredCodes = async () => {
    await DeviceCode.destroy({
        where: { createdAt: { [Op.lt]: new Date(Date.now() - CODE_EXPIRY_MS) } },
    });
};

module.exports.createCode = async ({ clientType, ipAddress, userAgent }) => {
    await cleanupExpiredCodes();
    
    const deviceCode = await DeviceCode.create({ clientType, ipAddress, userAgent });
    
    logger.system(`Device code created for ${clientType}`, { 
        code: deviceCode.code, 
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
            createdAt: { [Op.gt]: new Date(Date.now() - CODE_EXPIRY_MS) },
        },
    });

    if (!deviceCode) return { code: 404, message: "Invalid or expired device code" };
    if (deviceCode.sessionId) return { code: 400, message: "Device code has already been authorized" };

    const session = await Session.create({
        accountId,
        ip: deviceCode.ipAddress,
        userAgent: deviceCode.userAgent,
    });

    await DeviceCode.update({ sessionId: session.id }, { where: { id: deviceCode.id } });
    
    logger.system(`Device code authorized`, { code: deviceCode.code, accountId, sessionId: session.id });

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
    await cleanupExpiredCodes();

    const deviceCode = await DeviceCode.findOne({ where: { token } });
    if (!deviceCode) return { status: "invalid" };

    const createdTime = new Date(deviceCode.createdAt).getTime();
    if (Date.now() > createdTime + CODE_EXPIRY_MS) {
        await DeviceCode.destroy({ where: { id: deviceCode.id } });
        return { status: "invalid" };
    }

    if (deviceCode.sessionId) {
        const session = await Session.findByPk(deviceCode.sessionId);
        if (!session) {
            await DeviceCode.destroy({ where: { id: deviceCode.id } });
            return { status: "invalid" };
        }
        
        await DeviceCode.destroy({ where: { id: deviceCode.id } });
        logger.system(`Device code redeemed for session`, { sessionId: session.id });
        
        return { status: "authorized", token: session.token };
    }

    return { status: "pending" };
};

module.exports.getCodeInfo = async ({ code }) => {
    await cleanupExpiredCodes();

    const deviceCode = await DeviceCode.findOne({
        where: {
            code: code.toUpperCase(),
            createdAt: { [Op.gt]: new Date(Date.now() - CODE_EXPIRY_MS) },
        },
    });

    if (!deviceCode) return { code: 404, message: "Invalid or expired device code" };
    if (deviceCode.sessionId) return { code: 400, message: "Device code has already been authorized" };

    return {
        ipAddress: deviceCode.ipAddress,
        userAgent: deviceCode.userAgent,
        clientType: deviceCode.clientType,
        expiresAt: new Date(new Date(deviceCode.createdAt).getTime() + CODE_EXPIRY_MS),
    };
};
