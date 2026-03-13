const Integration = require("../models/Integration");
const { getIdentityCredentials } = require("../controllers/identity");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createTicket, getNodeForServer, openVNCConsole } = require("../controllers/pve");

const resolveCredentials = (identity) => {
    return identity.isDirect && identity.directCredentials
        ? identity.directCredentials
        : getIdentityCredentials(identity.id);
};

const buildPveQemuParams = async (entry) => {
    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;
    if (!integration) throw new Error("Integration not found for PVE entry");

    const integrationCreds = await getIntegrationCredentials(integration.id);
    const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
    const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
    const node = await getNodeForServer(server, ticket);
    const vncTicket = await openVNCConsole({ ip: server.ip, port: server.port }, node, entry.config?.vmid, ticket);

    return {
        hostname: server.ip,
        port: String(vncTicket.port),
        password: vncTicket.ticket,
        "ignore-cert": "true",
    };
};

const buildRdpParams = async (cfg, identity) => {
    const params = {
        hostname: cfg.ip,
        port: String(cfg.port || 3389),
        "ignore-cert": "true",
        "server-layout": cfg.keyboardLayout || "en-us-qwerty",
        "resize-method": (cfg.resizeMethod && cfg.resizeMethod !== "none") ? cfg.resizeMethod : "display-update",
    };

    if (identity) {
        let username = identity.username;
        const credentials = await resolveCredentials(identity);
        if (username?.includes("\\")) {
            const [domain, user] = username.split("\\");
            params.domain = domain;
            username = user;
        }
        params.username = username || "";
        if (credentials?.password) params.password = credentials.password;
    }

    if (cfg.colorDepth) params["color-depth"] = String(cfg.colorDepth);
    if (cfg.enableWallpaper !== false) params["enable-wallpaper"] = "true";
    if (cfg.enableTheming !== false) params["enable-theming"] = "true";
    if (cfg.enableFontSmoothing !== false) params["enable-font-smoothing"] = "true";
    if (cfg.enableFullWindowDrag === true) params["enable-full-window-drag"] = "true";
    if (cfg.enableDesktopComposition === true) params["enable-desktop-composition"] = "true";
    if (cfg.enableMenuAnimations === true) params["enable-menu-animations"] = "true";

    return params;
};

const buildVncParams = async (cfg, identity) => {
    const params = {
        hostname: cfg.ip,
        port: String(cfg.port || 5900),
        "ignore-cert": "true",
    };

    if (identity) {
        const credentials = await resolveCredentials(identity);
        if (identity.username) params.username = identity.username;
        if (credentials?.password) params.password = credentials.password;
    }

    if (cfg.colorDepth) params["color-depth"] = String(cfg.colorDepth);
    if (cfg.resizeMethod && cfg.resizeMethod !== "none") params["resize-method"] = cfg.resizeMethod;

    return params;
};

module.exports = { buildPveQemuParams, buildRdpParams, buildVncParams };
