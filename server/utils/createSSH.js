const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");

const createSSH = async (entry, identity, options = {}) => {
    const credentials = await getIdentityCredentials(identity.id);

    const sshOptions = {
        host: entry.config.ip,
        port: entry.config.port,
        username: identity.username,
        tryKeyboard: true,
        ...(identity.type === "password" 
            ? { password: credentials.password } 
            : { privateKey: credentials["ssh-key"], passphrase: credentials.passphrase }
        )
    };

    const ssh = new sshd.Client();

    if (options.onKeyboardInteractive) {
        ssh.on("keyboard-interactive", options.onKeyboardInteractive);
    }

    return { ssh, sshOptions };
}

module.exports = { createSSH };
