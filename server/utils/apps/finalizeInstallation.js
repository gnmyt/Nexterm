module.exports.finalizeInstallation = (ssh, ws) => {
    return new Promise((resolve, reject) => {
        ssh.exec("echo todo", (err, stream) => {
            if (err) return reject(new Error("Failed to finalize installation"));
            ws.send("\x02\x26,Installation finalized");
            resolve();
        });
    });
}