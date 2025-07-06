const { authenticateWS } = require("../utils/wsAuth");
const { getApp } = require("../controllers/appSource");
const { startContainer } = require("../utils/apps/startContainer");
const { runPostInstallCommand, runPreInstallCommand } = require("../utils/apps/runCommand");
const { downloadBaseImage } = require("../utils/apps/pullImage");
const { installDocker } = require("../utils/apps/installDocker");
const { checkPermissions } = require("../utils/apps/checkPermissions");
const { checkDistro } = require("../utils/apps/checkDistro");

const wait = () => new Promise(resolve => setTimeout(resolve, 500));

const replaceCommandVariables = (command, appId) => {
    return command
        .replace(/{appPath}/g, `/opt/nexterm_apps/${appId.replace("/", "_")}`)
        .replace(/{appId}/g, appId.replace("/", "_"));
}

module.exports = async (ws, req) => {
    const authResult = await authenticateWS(ws, req, { requiredParams: ['sessionToken', 'serverId', 'appId'] });
    
    if (!authResult) return;
    
    const { identity, ssh } = authResult;

    const app = await getApp(req.query.appId);
    if (!app) {
        ws.close(4010, "The app does not exist");
        return;
    }

    ssh.on("ready", async () => {
        try {
            await checkDistro(ssh, ws);
            await wait();
            const cmdPrefix = await checkPermissions(ssh, ws, identity);

            await wait();
            await installDocker(ssh, ws, cmdPrefix);

            if (app.preInstallCommand) {
                await wait();
                await runPreInstallCommand(ssh, ws, replaceCommandVariables(app.preInstallCommand, app.id), cmdPrefix);
            }

            await wait();
            await downloadBaseImage(ssh, ws, app.id, cmdPrefix);

            await wait();
            await startContainer(ssh, ws, app.id, undefined, undefined, true, cmdPrefix);

            if (app.postInstallCommand) {
                await wait();
                await runPostInstallCommand(ssh, ws, replaceCommandVariables(app.postInstallCommand, app.id), cmdPrefix);
            }

            ssh.end();
        } catch (err) {
            ws.send(`\x03${err.message}`);
            ssh.end();
        }
    });
};