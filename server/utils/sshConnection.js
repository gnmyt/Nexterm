const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");

const createSSHConnection = async (entry, identity, ws) => {
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

    ssh.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
        ws.send(`\x02${prompts[0].prompt}`);
        ws.on("message", (data) => {
            if (data.toString().startsWith("\x03")) {
                const totpCode = data.substring(1);
                finish([totpCode]);
            }
        });
    });

    ssh.connect(sshOptions);

    return ssh;
};

module.exports = { createSSHConnection };
