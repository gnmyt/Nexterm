const sshd = require("ssh2");

module.exports = (server, identity, ws) => {
    let options;
    if (identity.type === "password") {
        options = {
            host: server.ip,
            port: server.port,
            username: identity.username,
            password: identity.password,
        };
    } else if (identity.type === "ssh") {
        options = {
            host: server.ip,
            port: server.port,
            username: identity.username,
            privateKey: identity.sshKey,
            passphrase: identity.passphrase,
        };
    }

    let ssh = new sshd.Client();
    try {
        ssh.connect(options);
    } catch (err) {
        ws.close(4004, err.message);
    }

    ssh.on("error", (err) => {
        ws.close(4005, err.message);
    });

    ssh.on("end", () => {
        ws.close(4006, "Connection closed");
    });

    ssh.on("close", () => {
        ws.close(4007, "Connection closed");
    });

    ssh.on("keyboard-interactive", (name, instructions, instructionsLang, prompts, finish) => {
        finish([identity.password]);
    });

    console.log("Authorized connection to server " + server.ip + " with identity " + identity.name);

    return ssh;
}