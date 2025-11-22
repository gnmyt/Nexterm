const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");
const { establishJumpHosts, buildSSHOptions, forwardToTarget } = require("./jumpHostHelper");
const logger = require("./logger");

const setupKeyboardInteractive = (ssh, ws) => {
    ssh.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
        ws.send(`\x02${prompts[0].prompt}`);
        ws.on("message", (data) => {
            if (data.toString().startsWith("\x03")) {
                finish([data.substring(1)]);
            }
        });
    });
};

const createSSHConnection = async (entry, identity, ws) => {
    let credentials;
    if (identity.isDirect && identity.directCredentials) {
        credentials = identity.directCredentials;
    } else {
        credentials = await getIdentityCredentials(identity.id);
    }
    
    const jumpHostIds = entry.config?.jumpHosts || [];
    
    if (jumpHostIds.length > 0) {
        return await createSSHConnectionWithJumpHosts(entry, identity, credentials, jumpHostIds, ws);
    }

    const sshOptions = buildSSHOptions(identity, credentials, entry.config);
    const ssh = new sshd.Client();
    
    setupKeyboardInteractive(ssh, ws);
    ssh.connect(sshOptions);
    return ssh;
};

const createSSHConnectionWithJumpHosts = async (targetEntry, targetIdentity, targetCredentials, jumpHostIds, ws) => {
    try {
        logger.verbose(`Establishing SSH connection with jump hosts`, { entryId: targetEntry.id, jumpHostCount: jumpHostIds.length });
        const connections = await establishJumpHosts(jumpHostIds);
        const targetSsh = new sshd.Client();
        
        setupKeyboardInteractive(targetSsh, ws);

        const targetOptions = buildSSHOptions(targetIdentity, targetCredentials, targetEntry.config);
        targetOptions.sock = await forwardToTarget(connections[connections.length - 1], targetEntry);

        targetSsh._jumpConnections = connections;
        targetSsh.connect(targetOptions);
        logger.verbose(`SSH connection established via jump hosts`, { entryId: targetEntry.id, jumpHostCount: connections.length });
        return targetSsh;
    } catch (error) {
        logger.error(`Failed to establish SSH connection via jump hosts`, { entryId: targetEntry.id, error: error.message });
        throw error;
    }
};

module.exports = { createSSHConnection };
