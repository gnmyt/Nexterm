const { Op } = require("sequelize");
const Session = require("../models/Session");
const { hashSessionToken } = require("../models/Session");
const SessionSettings = require("../models/SessionSettings");
const stateBroadcaster = require("../lib/StateBroadcaster");
const logger = require("./logger");

const DAY_MS = 24 * 60 * 60 * 1000;
const IMPERSONATION_LIFETIME_MS = 60 * 60 * 1000;
const SETTINGS_CACHE_MS = 30 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let cachedSettings = null;
let cachedAt = 0;

const getSessionSettings = async () => {
    if (cachedSettings && Date.now() - cachedAt < SETTINGS_CACHE_MS) return cachedSettings;
    const settings = await SessionSettings.findOne();
    cachedSettings = settings
        ? { idleTimeoutDays: settings.idleTimeoutDays, maxLifetimeDays: settings.maxLifetimeDays }
        : { idleTimeoutDays: 14, maxLifetimeDays: 90 };
    cachedAt = Date.now();
    return cachedSettings;
};

const updateSessionSettings = async (changes) => {
    const settings = await SessionSettings.findOne();
    await SessionSettings.update(changes, { where: { id: settings.id } });
    cachedSettings = null;
    return getSessionSettings();
};

const expiryOf = (session, settings) => {
    const limits = [];
    if (session.expiresAt) limits.push(new Date(session.expiresAt).getTime());
    if (settings.idleTimeoutDays > 0) limits.push(new Date(session.lastActivity).getTime() + settings.idleTimeoutDays * DAY_MS);
    if (settings.maxLifetimeDays > 0) limits.push(new Date(session.createdAt).getTime() + settings.maxLifetimeDays * DAY_MS);
    return limits.length ? Math.min(...limits) : null;
};

const teardownSession = async (sessionId) => {
    stateBroadcaster.forceLogoutSession(sessionId);

    try {
        const SessionManager = require("../lib/SessionManager");
        SessionManager.disconnectAuthSessionViewers(sessionId);
        await SessionManager.removeAllByAuthSessionId(sessionId);
    } catch (error) {
        logger.warn("Failed to terminate terminal sessions on session expiry", {
            sessionId,
            error: error.message,
        });
    }

    require("./sessionActivity").forgetSession(sessionId);
};

const endSessions = async (where) => {
    const sessions = await Session.findAll({ where, attributes: ["id"] });
    if (!sessions.length) return 0;
    await Session.destroy({ where: { id: sessions.map((session) => session.id) } });
    for (const session of sessions) await teardownSession(session.id);
    return sessions.length;
};

const findActiveSession = async (token) => {
    if (!token) return null;
    const session = await Session.findOne({ where: { tokenHash: hashSessionToken(token) } });
    if (!session) return null;

    const expiry = expiryOf(session, await getSessionSettings());
    if (expiry !== null && expiry <= Date.now()) {
        await endSessions({ id: session.id });
        return null;
    }
    return session;
};

const removeExpiredSessions = async () => {
    const settings = await getSessionSettings();
    const now = Date.now();
    const conditions = [{ expiresAt: { [Op.lte]: new Date(now) } }];
    if (settings.idleTimeoutDays > 0)
        conditions.push({ lastActivity: { [Op.lte]: new Date(now - settings.idleTimeoutDays * DAY_MS) } });
    if (settings.maxLifetimeDays > 0)
        conditions.push({ createdAt: { [Op.lte]: new Date(now - settings.maxLifetimeDays * DAY_MS) } });

    const removed = await endSessions({ [Op.or]: conditions });
    if (removed) logger.info("Removed expired login sessions", { count: removed });
};

setInterval(() => removeExpiredSessions().catch((error) =>
    logger.error("Failed to remove expired login sessions", { error: error.message })), CLEANUP_INTERVAL_MS).unref?.();

const issueNewToken = async (session) => {
    const token = require("crypto").randomBytes(48).toString("hex");
    await Session.update({ tokenHash: hashSessionToken(token) }, { where: { id: session.id } });
    return token;
};

module.exports = {
    IMPERSONATION_LIFETIME_MS,
    issueNewToken,
    getSessionSettings,
    updateSessionSettings,
    findActiveSession,
    endSessions,
};
