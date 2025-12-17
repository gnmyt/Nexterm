const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");
const { establishJumpHosts, buildSSHOptions, forwardToTarget } = require("./jumpHostHelper");

const createSSH = async (entry, identity, options = {}) => {
    let credentials;
    if (identity.isDirect && identity.directCredentials) {
        credentials = identity.directCredentials;
    } else {
        credentials = await getIdentityCredentials(identity.id);
    }
    const jumpHostIds = entry.config?.jumpHosts || [];
    
    if (jumpHostIds.length > 0) {
        return await createSSHWithJumpHosts(entry, identity, credentials, jumpHostIds, options);
    }

    const sshOptions = buildSSHOptions(identity, credentials, entry.config);
    const ssh = new sshd.Client();

    if (options.onKeyboardInteractive) {
        ssh.on("keyboard-interactive", options.onKeyboardInteractive);
    }

    return { ssh, sshOptions };
}

const createSSHWithJumpHosts = async (targetEntry, targetIdentity, targetCredentials, jumpHostIds, options = {}) => {
    try {
        const connections = await establishJumpHosts(jumpHostIds);
        const targetSsh = new sshd.Client();
        
        if (options.onKeyboardInteractive) {
            targetSsh.on("keyboard-interactive", options.onKeyboardInteractive);
        }

        const targetOptions = buildSSHOptions(targetIdentity, targetCredentials, targetEntry.config);
        targetOptions.sock = await forwardToTarget(connections[connections.length - 1], targetEntry);

        targetSsh._jumpConnections = connections;
        return { ssh: targetSsh, sshOptions: targetOptions, jumpConnections: connections };
    } catch (error) {
        throw error;
    }
}

module.exports = { createSSH };
