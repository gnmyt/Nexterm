const Session = require("../models/Session");
const Account = require("../models/Account");
const PVEServer = require("../models/PVEServer");
const { validateServerAccess } = require("../controllers/server");

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    let containerId = req.query["containerId"];

    if (!authHeader) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!serverId) {
        ws.close(4002, "You need to provide the serverId in the 'serverId' parameter");
        return;
    }

    if (!containerId) {
        containerId = "0";
    }

    req.session = await Session.findOne({ where: { token: authHeader } });
    if (req.session === null) {
        ws.close(4003, "The token is not valid");
        return;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null) {
        ws.close(4004, "The token is not valid");
        return;
    }

    const server = await PVEServer.findByPk(serverId);
    if (server === null) return;

    if (!((await validateServerAccess(req.user.id, server)).valid)) {
        ws.close(4005, "You don't have access to this server");
        return;
    }

    console.log("Authorized connection to pve server " + server.ip + " with container " + containerId);

    return { server, containerId };
}