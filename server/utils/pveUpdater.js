const PVEServer = require("../models/PVEServer");
const axios = require("axios");
const { Agent } = require("https");
const { createTicket } = require("../controllers/pve");

let timer = null;



module.exports.updatePVEServerResources = async (accountId, serverId) => {
    const server = await PVEServer.findOne({ where: { accountId: accountId, id: serverId } });

    if (server === null) return false;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);

        const { data } = await axios.get(`https://${server.ip}:${server.port}/api2/json/cluster/resources?type=vm`, {
            timeout: 3000,
            httpsAgent: new Agent({ rejectUnauthorized: false }),
            headers: {
                Cookie: `PVEAuthCookie=${ticket.ticket}`,
            }
        });

        const resources = data.data.map(resource => ({
            id: resource.vmid,
            type: "pve-" + resource.type,
            name: resource.name,
            status: resource.status,
        }));

        resources.unshift({ id: 0, type: "pve-shell", name: "Proxmox VE Shell", status: "running" });

        await PVEServer.update({ resources: resources, online: true }, { where: { id: serverId } });
        return true;

    } catch (error) {
        await PVEServer.update({ online: false }, { where: { id: serverId } });
        return false;
    }
};

module.exports.updatePVEAccount = async (accountId) => {
    const servers = await PVEServer.findAll({ where: { accountId: accountId } });

    for (const server of servers) {
        await this.updatePVEServerResources(accountId, server.id);
    }
};

module.exports.updatePVE = async () => {
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

    timer = setInterval(this.updatePVE, 60000);
};

module.exports.stopPVEUpdater = () => {
    clearInterval(timer);
    timer = null;
};