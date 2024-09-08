module.exports.startContainer = startContainer = (ssh, ws, appId, resolve, reject, useStandalone = true) => {
    if (!resolve || !reject) {
        return new Promise((resolve, reject) => {
            startContainer(ssh, ws, appId, resolve, reject, useStandalone);
        });
    }

    const command = `cd /opt/nexterm_apps/${appId.replace("/", "_")} && ${useStandalone ? "docker-compose" : "docker compose"} up -d`;

    ssh.exec(command, (err, stream) => {
        if (err) {
            return reject(new Error("SSH command execution failed"));
        }

        stream.on("data", (data) => {
            ws.send("\x01" + data.toString());
        });

        stream.on("close", (code) => {
            if (code !== 0) {
                if (useStandalone) {
                    return startContainer(ssh, ws, appId, resolve, reject, false);
                } else {
                    return reject(new Error("Failed to start container"));
                }
            }

            ws.send("\x026,Container started");
            resolve();
        });

        stream.on("error", (streamErr) => {
            return reject(new Error(`Stream error: ${streamErr.message}`));
        });
    });
};
