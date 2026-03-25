const logger = require("../utils/logger");
const { engineFetch } = require("../lib/engineFetch");

const pveRequest = async (server, method, path, ticket = null, body = null) => {
    const url = `https://${server.ip}:${server.port}/api2/json${path}`;
    const headers = {};
    if (ticket) {
        headers["Cookie"] = `PVEAuthCookie=${ticket.ticket}`;
        if (ticket.CSRFPreventionToken) headers["CSRFPreventionToken"] = ticket.CSRFPreventionToken;
    }
    if (body && method !== "GET") headers["Content-Type"] = "application/json";

    const resp = await engineFetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        timeout: 10000,
        insecure: true,
    });

    if (!resp.ok) {
        const err = new Error(`PVE API error: ${resp.status}`);
        err.response = { status: resp.status };
        throw err;
    }

    return resp.json().data;
};

module.exports.createTicket = async (server = { ip: "", port: 0 }, username, password) => {
    return pveRequest(server, "POST", "/access/ticket", null, { username, password });
};

module.exports.getAllNodes = async (server = { ip: "", port: 0 }, ticket) => {
    return pveRequest(server, "GET", "/nodes", ticket);
};

module.exports.openLXCConsole = async (server = { ip: "", port: 0 }, node, vmid, ticket) => {
    const containerPart = vmid === 0 || vmid === "0" ? "" : `lxc/${vmid}`;
    return pveRequest(server, "POST", `/nodes/${node}/${containerPart}/termproxy`, ticket, {});
};

module.exports.openVNCConsole = async (server = { ip: "", port: 0 }, node, vmId, ticket) => {
    return pveRequest(server, "POST", `/nodes/${node}/qemu/${vmId}/vncproxy`, ticket, { websocket: 0 });
};

module.exports.getNodeForServer = async (server, ticket) => {
    if (server.nodeName) {
        return server.nodeName;
    }
    const nodes = await this.getAllNodes(server, ticket);
    if (nodes.length === 0) {
        throw new Error("No nodes found for the specified Proxmox server.");
    }
    return nodes[0].node;
};

module.exports.startPVEServer = async (server = { ip: "", port: 0, username: "", password: "" }, vmId, type) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const node = await this.getNodeForServer(server, ticket);
    return pveRequest(server, "POST", `/nodes/${node}/${type}/${vmId}/status/start`, ticket, {});
};

module.exports.stopPVEServer = async (server = { ip: "", port: 0, username: "", password: "" }, vmId, type) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const node = await this.getNodeForServer(server, ticket);
    return pveRequest(server, "POST", `/nodes/${node}/${type}/${vmId}/status/stop`, ticket, {});
};

module.exports.shutdownPVEServer = async (server = { ip: "", port: 0, username: "", password: "" }, vmId, type) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const node = await this.getNodeForServer(server, ticket);
    return pveRequest(server, "POST", `/nodes/${node}/${type}/${vmId}/status/shutdown`, ticket, {});
};

module.exports.getNodeResources = async (server = { ip: "", port: 0, username: "", password: "" }, nodeName, ticket) => {
    const qemuVMs = await pveRequest(server, "GET", `/nodes/${nodeName}/qemu`, ticket) || [];
    const lxcContainers = await pveRequest(server, "GET", `/nodes/${nodeName}/lxc`, ticket) || [];

    return {
        qemu: qemuVMs.map(vm => ({
            type: 'pve-qemu',
            id: vm.vmid,
            name: vm.name,
            status: vm.status,
        })),
        lxc: lxcContainers.map(lxc => ({
            type: 'pve-lxc',
            id: lxc.vmid,
            name: lxc.name,
            status: lxc.status,
        })),
        shell: {
            type: 'pve-shell',
            id: 0,
            name: `${nodeName} Shell`,
            status: 'running',
        },
    };
};

module.exports.getAllResources = async (server = { ip: "", port: 0, username: "", password: "" }) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const nodes = await this.getAllNodes(server, ticket);

    const allResources = [];
    for (const node of nodes) {
        try {
            const resources = await this.getNodeResources(server, node.node, ticket);
            allResources.push({
                node: node.node,
                status: node.status || 'online',
                resources: [...resources.qemu, ...resources.lxc, resources.shell],
            });
        } catch (error) {
            logger.error("Failed to fetch resources for node", { node: node.node, error: error.message });
            allResources.push({
                node: node.node,
                status: 'offline',
                resources: [],
            });
        }
    }

    return { nodes, resources: allResources };
}