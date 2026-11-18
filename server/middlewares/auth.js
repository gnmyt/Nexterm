const Account = require("../models/Account");
const Session = require("../models/Session");
const { isApiKeyToken, validateApiKey } = require("../controllers/apiKey");
const { findActiveSession } = require("../utils/sessionActivity");
const { isGuestExpired, isDemoGuest, isBlockedForGuest } = require("../utils/demoMode");

const rejectDemoGuest = (req, res, user) => {
    if (isGuestExpired(user)) {
        res.status(401).json({ message: "Your demo session has expired" });
        return true;
    }
    if (isDemoGuest(user) && isBlockedForGuest(req.method, req.originalUrl)) {
        res.status(403).json({ code: 403, message: "This action is not available in the demo" });
        return true;
    }
    return false;
};

module.exports.authenticate = async (req, res, next) => {
    const authHeader = req.header("authorization");
    if (!authHeader)
        return res.status(400).json({ message: "You need to provide the 'authorization' header" });

    const headerTrimmed = authHeader.split(" ");
    if (headerTrimmed.length !== 2)
        return res.status(400).json({ message: "You need to provide the token in the 'authorization' header" });

    const token = headerTrimmed[1];

    if (isApiKeyToken(token)) {
        const result = await validateApiKey(token);
        if (!result)
            return res.status(401).json({ message: "The provided API key is not valid" });

        req.apiKey = result.apiKey;
        req.user = result.account;
        return next();
    }

    req.session = await findActiveSession(token);

    if (req.session === null)
        return res.status(401).json({ message: "The provided token is not valid" });

    await Session.update({ lastActivity: new Date(), ip: req.ip }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null)
        return res.status(401).json({ message: "The account associated to the token is not registered" });

    if (rejectDemoGuest(req, res, req.user)) return;

    next();
};

module.exports.authenticateQuery = async (req, res, next) => {
    const session = await findActiveSession(req.query.token);
    if (!session) return res.status(401).json({ message: "Invalid token" });

    const user = await Account.findByPk(session.accountId);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    if (rejectDemoGuest(req, res, user)) return;

    req.user = user;
    req.session = session;
    next();
};

module.exports.authenticateDownload = async (req, res, next) => {
    const session = await findActiveSession(req.query.token);
    if (!session) return res.status(401).json({ message: "Invalid token" });

    const user = await Account.findByPk(session.accountId);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    const { hasSystemPermission } = require("../permissions/engine");
    const { Permission } = require("../permissions/registry");
    if (!(await hasSystemPermission(user.id, Permission.SETTINGS_BACKUP)))
        return res.status(403).json({ message: "Insufficient permissions" });

    req.user = user;
    req.session = session;
    next();
};
