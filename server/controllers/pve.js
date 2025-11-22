const logger = require("../utils/logger");
const axios = require("axios");
const https = require("https");
const { Agent } = require("https");

module.exports.createTicket = async (server = { ip: "", port: 0 }, username, password) => {
    const data = await axios.post(`https://${server.ip}:${server.port}/api2/json/access/ticket`, {
        username: username,
        password: password,
    }, {
        timeout: 3000,
        httpsAgent: new Agent({ rejectUnauthorized: false }),
    });

    return data.data.data;
};

module.exports.getAllNodes = async (server = { ip: "", port: 0 }, ticket) => {
    const response = await axios.get(`https://${server.ip}:${server.port}/api2/json/nodes`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
        },
    });

    return response.data.data;
};

module.exports.openLXCConsole = async (server = { ip: "", port: 0 }, node, vmid, ticket) => {
    const containerPart = vmid === 0 || vmid === "0" ? "" : `lxc/${vmid}`;

    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/termproxy`, {}, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
};

module.exports.openVNCConsole = async (server = { ip: "", port: 0 }, node, vmId, ticket) => {
    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/qemu/${vmId}/vncproxy`, { websocket: 0 }, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
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

    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/${type}/${vmId}/status/start`, {}, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
}

module.exports.stopPVEServer = async (server = { ip: "", port: 0, username: "", password: "" },  vmId, type) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const node = await this.getNodeForServer(server, ticket);

    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/${type}/${vmId}/status/stop`, {}, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
}

module.exports.shutdownPVEServer = async (server = { ip: "", port: 0, username: "", password: "" },  vmId, type) => {
    const ticket = await this.createTicket(server, server.username, server.password);
    const node = await this.getNodeForServer(server, ticket);

    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/${type}/${vmId}/status/shutdown`, {}, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
}

module.exports.getNodeResources = async (server = { ip: "", port: 0, username: "", password: "" }, nodeName, ticket) => {
    const response = await axios.get(`https://${server.ip}:${server.port}/api2/json/nodes/${nodeName}/qemu`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
        },
    });

    const qemuVMs = response.data.data || [];

    const lxcResponse = await axios.get(`https://${server.ip}:${server.port}/api2/json/nodes/${nodeName}/lxc`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
        },
    });

    const lxcContainers = lxcResponse.data.data || [];

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
}

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