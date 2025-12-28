const fs = require("fs");
const path = require("path");

const loadSecrets = (dir = "/run/secrets") => {
    try {
        for (const file of fs.readdirSync(dir)) {
            const key = file.toUpperCase();
            if (!process.env[key]) {
                process.env[key] = fs.readFileSync(path.join(dir, file), "utf8").trim();
            }
        }
    } catch {}
};

module.exports = { loadSecrets };
