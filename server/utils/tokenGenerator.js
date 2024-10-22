module.exports.createVNCToken = (hostname, port, username, password) => {
    return { connection: { type: "vnc", settings: { hostname, port, password, "ignore-cert": true, "resize-method": "display-update" } } };
};

module.exports.createRDPToken = (hostname, port, username, password) => {
    let domain = "";
    if (username.includes("\\")) [domain, username] = username.split("\\");
    return {
        connection: {
            type: "rdp", settings: {
                hostname, username, port, password, domain, "ignore-cert": true,
                "resize-method": "display-update", "enable-wallpaper": true, "enable-theming": true,
            },
        },
    };
};
