const logger = require("../logger");

module.exports.startContainer = startContainer = (ssh, ws, appId, resolve, reject, useStandalone = true, cmdPrefix) => {
    if (!resolve || !reject) {
        return new Promise((resolve, reject) => {
            startContainer(ssh, ws, appId, resolve, reject, useStandalone, cmdPrefix);
        });
    }

    const command = `cd /opt/nexterm_apps/${appId.replace("/", "_")} && ${cmdPrefix}${useStandalone ? "docker-compose" : "docker compose"} up -d`;

    ssh.exec(command, (err, stream) => {
        if (err) {
            logger.verbose("Failed to execute container start command", { appId, error: err.message });
            return reject(new Error("Failed to start container"));
        }
        stream.on("data", (data) => {
            ws.send("\x01" + data.toString());
        });

        stream.stderr.on("data", (data) => {
            ws.send("\x01" + data.toString());
        });

        stream.on("close", (code) => {
            if (code !== 0) {
                if (useStandalone) {
                    return startContainer(ssh, ws, appId, resolve, reject, false, cmdPrefix);
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
