const PVEServer = require("../models/PVEServer");
const axios = require("axios");
const { Agent } = require("https");
const { createTicket, getAllNodes } = require("../controllers/pve");

let timer = null;



module.exports.updatePVEServerResources = async (accountId, serverId) => {
    const server = await PVEServer.findOne({ where: { accountId: accountId, id: serverId } });

    if (server === null) return false;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);

        let resourcesUrl, resourcesData;

        if (server.nodeName) {
            resourcesUrl = `https://${server.ip}:${server.port}/api2/json/nodes/${server.nodeName}/qemu`;
            const qemuResponse = await axios.get(resourcesUrl, {
                timeout: 3000,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                }
            });

            const lxcUrl = `https://${server.ip}:${server.port}/api2/json/nodes/${server.nodeName}/lxc`;
            const lxcResponse = await axios.get(lxcUrl, {
                timeout: 3000,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                }
            });

            resourcesData = [
                ...qemuResponse.data.data.map(vm => ({ ...vm, type: 'qemu' })),
                ...lxcResponse.data.data.map(ct => ({ ...ct, type: 'lxc' }))
            ];
        }
        const resources = resourcesData.sort((a, b) => a.vmid - b.vmid).map(resource => ({
            id: resource.vmid,
            type: "pve-" + resource.type,
            name: resource.name,
            status: resource.status,
        }));

        resources.unshift({ id: 0, type: "pve-shell", name: server.nodeName ? `${server.nodeName} Shell` : "Proxmox VE Shell", status: "running" });

        await PVEServer.update({ resources: resources, online: true }, { where: { id: serverId } });
        return true;

    } catch (error) {
        await PVEServer.update({ online: false }, { where: { id: serverId } });
        return false;
    }
};

module.exports.updatePVEAccount = async (accountId) => {
    await processClusterExpansion(accountId);
    const servers = await PVEServer.findAll({ where: { accountId: accountId } });

    for (const server of servers) {
        await this.updatePVEServerResources(accountId, server.id);
    }
};

module.exports.updatePVE = async () => {
    await processClusterExpansion();

    const servers = await PVEServer.findAll();

    if (servers.length === 0) return;

    for (const server of servers) {
        await this.updatePVEServerResources(server.accountId, server.id);
    }

    console.log(`Updated ${servers.length} Proxmox VE servers`);
};

module.exports.startPVEUpdater = () => {
    if (timer !== null) return;

    this.updatePVE();

    timer = setInterval(this.updatePVE, 1000 * 60 * 60); // every hour
};

module.exports.stopPVEUpdater = () => {
    clearInterval(timer);
    timer = null;
};


const expandClusterNodes = async (serverId) => {
    const server = await PVEServer.findByPk(serverId);

    if (!server || server.nodeName) return false;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
        const nodes = await getAllNodes({ ip: server.ip, port: server.port }, ticket);

        if (nodes.length <= 1) {
            await PVEServer.update({ nodeName: nodes[0].node }, { where: { id: serverId } });
            return false;
        }

        const nodeServers = [];
        for (const node of nodes) {
            const nodeServer = {
                ...server,
                id: undefined,
                name: `${server.name} (${node?.node})`,
                nodeName: node?.node,
                resources: [],
                online: false,
                createdAt: undefined,
                updatedAt: undefined
            };
            nodeServers.push(nodeServer);
        }

        await PVEServer.destroy({ where: { id: serverId } });
        await PVEServer.bulkCreate(nodeServers);

        console.log(`Expanded cluster server ${server.name} into ${nodes.length} node entries`);
        return true;

    } catch (error) {
        console.error(`Failed to expand cluster nodes for server ${serverId}:`, error.message);
        return false;
    }
};

const processClusterExpansion = async (accountId = null) => {
    const whereClause = { nodeName: null };
    if (accountId) whereClause.accountId = accountId;

    const serversWithoutNodeName = await PVEServer.findAll({ where: whereClause });

    for (const server of serversWithoutNodeName) {
        await expandClusterNodes(server.id);
    }
};
