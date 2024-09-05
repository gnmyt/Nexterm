module.exports.installDocker = (ssh, ws) => {
    return new Promise((resolve, reject) => {
        ssh.exec("docker --version && (docker-compose --version || docker compose version)", (err, stream) => {
            let dockerInstalled = false;

            stream.on("data", (data) => {
                dockerInstalled = true;
                ws.send("\x023,Docker and Docker Compose are already installed");
                resolve();
            });

            stream.stderr.on("data", () => {
                if (!dockerInstalled) {
                    ssh.exec("curl -fsSL https://get.docker.com | sudo sh", (err, stream) => {
                        if (err) {
                            return reject(new Error("Failed to install Docker using the installation script"));
                        }

                        stream.on("close", () => {
                            ssh.exec("docker --version && (docker-compose --version || docker compose version)", (err, stream) => {
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