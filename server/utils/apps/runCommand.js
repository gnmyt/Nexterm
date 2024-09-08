module.exports.runPreInstallCommand = (ssh, ws, preInstallCommand) => {
    return new Promise((resolve, reject) => {
        ssh.exec(preInstallCommand, (err, stream) => {
            if (err) return reject(new Error("Failed to run pre-install command"));

            stream.on("data", (data) => {
                ws.send("\x01" + data.toString());
            });

            ws.send("\x025,Pre-install command completed");
            resolve();
        });
    });
}

module.exports.runPostInstallCommand = (ssh, ws, postInstallCommand) => {
    return new Promise((resolve, reject) => {
        ssh.exec(postInstallCommand, (err, stream) => {
            if (err) return reject(new Error("Failed to run post-install command"));

            stream.on("data", (data) => {
                ws.send("\x01" + data.toString());
            });

            ws.send("\x027,Post-install command completed");
            resolve();
        });
    });
}