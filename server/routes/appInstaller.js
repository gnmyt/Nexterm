const { authenticateWS } = require("../utils/wsAuth");
const { getApp } = require("../controllers/appSource");
const { startContainer } = require("../utils/apps/startContainer");
const { runPostInstallCommand, runPreInstallCommand } = require("../utils/apps/runCommand");
const { downloadBaseImage } = require("../utils/apps/pullImage");
const { installDocker } = require("../utils/apps/installDocker");
const { checkPermissions } = require("../utils/apps/checkPermissions");
const { checkDistro } = require("../utils/apps/checkDistro");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const wait = () => new Promise(resolve => setTimeout(resolve, 500));

const replaceCommandVariables = (command, appId) => {
    return command
        .replace(/{appPath}/g, `/opt/nexterm_apps/${appId.replace("/", "_")}`)
        .replace(/{appId}/g, appId.replace("/", "_"));
}

module.exports = async (ws, req) => {
    const authResult = await authenticateWS(ws, req, { requiredParams: ['sessionToken', 'serverId', 'appId'] });
    
    if (!authResult) return;
    
    const { identity, ssh, user, server } = authResult;

    const app = await getApp(req.query.appId);
    if (!app) {
        ws.close(4010, "The app does not exist");
        return;
    }

    await createAuditLog({
        accountId: user.id,
        organizationId: server.organizationId,
        action: AUDIT_ACTIONS.APP_INSTALL,
        resource: RESOURCE_TYPES.APP,
        resourceId: null,
        details: {
            appId: app.id,
            appName: app.name,
        },
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    });

    if (!ssh) {
        ws.close(4009, "SSH connection failed");
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

    ssh.on("error", (error) => {
        ws.send(`\x03SSH connection error: ${error.message}`);
        ws.close(4005, "SSH connection failed");
    });
};