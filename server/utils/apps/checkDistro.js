module.exports.checkDistro = (ssh, ws) => {
    return new Promise((resolve, reject) => {
        ssh.exec("lsb_release -i -s && lsb_release -r -s", (err, stream) => {
            if (err) return reject(new Error("Failed to check distro"));

            let data = "";

            stream.on("close", () => {
                const [distro, version] = data.split("\n");
                ws.send(`\x021,${distro},${version}`);
                resolve();
            });

            stream.on("data", newData => {
                data += newData.toString();
            });

            stream.stderr.on("data", () => reject(new Error("Failed to check distro")));
        });
    });
}