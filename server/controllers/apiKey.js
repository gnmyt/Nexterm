const crypto = require("crypto");
const { Op } = require("sequelize");
const ApiKey = require("../models/ApiKey");
const Account = require("../models/Account");
const logger = require("../utils/logger");

const TOKEN_PREFIX = "nxt_";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const generateToken = () => {
    const random = crypto.randomBytes(32).toString("hex");
    return `${TOKEN_PREFIX}${random}`;
};

const isApiKeyToken = (token) => typeof token === "string" && token.startsWith(TOKEN_PREFIX);

const serialize = (key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
});

const createApiKey = async (accountId, { name, expiresAt = null }) => {
    if (!name || typeof name !== "string" || name.trim().length === 0)
        return { code: 400, message: "A name is required" };

    if (await ApiKey.count({ where: { accountId } }) >= 50)
        return { code: 400, message: "You have reached the maximum number of API keys (50)" };

    let parsedExpiry = null;
    if (expiresAt) {
        parsedExpiry = new Date(expiresAt);
        if (Number.isNaN(parsedExpiry.getTime()))
            return { code: 400, message: "Invalid expiration date" };
        if (parsedExpiry.getTime() <= Date.now())
            return { code: 400, message: "Expiration date must be in the future" };
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const prefix = `${token.slice(0, TOKEN_PREFIX.length + 6)}…`;

    const record = await ApiKey.create({
        accountId,
        name: name.trim(),
        tokenHash,
        prefix,
        expiresAt: parsedExpiry,
    });

    logger.system("API key created", { accountId, apiKeyId: record.id, name: record.name });

    return { ...serialize(record), token };
};

const listApiKeys = async (accountId) => {
    const keys = await ApiKey.findAll({ where: { accountId }, order: [["createdAt", "DESC"]] });
    return keys.map(serialize);
};

const deleteApiKey = async (accountId, id) => {
    const key = await ApiKey.findOne({ where: { id, accountId } });
    if (!key) return { code: 404, message: "API key not found" };

    await ApiKey.destroy({ where: { id: key.id } });
    logger.system("API key deleted", { accountId, apiKeyId: id });
    return { success: true };
};

const validateApiKey = async (token) => {
    if (!isApiKeyToken(token)) return null;

    const key = await ApiKey.findOne({ where: { tokenHash: hashToken(token) } });
    if (!key) return null;

    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
        await ApiKey.destroy({ where: { id: key.id } });
        return null;
    }

    const account = await Account.findByPk(key.accountId);
    if (!account) return null;

    await ApiKey.update({ lastUsedAt: new Date() }, { where: { id: key.id } });

    return { account, apiKey: key };
};

module.exports = {
    isApiKeyToken,
    createApiKey,
    listApiKeys,
    deleteApiKey,
    validateApiKey,
};
