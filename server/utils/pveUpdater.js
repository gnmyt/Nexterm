const Integration = require("../models/Integration");
const Credential = require("../models/Credential");
const Entry = require("../models/Entry");
const axios = require("axios");
const { Agent } = require("https");
const { createTicket } = require("../controllers/pve");

let timer = null;


module.exports.updatePVEIntegrationResources = async (integrationId) => {
    const integration = await Integration.findOne({ where: { id: integrationId, type: 'proxmox' } });

    if (integration === null) return false;

    try {
        const config = integration.config;
        const credential = await Credential.findOne({ where: { integrationId: integration.id } });
        if (!credential) return false;

        const ticket = await createTicket({ ip: config.ip, port: config.port }, config.username, credential.secret);

        let resourcesData;
        const nodeName = config.nodeName;

        if (nodeName) {
            const qemuUrl = `https://${config.ip}:${config.port}/api2/json/nodes/${nodeName}/qemu`;
            const qemuResponse = await axios.get(qemuUrl, {
                timeout: 3000,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                },
            });

            const lxcUrl = `https://${config.ip}:${config.port}/api2/json/nodes/${nodeName}/lxc`;
            const lxcResponse = await axios.get(lxcUrl, {
                timeout: 3000,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                },
            });

            resourcesData = [
                ...qemuResponse.data.data.map(vm => ({ ...vm, type: "qemu" })),
                ...lxcResponse.data.data.map(ct => ({ ...ct, type: "lxc" })),
            ];
        } else {
            resourcesData = [];
        }
        const existingEntries = await Entry.findAll({ where: { integrationId: integration.id } });

        // TODO: Restore functionality

        return false;
    } catch (error) {
        console.error(`Error updating Proxmox VE integration ${integration.id}:`, error);
        return false;
    }
};

module.exports.updatePVE = async () => {
    const integrations = await Integration.findAll({ where: { type: 'proxmox' } });

    if (integrations.length === 0) return;

    for (const integration of integrations) {
        await this.updatePVEIntegrationResources(integration.id);
    }

    console.log(`Updated ${integrations.length} Proxmox VE integrations`);
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
