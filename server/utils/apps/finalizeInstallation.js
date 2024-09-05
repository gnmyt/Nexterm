module.exports.finalizeInstallation = (ssh, ws) => {
    return new Promise((resolve, reject) => {
        ssh.exec("echo todo", (err, stream) => {
            if (err) return reject(new Error("Failed to finalize installation"));
            ws.send("\x027,Installation finalized");
            resolve();
        });
    });
}