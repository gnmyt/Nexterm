module.exports.checkDistro = (ssh, ws) => {
    return new Promise((resolve, reject) => {
        ssh.exec("cat /etc/os-release", (err, stream) => {
            if (err) return reject(new Error("Failed to check distro"));

            let data = "";

            stream.on("close", () => {
                let distro = null;
                let version = null;

                data.split("\n").forEach(line => {
                    if (line.startsWith("ID=")) {
                        distro = line.split("=")[1].replace(/"/g, "")
                            .replace(/./, c => c.toUpperCase());
                    }
                    if (line.startsWith("VERSION_ID=")) {
                        version = line.split("=")[1].replace(/"/g, "");
                    }
                });

                if (distro && version) {
                    ws.send(`\x021,${distro},${version}`);
                    resolve();
                } else {
                    reject(new Error("Failed to parse distro information"));
                }
            });

            stream.on("data", newData => {
                data += newData.toString();
            });

            stream.stderr.on("data", () => reject(new Error("Failed to check distro")));
        });
    });
}