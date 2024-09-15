const sshd = require("ssh2");

module.exports = (server, identity, ws, res) => {
    const options = {
        host: server.ip,
        port: server.port,
        username: identity.username,
        tryKeyboard: true,
        ...(identity.type === "password" ? { password: identity.password } : { privateKey: identity.sshKey, passphrase: identity.passphrase })
    };

    let ssh = new sshd.Client();
    if (ws) {
        ssh.on("error", (error) => {
            if(error.level === "client-timeout") {
                ws.close(4007, "Client Timeout reached");
            } else {
                ws.close(4005, error.message);
            }
        });

        ssh.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
            ws.send(`\x02${prompts[0].prompt}`);

            ws.on("message", (data) => {
                if (data.toString().startsWith("\x03")) {
                    const totpCode = data.substring(1);
                    finish([totpCode]);
                }
            });
        });
    }

    try {
        ssh.connect(options);
    } catch (err) {
        if (ws) ws.close(4004, err.message);
        if (res) res.status(500).send(err.message);
    }

    if (ws) {
        ssh.on("end", () => {
            ws.close(4006, "Connection closed");
        });

        ssh.on("exit", () => {
            ws.close(4006, "Connection exited");
        });

        ssh.on("close", () => {
            ws.close(4007, "Connection closed");
        });
    }

    if (ws) {
        console.log("Authorized connection to server " + server.ip + " with identity " + identity.name);
    } else {
        console.log("Authorized file download from server " + server.ip + " with identity " + identity.name);
    }

    return ssh;
}