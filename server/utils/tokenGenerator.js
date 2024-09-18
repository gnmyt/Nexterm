const crypto = require("crypto");
const { GUACD_TOKEN } = require("../index");

const encryptToken = (value) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(GUACD_TOKEN), iv);

    let encrypted = cipher.update(JSON.stringify(value), "utf8", "base64");
    encrypted += cipher.final("base64");

    const data = { iv: iv.toString("base64"), value: encrypted };

    const json = JSON.stringify(data);
    return Buffer.from(json).toString("base64");
};

module.exports.createVNCToken = (hostname, port, username, password) => {
    return encryptToken({ connection: { type: "vnc", settings: { hostname, port, password, "ignore-cert": true, "resize-method": "display-update" } } });
};

module.exports.createRDPToken = (hostname, port, username, password) => {
    let domain = "";
    if (username.includes("\\")) [domain, username] = username.split("\\");

    return encryptToken({
        connection: {
            type: "rdp", settings: { hostname, username, port, password, "ignore-cert": true, domain,
                "resize-method": "display-update", "enable-wallpaper": true, "enable-theming": true }
        },
    });
};
