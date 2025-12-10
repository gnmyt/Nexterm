const logger = require("./logger");

module.exports.createVNCToken = (hostname, port, username, password) => {
    logger.verbose(`VNC token generated`, { hostname, port });
    return {
        connection: {
            type: "vnc",
            settings: {
                hostname,
                port,
                password,
                "ignore-cert": true,
                "resize-method": "display-update",
            },
        },
    };
};

module.exports.createRDPToken = (hostname, port, username, password, keyboardLayout = "en-us-qwerty") => {
    let domain = "";
    if (username.includes("\\")) [domain, username] = username.split("\\");
    logger.verbose(`RDP token generated`, { hostname, port, domain });
    return {
        connection: {
            type: "rdp",
            settings: {
                hostname, username, port, password, domain, "ignore-cert": true, "resize-method": "display-update",
                "enable-wallpaper": true, "enable-theming": true, "server-layout": keyboardLayout,
            },
        },
    };
};
