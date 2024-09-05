const checkSudoPermissions = (ssh, ws, identity) => {
    return new Promise((resolve, reject) => {
        ssh.exec("sudo -n true", (err) => {
            if (!err) {
                ws.send(`\x022,Sudo access granted`);
                return resolve();
            }

            ssh.exec(`echo ${identity.password} | sudo -S true`, (err) => {
                if (err) {
                    return reject(new Error("Failed to get sudo permissions"));
                }
                ws.send(`\x022,Sudo access granted`);
                resolve();
            });
        });
    });
}

module.exports.checkPermissions = (ssh, ws, identity) => {
    return new Promise((resolve, reject) => {
        ssh.exec("id -u", (err, stream) => {
            if (err) return reject(new Error("Failed to check permissions"));

            stream.on("data", data => {
                const userId = data.toString().trim();
                if (userId === "0") {
                    ws.send(`\x022,Root permissions detected`);
                    resolve();
                } else {
                    checkSudoPermissions(ssh, ws, identity).then(resolve).catch(reject);
                }
            });

            stream.stderr.on("data", err => reject(new Error("Failed to check permissions")));
        });
    });
}