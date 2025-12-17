const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");
const { establishJumpHosts, buildSSHOptions, forwardToTarget } = require("./jumpHostHelper");
const logger = require("./logger");

const setupKeyboardInteractive = (ssh, ws) => {
    ssh.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
        ws.send(`\x02${prompts[0].prompt}`);
        ws.on("message", (data) => data.toString().startsWith("\x03") && finish([data.substring(1)]));
    });
};

const createSSHConnection = async (entry, identity, ws) => {
    const credentials = identity.isDirect && identity.directCredentials 
        ? identity.directCredentials 
        : await getIdentityCredentials(identity.id);
    
    const jumpHostIds = entry.config?.jumpHosts || [];
    if (jumpHostIds.length > 0) {
        return createSSHConnectionWithJumpHosts(entry, identity, credentials, jumpHostIds, ws);
    }

    const ssh = new sshd.Client();
    ssh.on("error", (err) => logger.error(`SSH connection error`, { error: err.message, code: err.code }));
    setupKeyboardInteractive(ssh, ws);
    ssh.connect(buildSSHOptions(identity, credentials, entry.config));
    return ssh;
};

const createSSHConnectionWithJumpHosts = async (targetEntry, targetIdentity, targetCredentials, jumpHostIds, ws) => {
    const connections = await establishJumpHosts(jumpHostIds);
    const targetSsh = new sshd.Client();
    setupKeyboardInteractive(targetSsh, ws);

    const targetOptions = buildSSHOptions(targetIdentity, targetCredentials, targetEntry.config);
    targetOptions.sock = await forwardToTarget(connections[connections.length - 1], targetEntry);
    targetSsh._jumpConnections = connections;
    targetSsh.connect(targetOptions);
    return targetSsh;
};

module.exports = { createSSHConnection };
