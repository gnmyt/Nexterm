const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");
const { establishJumpHosts, buildSSHOptions, forwardToTarget } = require("./jumpHostHelper");

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
    const credentials = await getIdentityCredentials(identity.id);
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
        const connections = await establishJumpHosts(jumpHostIds);
        const targetSsh = new sshd.Client();
        
        setupKeyboardInteractive(targetSsh, ws);

        const targetOptions = buildSSHOptions(targetIdentity, targetCredentials, targetEntry.config);
        targetOptions.sock = await forwardToTarget(connections[connections.length - 1], targetEntry);

        targetSsh._jumpConnections = connections;
        targetSsh.connect(targetOptions);
        return targetSsh;
    } catch (error) {
        throw error;
    }
};

module.exports = { createSSHConnection };
