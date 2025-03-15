const Account = require("../models/Account");
const Session = require("../models/Session");
const Server = require("../models/Server");
const Identity = require("../models/Identity");
const { createRDPToken, createVNCToken } = require("../utils/tokenGenerator");
const { validateServerAccess } = require("../controllers/server");

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

    const server = await Server.findByPk(query.serverId);
    if (server === null) return;

    if (!((await validateServerAccess(req.user.id, server)).valid)) return;

    if (server.identities.length === 0 && query.identity) return;

    const identity = await Identity.findByPk(query.identity || server.identities[0]);
    if (identity === null) return;

    console.log("Authorized connection to server " + server.ip + " with identity " + identity.name);

    let config = {};
    if (server.config) {
        try {
            config = JSON.parse(server.config);
        } catch (e) {
            console.error("Error parsing server config:", e);
        }
    }

    switch (server.protocol) {
        case "rdp":
            return createRDPToken(server.ip, server.port, identity.username, identity.password,
                config.keyboardLayout || "en-us-qwerty");
        case "vnc":
            return createVNCToken(server.ip, server.port, identity.username, identity.password,
                config.keyboardLayout || "en-us-qwerty");
        default:
            return;
    }
};
