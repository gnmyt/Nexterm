const { getComposeFile } = require("../../controllers/appSource");

const parseDockerPullOutput = (progress, line) => {
    const lines = line.split("\n");

    for (const line of lines) {
        if (line.trim() === "") continue;

        const parts = line.trim().split(" ");
        const layerId = parts[0];
        const status = parts[1];
        const progressPercent = parseProgress(parts[parts.length - 1]);

        if (status === "Downloading") {
            progress[layerId] = Math.round(progressPercent * 50);
        } else if (status === "Extracting") {
            progress[layerId] = 50 + Math.round(progressPercent * 50);
        }
    }
};

const parseProgress = (progressString) => {
    const [downloaded, total] = progressString.split("/").map(convertToBytes);
    return downloaded / total;
};

const convertToBytes = (sizeString) => {
    const number = parseFloat(sizeString);
    if (sizeString.endsWith("kB")) {
        return number * 1024;
    } else if (sizeString.endsWith("MB")) {
        return number * 1024 * 1024;
    } else {
        return number;
    }
};

module.exports.downloadBaseImage = (ssh, ws, appId, cmdPrefix) => {
    const folderAppId = appId.replace("/", "_");

    return new Promise((resolve, reject) => {
        ssh.exec(`${cmdPrefix}mkdir -p /opt/nexterm_apps/${folderAppId}`, (err, stream) => {
            if (err) return reject(new Error("Failed to create app folder"));

            stream.on("data", (data) => {
                ws.send("\x01" + data.toString());
            });

            const fileContent = getComposeFile(appId);
            const escapedContent = fileContent.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

            stream.on("close", () => {
                ssh.exec(`${cmdPrefix} sh -c 'echo "${escapedContent}" > /opt/nexterm_apps/${folderAppId}/docker-compose.yml'`, (err, stream) => {
                    if (err) return reject(new Error("Failed to write docker-compose file"));

                    stream.on("data", (data) => {
                        ws.send("\x01" + data.toString());
                    });

                    this.pullImage(ssh, ws, appId, resolve, reject, true, cmdPrefix);
                });
            });
        });
    });
};

module.exports.pullImage = (ssh, ws, image, resolve, reject, useStandalone = true, cmdPrefix) => {
    ssh.exec(`${cmdPrefix}${useStandalone ? "docker-compose" : "docker compose"} -f /opt/nexterm_apps/${image.replace("/", "_")}/docker-compose.yml pull`, (err, stream) => {
        let layerProgress = {};

        stream.on("data", (data) => {
            ws.send("\x01" + data.toString());
        });

        stream.on("close", (code) => {
            if (code !== 0 && !useStandalone) return reject(new Error("Failed to pull image"));
            if (code !== 0 && useStandalone) return this.pullImage(ssh, ws, image, resolve, reject, false, cmdPrefix);

            ws.send("\x024,Image pulled successfully");
            resolve();
        });

        stream.stderr.on("data", data => {
            ws.send("\x01" + data.toString());
            parseDockerPullOutput(layerProgress, data.toString());

            const totalProgress = Object.values(layerProgress).reduce((acc, curr) => acc + curr, 0) / Object.keys(layerProgress).length;

            if (!isNaN(totalProgress)) {
                ws.send(`\x04${Math.round(totalProgress)}`);
            }
        });
    });
};