const sshd = require("ssh2");
const net = require("net");
const { WebSocket } = require("ws");
const SessionManager = require("./SessionManager");
const { ScriptLayer } = require("./ScriptLayer");
const logger = require("../utils/logger");
const { getIdentityCredentials } = require("../controllers/identity");
const { getIntegrationCredentials } = require("../controllers/integration");
const { createTicket, getNodeForServer, openLXCConsole, openVNCConsole } = require("../controllers/pve");
const { establishJumpHosts, buildSSHOptions, forwardToTarget } = require("../utils/jumpHostHelper");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const { resolveIdentity } = require("../utils/identityResolver");
const { getScript } = require("../controllers/script");
const OrganizationMember = require("../models/OrganizationMember");

async function createConnectionForSession(sessionId, accountId) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");

    const entry = await Entry.findByPk(session.entryId);
    if (!entry) throw new Error("Entry not found");

    const { type, identityId, directIdentity, scriptId } = session.configuration;
    if (type === "sftp") return { success: true, skipped: true };

    const identityResult = await resolveIdentity(entry, identityId, directIdentity, accountId);
    const identity = identityResult?.identity !== undefined ? identityResult.identity : identityResult;
    const organizationId = entry.organizationId || null;
    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;

    let script = null;
    if (scriptId) {
        const memberships = await OrganizationMember.findAll({ where: { accountId } });
        script = await getScript(accountId, scriptId, null, memberships.map(m => m.organizationId));
        if (!script || script.code) throw new Error(script?.message || "Script not found");
    }

    switch (protocol) {
        case "ssh": return createSSHConnectionForSession(sessionId, entry, identity, organizationId, script);
        case "telnet": return createTelnetConnectionForSession(sessionId, entry, organizationId);
        case "pve-lxc":
        case "pve-shell": return createPveLxcConnectionForSession(sessionId, entry, organizationId);
        case "pve-qemu":
        case "rdp":
        case "vnc": return prepareGuacamoleSession(sessionId, entry, identity, organizationId);
        default: throw new Error(`Unsupported entry type: ${entry.type}`);
    }
}

async function createSSHConnectionForSession(sessionId, entry, identity, organizationId, script = null) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");

    const { auditLogId, configuration: { startPath } } = session;
    const credentials = identity.isDirect && identity.directCredentials
        ? identity.directCredentials : await getIdentityCredentials(identity.id);
    const ssh = await createSSHClient(entry, identity, credentials);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { ssh.end(); reject(new Error("SSH timeout")); }, 30000);

        ssh.on("ready", () => {
            clearTimeout(timeout);
            ssh.shell({ term: "xterm-256color" }, async (err, stream) => {
                if (err) { ssh.end(); return reject(new Error(`Shell: ${err.message}`)); }
                stream.setMaxListeners(50);
                await SessionManager.initRecording(sessionId, organizationId);
                stream.on("data", (d) => SessionManager.appendLog(sessionId, d.toString()));

                const scriptLayer = script ? new ScriptLayer(stream, null, script, sessionId) : null;
                SessionManager.setConnection(sessionId, { ssh, stream, auditLogId, scriptLayer, type: 'ssh' });

                if (script) scriptLayer.start();
                else if (startPath) stream.write(`cd '${startPath.replace(/'/g, "'\\''")}' && clear\n`);

                stream.on("close", () => { logger.info("SSH closed", { sessionId }); SessionManager.remove(sessionId); });
                logger.info("SSH connected", { sessionId, target: entry.config?.ip, hasScript: !!script });
                resolve({ success: true });
            });
        });

        ssh.on("error", (err) => { clearTimeout(timeout); logger.error("SSH error", { sessionId, error: err.message }); reject(err); });
    });
}

async function createSSHClient(entry, identity, credentials) {
    const jumpHostIds = entry.config?.jumpHosts || [];

    if (jumpHostIds.length > 0) {
        const connections = await establishJumpHosts(jumpHostIds, null);
        const targetSsh = new sshd.Client();

        const targetOptions = buildSSHOptions(identity, credentials, entry.config);
        targetOptions.sock = await forwardToTarget(connections[connections.length - 1], entry);
        targetSsh._jumpConnections = connections;
        targetSsh.connect(targetOptions);
        return targetSsh;
    }

    const ssh = new sshd.Client();
    ssh.on("error", (err) => logger.error("SSH connection error", { error: err.message, code: err.code }));
    ssh.connect(buildSSHOptions(identity, credentials, entry.config));
    return ssh;
}

async function createTelnetConnectionForSession(sessionId, entry, organizationId) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");

    const { ip, port = 23 } = entry.config || {};

    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => { socket.destroy(); reject(new Error("Telnet connection timeout")); }, 30000);

        socket.connect(port, ip, async () => {
            clearTimeout(timeout);
            await SessionManager.initRecording(sessionId, organizationId);
            socket.on("data", (data) => SessionManager.appendLog(sessionId, data.toString()));
            SessionManager.setConnection(sessionId, { socket, auditLogId: session.auditLogId, type: 'telnet' });
            logger.info("Telnet connected", { sessionId, ip, port });
            resolve({ success: true });
        });

        socket.on("error", (err) => { clearTimeout(timeout); logger.error("Telnet error", { sessionId, error: err.message }); reject(err); });
        socket.on("close", () => { logger.info("Telnet closed", { sessionId }); SessionManager.remove(sessionId); });
    });
}

async function createPveLxcConnectionForSession(sessionId, entry, organizationId) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");

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
                SessionManager.setConnection(sessionId, { lxcSocket, keepAliveTimer, auditLogId: session.auditLogId, type: 'pve-lxc' });
                logger.info("PVE LXC connected", { sessionId, vmid });
                resolve({ success: true });
            } catch (err) { clearInterval(keepAliveTimer); lxcSocket.close(); reject(err); }
        });

        lxcSocket.on("error", (err) => { clearTimeout(timeout); if (keepAliveTimer) clearInterval(keepAliveTimer); reject(err); });
        lxcSocket.on("close", () => { if (keepAliveTimer) clearInterval(keepAliveTimer); SessionManager.remove(sessionId); });
    });
}

async function prepareGuacamoleSession(sessionId, entry, identity, organizationId) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");

    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;
    const guacConfig = { type: 'guacamole', protocol, entry, organizationId, auditLogId: session.auditLogId };

    if (entry.type === "pve-qemu") {
        const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;
        if (!integration) throw new Error("Integration not found for PVE entry");

        const integrationCreds = await getIntegrationCredentials(integration.id);
        const server = { ...integration.config, ...entry.config, password: integrationCreds.password };
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
        const node = await getNodeForServer(server, ticket);
        const vncTicket = await openVNCConsole({ ip: server.ip, port: server.port }, node, entry.config?.vmid, ticket);
        guacConfig.pveConfig = { server, ticket, node, vncTicket, vmid: entry.config?.vmid };
    } else if (identity) {
        guacConfig.identity = identity;
        guacConfig.credentials = identity.isDirect && identity.directCredentials
            ? identity.directCredentials
            : await getIdentityCredentials(identity.id);
    }

    session.guacConfig = guacConfig;
    session.guacReady = true;
    logger.info("Guacamole prepared", { sessionId, protocol });
    return { success: true };
}

module.exports = {
    createConnectionForSession,
    createSSHConnectionForSession,
    createTelnetConnectionForSession,
    createPveLxcConnectionForSession,
    prepareGuacamoleSession
};
