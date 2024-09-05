module.exports.runPreInstallCommand = (ssh, ws, preInstallCommand) => {
    return new Promise((resolve, reject) => {
        ssh.exec(preInstallCommand, (err) => {
            if (err) return reject(new Error("Failed to run pre-install command"));
            ws.send("\x024,Pre-install command completed");
            resolve();
        });
    });
}

module.exports.runPostInstallCommand = (ssh, ws, postInstallCommand) => {
    return new Promise((resolve, reject) => {
        ssh.exec(postInstallCommand, (err) => {
            if (err) return reject(new Error("Failed to run post-install command"));
            ws.send("\x026,Post-install command completed");
            resolve();
        });
    });
}