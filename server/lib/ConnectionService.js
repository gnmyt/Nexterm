const { WebSocket } = require("ws");
const SessionManager = require("./SessionManager");
const GuacdClient = require("./GuacdClient");
const logger = require("../utils/logger");
const { getIdentityCredentials } = require("../controllers/identity");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createTicket, getNodeForServer, openLXCConsole } = require("../controllers/pve");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const { resolveIdentity } = require("../utils/identityResolver");
const { getScript } = require("../controllers/script");
const OrganizationMember = require("../models/OrganizationMember");
const { SessionType } = require("./generated/control_plane_generated");
const controlPlane = require("./controlPlane/ControlPlaneServer");
const { isRecordingEnabled } = require("../utils/recordingService");
const EngineSftpClient = require("./EngineSftpClient");
const { buildPveQemuParams, buildRdpParams, buildVncParams } = require("./guacParamBuilders");

const requireEngine = () => {
    if (!controlPlane.hasEngine()) throw new Error("No engine connected");
};

const requireSession = (sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");
    return session;
};

const resolveCredentials = async (identity) => {
    return identity.isDirect && identity.directCredentials
        ? identity.directCredentials
        : await getIdentityCredentials(identity.id);
};

const buildSSHParams = (identity, credentials) => {
    const params = { username: identity.username || credentials.username || "" };
    if (credentials.password) params.password = credentials.password;
    if (credentials.privateKey || credentials["ssh-key"]) params.privateKey = credentials.privateKey || credentials["ssh-key"];
    if (credentials.passphrase) params.passphrase = credentials.passphrase;
    return params;
};

const extractIdentity = (identityResult) => {
    return identityResult?.identity === undefined ? identityResult : identityResult.identity;
};

const getHostPort = (entry, defaultPort = 22) => {
    const host = entry.config?.ip;
    const port = entry.config?.port || defaultPort;
    if (!host) throw new Error("Missing host configuration");
    return { host, port };
};

const resolveJumpHosts = async (entry) => {
    const jumpHostIds = entry.config?.jumpHosts;
    if (!jumpHostIds || jumpHostIds.length === 0) return [];

    const jumpHosts = [];
    for (const jumpHostId of jumpHostIds) {
        const jhEntry = await Entry.findByPk(jumpHostId);
        if (!jhEntry) throw new Error(`Jump host entry ${jumpHostId} not found`);

        const { host, port } = getHostPort(jhEntry);
        const identityResult = await resolveIdentity(jhEntry, null, null, null);
        const identity = extractIdentity(identityResult);
        if (!identity) throw new Error(`No identity found for jump host ${jumpHostId}`);

        const credentials = await resolveCredentials(identity);
        jumpHosts.push({
            host,
            port,
            username: identity.username || credentials.username || "",
            password: credentials.password || null,
            privateKey: credentials.privateKey || credentials["ssh-key"] || null,
            passphrase: credentials.passphrase || null,
        });
    }
    return jumpHosts;
};

const openEngineSession = async (sessionId, sessionType, host, port, params, jumpHosts = [], engineId) => {
    const dataSocketPromise = controlPlane.waitForDataConnection(sessionId);
    try {
        await controlPlane.openSession(sessionId, sessionType, host, port, params, jumpHosts, engineId || null);
    } catch (err) {
        dataSocketPromise.catch(() => {});
        throw err;
    }
    return dataSocketPromise;
};

const createConnectionForSession = async (sessionId, accountId) => {
    const session = requireSession(sessionId);

    const entry = await Entry.findByPk(session.entryId);
    if (!entry) throw new Error("Entry not found");

    const { type, identityId, directIdentity, scriptId } = session.configuration;
    if (type === "sftp") return { success: true, skipped: true };

    const identityResult = await resolveIdentity(entry, identityId, directIdentity, accountId);
    const identity = extractIdentity(identityResult);
    const organizationId = entry.organizationId || null;
    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;

    let script = null;
    if (scriptId) {
        const memberships = await OrganizationMember.findAll({ where: { accountId } });
        script = await getScript(accountId, scriptId, null, memberships.map(m => m.organizationId));
        if (!script) throw new Error("Script not found");
    }

    switch (protocol) {
        case "ssh": return createSSHConnectionForSession(sessionId, entry, identity, organizationId);
        case "telnet": return createTelnetConnectionForSession(sessionId, entry, organizationId);
        case "pve-lxc":
        case "pve-shell": return createPveLxcConnectionForSession(sessionId, entry, organizationId);
        case "pve-qemu":
        case "rdp":
        case "vnc": return prepareGuacamoleSession(sessionId, entry, identity, organizationId);
        default: throw new Error(`Unsupported entry type: ${entry.type}`);
    }
};

const resolveSSHContext = async (entry, identityId, directIdentity, accountId) => {
    const identityResult = await resolveIdentity(entry, identityId, directIdentity, accountId);
    const identity = extractIdentity(identityResult);
    const credentials = await resolveCredentials(identity);
    const { host, port } = getHostPort(entry);
    const params = buildSSHParams(identity, credentials);
    return { identity, credentials, host, port, params };
};

const createSFTPConnectionForSession = async (sessionId, entry, accountId) => {
    const existingConn = SessionManager.getConnection(sessionId);
    if (existingConn?.sftpClient) return { success: true };

    requireEngine();
    const session = requireSession(sessionId);
    const { identityId, directIdentity } = session.configuration;
    const { host, port, params } = await resolveSSHContext(entry, identityId, directIdentity, accountId);
    const jumpHosts = await resolveJumpHosts(entry);

    const dataSocket = await openEngineSession(
        sessionId, SessionType.SFTP, host, port, params, jumpHosts, entry.config?.engineId
    );

    const sftpClient = new EngineSftpClient(dataSocket);
    await sftpClient.waitForReady();

    SessionManager.setConnection(sessionId, {
        sftpClient,
        dataSocket,
        type: "sftp",
        auditLogId: session.auditLogId,
    });

    logger.info("SFTP connected", { sessionId, target: host, port });
    return { success: true };
};

const createSSHConnectionForSession = async (sessionId, entry, identity, organizationId) => {
    requireEngine();
    const session = requireSession(sessionId);
    const credentials = await resolveCredentials(identity);
    const { host, port } = getHostPort(entry);
    const params = buildSSHParams(identity, credentials);
    const jumpHosts = await resolveJumpHosts(entry);

    const dataSocket = await openEngineSession(
        sessionId, SessionType.SSH, host, port, params, jumpHosts, entry.config?.engineId
    );

    await SessionManager.initRecording(sessionId, organizationId);

    dataSocket.on("data", (data) => SessionManager.appendLog(sessionId, data.toString()));
    dataSocket.on("close", () => {
        logger.info("SSH data connection closed", { sessionId });
        SessionManager.remove(sessionId);
    });
    dataSocket.on("error", (err) => {
        logger.error("SSH data socket error", { sessionId, error: err.message });
        SessionManager.remove(sessionId);
    });

    SessionManager.setConnection(sessionId, {
        dataSocket,
        sessionId,
        type: "ssh",
        auditLogId: session.auditLogId,
    });

    logger.info("SSH connected", { sessionId, target: host, port });
    return { success: true };
};

const createTelnetConnectionForSession = async (sessionId, entry, organizationId) => {
    requireEngine();
    const session = requireSession(sessionId);
    const { ip, port = 23 } = entry.config || {};

    if (!ip) throw new Error("Missing host configuration");

    const dataSocket = await openEngineSession(
        sessionId, SessionType.Telnet, ip, port, {}, entry.config?.engineId
    );

    await SessionManager.initRecording(sessionId, organizationId);

    dataSocket.on("data", (data) => SessionManager.appendLog(sessionId, data.toString()));
    dataSocket.on("close", () => {
        logger.info("Telnet data connection closed", { sessionId });
        SessionManager.remove(sessionId);
    });
    dataSocket.on("error", (err) => {
        logger.error("Telnet data socket error", { sessionId, error: err.message });
        SessionManager.remove(sessionId);
    });

    SessionManager.setConnection(sessionId, {
        dataSocket,
        sessionId,
        type: "telnet",
        auditLogId: session.auditLogId,
    });

    logger.info("Telnet connected", { sessionId, ip, port });
    return { success: true };
}

const createPveLxcConnectionForSession = async (sessionId, entry, organizationId) => {
    const session = requireSession(sessionId);

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;
    if (!integration) throw new Error("Integration not found for PVE entry");

    const vmid = entry.config?.vmid ?? "0";
    const integrationCreds = await getIntegrationCredentials(integration.id);
    const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
    const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
    const node = await getNodeForServer(server, ticket);
    const vncTicket = await openLXCConsole({ ip: server.ip, port: server.port }, node, vmid, ticket);

    return new Promise((resolve, reject) => {
        const containerPart = vmid === 0 || vmid === "0" ? "" : `lxc/${vmid}`;
        const lxcSocket = new WebSocket(
            `wss://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/vncwebsocket?port=${vncTicket.port}&vncticket=${encodeURIComponent(vncTicket.ticket)}`,
            undefined,
            { rejectUnauthorized: false, headers: { "Cookie": `PVEAuthCookie=${ticket.ticket}` } }
        );

        const timeout = setTimeout(() => { lxcSocket.close(); reject(new Error("PVE LXC timeout")); }, 30000);
        let keepAliveTimer = null;

        lxcSocket.on("open", async () => {
            clearTimeout(timeout);
            try {
                lxcSocket.send(`${server.username}:${vncTicket.ticket}\n`);
                keepAliveTimer = setInterval(() => lxcSocket.readyState === lxcSocket.OPEN && lxcSocket.send("2"), 30000);
                await SessionManager.initRecording(sessionId, organizationId);
                lxcSocket.on("message", (msg) => {
                    const data = msg instanceof Buffer ? msg.toString() : msg;
                    if (data !== "OK") SessionManager.appendLog(sessionId, data);
                });
                SessionManager.setConnection(sessionId, { lxcSocket, keepAliveTimer, auditLogId: session.auditLogId, type: "pve-lxc" });
                logger.info("PVE LXC connected", { sessionId, vmid });
                resolve({ success: true });
            } catch (err) { clearInterval(keepAliveTimer); lxcSocket.close(); reject(err); }
        });

        lxcSocket.on("error", (err) => {
            clearTimeout(timeout);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            reject(err);
        });
        lxcSocket.on("close", () => {
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            SessionManager.remove(sessionId);
        });
    });
}

const prepareGuacamoleSession = async (sessionId, entry, identity, organizationId) => {
    const session = requireSession(sessionId);
    requireEngine();
    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;
    const cfg = entry.config || {};

    let params;
    if (entry.type === "pve-qemu") {
        params = await buildPveQemuParams(entry);
    } else if (protocol === "rdp") {
        params = await buildRdpParams(cfg, identity);
    } else if (protocol === "vnc") {
        params = await buildVncParams(cfg, identity);
    } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
    }

    const host = params.hostname || cfg.ip;
    const port = Number.parseInt(params.port || cfg.port || (protocol === "rdp" ? 3389 : 5900), 10);
    const sessionType = protocol === "rdp" ? SessionType.RDP : SessionType.VNC;

    const dataSocket = await openEngineSession(
        sessionId, sessionType, host, port, params, entry.config?.engineId
    );

    const recordingEnabled = await isRecordingEnabled(organizationId);

    const masterClient = new GuacdClient({
        sessionId,
        connectionSettings: {
            connection: { type: protocol, width: 1024, height: 768, dpi: 96, ...params },
            enableAudio: entry.config?.enableAudio !== false,
        },
        recordingEnabled,
        auditLogId: session.auditLogId,
        existingSocket: dataSocket,
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Master handshake timeout")), 15000);
        masterClient.onReadyCallback = (connectionId) => { clearTimeout(timeout); resolve(connectionId); };
        masterClient.onCloseCallback = (reason) => { clearTimeout(timeout); reject(new Error(`Master connection failed: ${reason}`)); };
        masterClient.connect();
    });

    session.guacReady = true;

    SessionManager.setConnection(sessionId, {
        guacdClient: masterClient,
        dataSocket,
        type: "guac",
        auditLogId: session.auditLogId,
    });

    logger.info("Guacamole session prepared", { sessionId, protocol, target: host, port });
    return { success: true };
}

module.exports = {
    createConnectionForSession,
    createSFTPConnectionForSession,
    buildSSHParams,
    resolveJumpHosts,
};
