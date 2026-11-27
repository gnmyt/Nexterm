const crypto = require("node:crypto");
const { Op } = require("sequelize");
const { genSalt, hash } = require("bcrypt");
const db = require("../utils/database");
const Account = require("../models/Account");
const Session = require("../models/Session");
const { hashSessionToken } = require("../models/Session");
const GroupMember = require("../models/GroupMember");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationMemberPermission = require("../models/OrganizationMemberPermission");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const Theme = require("../models/Theme");
const Keymap = require("../models/Keymap");
const Tag = require("../models/Tag");
const AuditLog = require("../models/AuditLog");
const { deleteAccount } = require("./account");
const { getSeededDemo } = require("../utils/demoSeeder");
const { isDemoMode, DEMO_SETTINGS } = require("../utils/demoMode");
const logger = require("../utils/logger");

const CLEANUP_INTERVAL_MS = 60 * 1000;

const GUEST_OWNED_MODELS = [Snippet, Script, Keymap, Tag, AuditLog];

const removeGuest = async (accountId) => {
    await deleteAccount(accountId);
    for (const model of GUEST_OWNED_MODELS) await model.destroy({ where: { accountId } });
    await Theme.destroy({ where: { accountId } });
};

const countActiveGuests = () => Account.count({ where: { demoExpiresAt: { [Op.gt]: new Date() } } });

const generateUsername = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const username = `guest-${crypto.randomBytes(4).toString("hex")}`;
        if (!(await Account.findOne({ where: { username } }))) return username;
    }
    throw new Error("Could not generate a unique guest username");
};

module.exports.createGuestSession = async ({ ip, userAgent }) => {
    if (!isDemoMode()) return { code: 404, message: "Demo mode is not enabled" };

    if (await Account.count({ where: { demoExpiresAt: null } }) === 0)
        return { code: 503, message: "The demo has not been set up yet" };

    const { guestTtlMinutes, maxGuests } = DEMO_SETTINGS;
    if (await countActiveGuests() >= maxGuests)
        return { code: 503, message: "The demo is at capacity right now, please try again in a few minutes" };

    const { guestGroupId, organizations } = getSeededDemo();
    const expiresAt = new Date(Date.now() + guestTtlMinutes * 60 * 1000);
    const username = await generateUsername();
    const password = await hash(crypto.randomBytes(32).toString("hex"), await genSalt(10));

    const session = await db.transaction(async (transaction) => {
        const account = await Account.create({
            username, password, firstName: "Demo", lastName: "Guest", demoExpiresAt: expiresAt,
        }, { transaction });

        await AuditLog.destroy({ where: { accountId: account.id }, transaction });

        await GroupMember.create({ groupId: guestGroupId, accountId: account.id }, { transaction });

        for (const organization of organizations) {
            await OrganizationMember.create({
                organizationId: organization.id, accountId: account.id,
                role: "member", status: "active", invitedBy: account.id,
            }, { transaction });

            await OrganizationMemberPermission.bulkCreate([...organization.permissions].map(([permission, value]) => ({
                organizationId: organization.id, accountId: account.id, permission, value,
            })), { transaction });
        }

        return Session.create({ accountId: account.id, ip, userAgent }, { transaction });
    });

    logger.system("Demo guest created", { username, ip, expiresAt });

    return { token: session.token, expiresAt };
};

module.exports.cleanupExpiredGuests = async () => {
    const expired = await Account.findAll({
        where: { demoExpiresAt: { [Op.ne]: null, ...(isDemoMode() ? { [Op.lte]: new Date() } : {}) } },
        attributes: ["id", "username"],
    });

    for (const account of expired) {
        try {
            await removeGuest(account.id);
        } catch (error) {
            logger.error("Could not remove expired demo guest", { accountId: account.id, error: error.message });
        }
    }

    if (expired.length) logger.system("Removed expired demo guests", { count: expired.length });
};

module.exports.removeGuestByToken = async (token) => {
    const session = token ? await Session.findOne({ where: { tokenHash: hashSessionToken(token) } }) : null;
    const account = session ? await Account.findByPk(session.accountId) : null;
    if (!account?.demoExpiresAt) return;

    try {
        await removeGuest(account.id);
        logger.system("Demo guest ended their session", { username: account.username });
    } catch (error) {
        logger.error("Could not remove demo guest", { accountId: account.id, error: error.message });
    }
};

let cleanupTimer = null;

module.exports.startGuestCleanup = () => {
    if (cleanupTimer) return;
    module.exports.cleanupExpiredGuests().catch(() => {});
    cleanupTimer = setInterval(() => module.exports.cleanupExpiredGuests().catch(() => {}), CLEANUP_INTERVAL_MS);
};

module.exports.stopGuestCleanup = () => {
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
};
