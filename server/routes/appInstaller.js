const Session = require("../models/Session");
const Account = require("../models/Account");
const Server = require("../models/Server");
const Identity = require("../models/Identity");

const prepareSSH = require("../utils/prepareSSH");
const { getApp } = require("../controllers/appSource");
const { finalizeInstallation } = require("../utils/apps/finalizeInstallation");
const { runPostInstallCommand, runPreInstallCommand } = require("../utils/apps/runCommand");
const { downloadBaseImage } = require("../utils/apps/pullImage");
const { installDocker } = require("../utils/apps/installDocker");
const { checkPermissions } = require("../utils/apps/checkPermissions");
const { checkDistro } = require("../utils/apps/checkDistro");

const wait = () => new Promise(resolve => setTimeout(resolve, 500));

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    const appId = req.query["appId"];

    if (!authHeader) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!serverId) {
        ws.close(4002, "You need to provide the serverId in the 'serverId' parameter");
        return;
    }

    if (!appId) {
        ws.close(4009, "You need to provide the appId in the 'appId' parameter");
        return;
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

    const server = await Server.findByPk(serverId);
    if (server === null) {
        ws.close(4006, "The server does not exist");
        return;
    }

    if (server.identities.length === 0) {
        ws.close(4007, "The server has no identities");
        return;
    }

    const identity = await Identity.findByPk(JSON.parse(server.identities)[0]);
    if (identity === null) {
        ws.close(4008, "The identity does not exist");
        return;
    }

    const app = await getApp(appId);
    if (app === null) {
        ws.close(4010, "The app does not exist");
        return;
    }

    const ssh = await prepareSSH(server, identity, ws);

    ssh.on("ready", async () => {
        try {
            await checkDistro(ssh, ws);
            await wait();
            await checkPermissions(ssh, ws, identity);
            await wait();
            await installDocker(ssh, ws);

            if (app.preInstallCommand) {
                await wait();
                await runPreInstallCommand(ssh, ws, app.preInstallCommand);
            }

            await wait();
            await downloadBaseImage(ssh, ws, app.id);

            if (app.postInstallCommand) {
                await wait();
                await runPostInstallCommand(ssh, ws, app.postInstallCommand);
            }

            await wait();
            await finalizeInstallation(ssh, ws);

            ssh.end();
        } catch (err) {
            ws.send(`\x03${err.message}`);
            ssh.end();
        }
    });
};