module.exports.installDocker = (ssh, ws, cmdPrefix) => {
    return new Promise((resolve, reject) => {
        ssh.exec(`${cmdPrefix}docker --version && (${cmdPrefix}docker-compose --version || ${cmdPrefix}docker compose version)`, (err, stream) => {
            let dockerInstalled = false;

            stream.on("data", () => {
                dockerInstalled = true;
                ws.send("\x023,Docker and Docker Compose are already installed");
                resolve();
            });

            stream.stderr.on("data", () => {
                if (!dockerInstalled) {
                    ssh.exec(`curl -fsSL https://get.docker.com | ${cmdPrefix}sh`, (err, stream) => {
                        if (err) {
                            return reject(new Error("Failed to install Docker using the installation script"));
                        }

                        stream.on("data", (data) => {
                            ws.send("\x01" + data.toString());
                        });

                        stream.on("close", () => {
                            ssh.exec(`${cmdPrefix}docker --version && (${cmdPrefix}docker-compose --version || ${cmdPrefix}docker compose version)`, (err, stream) => {
                                if (err) {
                                    return reject(new Error("Failed to verify Docker installation"));
                                }

                                stream.on("data", () => {
                                    ws.send("\x023,Docker and Docker Compose installed successfully");
                                    resolve();
                                });

                                stream.stderr.on("data", () => {
                                    reject(new Error("Docker or Docker Compose not installed correctly"));
                                });
                            });
                        });
                    });
                }
            });
        });
    });
};