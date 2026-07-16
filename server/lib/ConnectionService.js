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
const { ScriptLayer } = require("./ScriptLayer");
const { SessionType } = require("./generated/control_plane_generated");
const controlPlane = require("./controlPlane/ControlPlaneServer");
const { isRecordingEnabled } = require("../utils/recordingService");
const EngineSftpClient = require("./EngineSftpClient");
const { buildPveQemuParams, buildRdpParams, buildVncParams, buildDemoParams } = require("./guacParamBuilders");

const GUAC_PROTOCOLS = {
    rdp: { sessionType: SessionType.RDP, defaultPort: 3389 },
    vnc: { sessionType: SessionType.VNC, defaultPort: 5900 },
    "pve-qemu": { sessionType: SessionType.VNC, defaultPort: 5900 },
    demo: { sessionType: SessionType.Demo, defaultPort: 0 },
};

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

const FILE_TRANSFER_PORTS = { sftp: 22, ftp: 21, ftps: 21 };

const getEntryProtocol = (entry) => (entry.type === "server" ? entry.config?.protocol : entry.type);

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
    const protocol = getEntryProtocol(entry);

    let script = null;
    if (scriptId) {
        const memberships = await OrganizationMember.findAll({ where: { accountId } });
        script = await getScript(accountId, scriptId, null, memberships.map(m => m.organizationId));
        if (!script) throw new Error("Script not found");
    }

    switch (protocol) {
        case "ssh": return createSSHConnectionForSession(sessionId, entry, identity, organizationId, script);
        case "telnet": return createTelnetConnectionForSession(sessionId, entry, organizationId);
        case "pve-lxc":
        case "pve-shell": return createPveLxcConnectionForSession(sessionId, entry, organizationId);
        case "pve-qemu":
        case "rdp":
        case "vnc":
        case "demo": return prepareGuacamoleSession(sessionId, entry, identity, organizationId);
        case "sftp":
        case "ftp":
        case "ftps": return { success: true, skipped: true };
        default: throw new Error(`Unsupported protocol: ${protocol}`);
    }
};

const resolveFileTransferContext = async (entry, identityId, directIdentity, accountId) => {
    const identityResult = await resolveIdentity(entry, identityId, directIdentity, accountId);
    const identity = extractIdentity(identityResult);
    const credentials = await resolveCredentials(identity);
    const protocol = getEntryProtocol(entry);
    const { host, port } = getHostPort(entry, FILE_TRANSFER_PORTS[protocol] ?? 22);
    const params = buildSSHParams(identity, credentials);
    if (protocol) params.protocol = protocol;
    return { identity, credentials, host, port, params };
};

const createSFTPConnectionForSession = async (sessionId, entry, accountId) => {
    const session = requireSession(sessionId);
    if (session.masterConnection?.sftpClient) return { success: true };
    if (session._connecting) return session._connecting;

    session._connecting = (async () => {
        requireEngine();
        const { identityId, directIdentity } = session.configuration;
        const { host, port, params } = await resolveFileTransferContext(entry, identityId, directIdentity, accountId);
        const jumpHosts = await resolveJumpHosts(entry);

        const dataSocket = await openEngineSession(
            sessionId, SessionType.SFTP, host, port, params, jumpHosts, entry.config?.engineId
        );

        const sftpClient = new EngineSftpClient(dataSocket);
        await sftpClient.waitForReady();

        dataSocket.on("close", () => {
            logger.info("SFTP data connection closed", { sessionId });
            SessionManager.remove(sessionId);
        });
        dataSocket.on("error", (err) => {
            logger.error("SFTP data socket error", { sessionId, error: err.message });
            SessionManager.markFailed(sessionId, err.message);
            SessionManager.remove(sessionId, { code: 4017, reason: err.message });
        });

        SessionManager.setConnection(sessionId, {
            sftpClient,
            dataSocket,
            type: "sftp",
            auditLogId: session.auditLogId,
        });

        logger.info("SFTP connected", { sessionId, target: host, port });
        return { success: true };
    })().finally(() => { session._connecting = null; });

    return session._connecting;
};

const getAuxiliarySFTPClient = async (sessionId, entry, accountId, opts) => {
    const { suffix, clientKey, connectingKey, label } = opts;
    const session = requireSession(sessionId);
    const conn = SessionManager.getConnection(sessionId);
    if (!conn) throw new Error("No active SFTP session");
    if (conn[clientKey] && !conn[clientKey]._closed) return conn[clientKey];
    if (conn[connectingKey]) return conn[connectingKey];

    conn[connectingKey] = (async () => {
        requireEngine();
        const { identityId, directIdentity } = session.configuration;
        const { host, port, params } = await resolveFileTransferContext(entry, identityId, directIdentity, accountId);
        const jumpHosts = await resolveJumpHosts(entry);

        conn._auxGeneration = (conn._auxGeneration || 0) + 1;
        const engineSessionId = `${sessionId}-${suffix}-${conn._auxGeneration}`;
        if (!conn.auxSessionIds) conn.auxSessionIds = new Set();
        conn.auxSessionIds.add(engineSessionId);

        const dataSocket = await openEngineSession(
            engineSessionId, SessionType.SFTP, host, port, params, jumpHosts, entry.config?.engineId
        );

        const client = new EngineSftpClient(dataSocket);
        await client.waitForReady();

        const detach = () => { if (conn[clientKey] === client) conn[clientKey] = null; };
        dataSocket.on("close", detach);
        dataSocket.on("error", detach);

        conn[clientKey] = client;
        logger.info(`SFTP ${label} connection established`, { sessionId, target: host, port });
        return client;
    })().finally(() => { conn[connectingKey] = null; });

    return conn[connectingKey];
};

const getSFTPTransferClient = (sessionId, entry, accountId) =>
    getAuxiliarySFTPClient(sessionId, entry, accountId, {
        suffix: "xfer", clientKey: "transferClient", connectingKey: "_transferConnecting", label: "transfer",
    });

const getSFTPBackgroundClient = (sessionId, entry, accountId) =>
    getAuxiliarySFTPClient(sessionId, entry, accountId, {
        suffix: "bg", clientKey: "backgroundClient", connectingKey: "_backgroundConnecting", label: "background",
    });

const getSFTPAIClient = (sessionId, entry, accountId) =>
    getAuxiliarySFTPClient(sessionId, entry, accountId, {
        suffix: "ai", clientKey: "aiClient", connectingKey: "_aiConnecting", label: "ai",
    });

const createSSHConnectionForSession = async (sessionId, entry, identity, organizationId, script = null) => {
    const session = requireSession(sessionId);
    if (session._connecting) return session._connecting;

    session._connecting = (async () => {
        requireEngine();
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
            SessionManager.markFailed(sessionId, err.message);
            SessionManager.remove(sessionId, { code: 4017, reason: err.message });
        });

        let scriptLayer = null;
        if (script) {
            scriptLayer = new ScriptLayer(dataSocket, null, script, sessionId);
            scriptLayer.start();
        }

        SessionManager.setConnection(sessionId, {
            dataSocket,
            sessionId,
            type: "ssh",
            auditLogId: session.auditLogId,
            scriptLayer,
        });

        if (!script && session.configuration.startPath) {
            const raw = String(session.configuration.startPath);
            if (/[\r\n\x00]/.test(raw)) {
                logger.warn("Ignoring startPath containing control characters", { sessionId });
            } else {
                const quoted = `'${raw.replace(/'/g, `'\\''`)}'`;
                dataSocket.write(`cd ${quoted}\n`);
            }
        }

        logger.info("SSH connected", { sessionId, target: host, port });
        return { success: true };
    })().finally(() => { session._connecting = null; });

    return session._connecting;
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
        SessionManager.markFailed(sessionId, err.message);
        SessionManager.remove(sessionId, { code: 4017, reason: err.message });
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
    requireEngine();
    const session = requireSession(sessionId);

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;
    if (!integration) throw new Error("Integration not found for PVE entry");

    const vmid = entry.config?.vmid ?? "0";
    const integrationCreds = await getIntegrationCredentials(integration.id);
    const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
    const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
    const node = await getNodeForServer(server, ticket);
    const vncTicket = await openLXCConsole({ ip: server.ip, port: server.port }, node, vmid, ticket);

    const containerPart = vmid === 0 || vmid === "0" ? "" : `lxc/${vmid}`;
    const wsUrl = `wss://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/vncwebsocket?port=${vncTicket.port}&vncticket=${encodeURIComponent(vncTicket.ticket)}`;

    const params = {
        ws_url: wsUrl,
        ws_insecure: "true",
        ws_header_Cookie: `PVEAuthCookie=${ticket.ticket}`,
    };

    const dataSocket = await openEngineSession(
        sessionId, SessionType.WebSocket, server.ip, Number(server.port) || 8006, params, [], entry.config?.engineId
    );

    dataSocket.write(`${server.username}:${vncTicket.ticket}\n`);

    await SessionManager.initRecording(sessionId, organizationId);

    const keepAliveTimer = setInterval(() => {
        if (!dataSocket.destroyed) dataSocket.write("2");
    }, 30000);

    dataSocket.on("data", (data) => {
        const text = data.toString();
        if (text !== "OK") SessionManager.appendLog(sessionId, text);
    });

    dataSocket.on("close", () => {
        clearInterval(keepAliveTimer);
        SessionManager.remove(sessionId);
    });

    dataSocket.on("error", (err) => {
        clearInterval(keepAliveTimer);
        logger.error("PVE LXC data socket error", { sessionId, error: err.message });
        SessionManager.markFailed(sessionId, err.message);
        SessionManager.remove(sessionId, { code: 4017, reason: err.message });
    });

    SessionManager.setConnection(sessionId, {
        dataSocket,
        keepAliveTimer,
        type: "pve-lxc",
        auditLogId: session.auditLogId,
    });

    logger.info("PVE LXC connected via engine", { sessionId, vmid });
    return { success: true };
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
    } else if (protocol === "demo") {
        params = await buildDemoParams();
    } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
    }

    const { sessionType, defaultPort } = GUAC_PROTOCOLS[protocol] ?? GUAC_PROTOCOLS.vnc;
    const host = params.hostname || cfg.ip || "";
    const port = Number.parseInt(params.port || cfg.port || defaultPort, 10);
    const jumpHosts = await resolveJumpHosts(entry);

    const dataSocket = await openEngineSession(
        sessionId, sessionType, host, port, params, jumpHosts, entry.config?.engineId
    );

    const recordingEnabled = await isRecordingEnabled(organizationId);

    if (recordingEnabled && session.auditLogId) {
        controlPlane.registerRecordingSession(sessionId, session.auditLogId);
    }

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

    SessionManager.setGuacReady(sessionId);

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
    getSFTPTransferClient,
    getSFTPBackgroundClient,
    getSFTPAIClient,
    buildSSHParams,
    resolveJumpHosts,
};
