const Account = require("../models/Account");
const Session = require("../models/Session");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const { createRDPToken, createVNCToken } = require("../utils/tokenGenerator");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");
const { getIdentityCredentials } = require("../controllers/identity");

module.exports.authenticate = async (req, res, next) => {
    const authHeader = req.header("authorization");
    if (!authHeader)
        return res.status(400).json({ message: "You need to provide the 'authorization' header" });

    const headerTrimmed = authHeader.split(" ");
    if (headerTrimmed.length !== 2)
        return res.status(400).json({ message: "You need to provide the token in the 'authorization' header" });

    req.session = await Session.findOne({ where: { token: headerTrimmed[1] } });

    if (req.session === null)
        return res.status(401).json({ message: "The provided token is not valid" });

    await Session.update({ lastActivity: new Date(), ip: req.ip }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null)
        return res.status(401).json({ message: "The account associated to the token is not registered" });

    next();
};


module.exports.authorizeGuacamole = async (req) => {
    const query = req.url.split("?")[1].split("&").map((x) => x.split("=")).reduce((acc, x) => {
        acc[x[0]] = x[1];
        return acc;
    }, {});

    if (Object.keys(query).length === 0) return;

    req.session = await Session.findOne({ where: { token: query?.sessionToken } });

    if (req.session === null) return;

    await Session.update({ lastActivity: new Date() }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null) return;

    if (!query.serverId) return;

    const entry = await Entry.findByPk(query.serverId);
    if (entry === null) return;

    if (!((await validateEntryAccess(req.user.id, entry)).valid)) return;

    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });
    
    if (entryIdentities.length === 0 && query.identity) return;

    const identityId = query.identity || (entryIdentities.length > 0 ? entryIdentities[0].identityId : null);
    const identity = identityId ? await Identity.findByPk(identityId) : null;
    if (identity === null) return;

    const credentials = await getIdentityCredentials(identityId);

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !query.connectionReason) return;
    }

    console.log("Authorized connection to server " + entry.config?.ip + " with identity " + identity.name);

    let connectionConfig;
    switch (entry.config?.protocol) {
        case "rdp":
            connectionConfig = createRDPToken(entry.config.ip, entry.config.port, identity.username, credentials.password,
                entry.config.keyboardLayout || "en-us-qwerty");
            break;
        case "vnc":
            connectionConfig = createVNCToken(entry.config.ip, entry.config.port, identity.username, credentials.password,
                entry.config.keyboardLayout || "en-us-qwerty");
            break;
        default:
            return;
    }

    if (connectionConfig) {
        connectionConfig.user = req.user;
        connectionConfig.server = entry;
        connectionConfig.identity = identity;
        connectionConfig.ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        connectionConfig.userAgent = req.headers?.['user-agent'] || 'unknown';
        connectionConfig.connectionReason = query.connectionReason || null;
    }

    return connectionConfig;
};
