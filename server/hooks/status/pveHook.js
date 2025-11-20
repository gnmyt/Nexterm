const axios = require("axios");
const { Agent } = require("https");
const { createTicket, getNodeForServer } = require("../../controllers/pve");
const Integration = require("../../models/Integration");
const Credential = require("../../models/Credential");

const checkPVEStatus = async (entry) => {
    try {
        const { integrationId } = entry;
        
        if (!integrationId) {
            console.warn(`Entry ${entry.id} (${entry.name}) missing integration ID`);
            return "offline";
        }

        const integration = await Integration.findOne({ 
            where: { id: integrationId, type: 'proxmox' } 
        });

        if (!integration) {
            return "offline";
        }

        const config = integration.config;
        const credential = await Credential.findOne({ 
            where: { integrationId: integration.id } 
        });

        if (!credential) return "offline";


        const ticket = await createTicket(
            { ip: config.ip, port: config.port }, 
            config.username, 
            credential.secret
        );

        const nodeName = entry.config?.nodeName || config.nodeName;
        const node = nodeName || await getNodeForServer(
            { ip: config.ip, port: config.port, nodeName: config.nodeName }, 
            ticket
        );

        const { vmid } = entry.config || {};

        if (entry.type === "pve-shell" && (!vmid || vmid === 0 || vmid === "0")) {
            const nodeUrl = `https://${config.ip}:${config.port}/api2/json/nodes/${node}/status`;
            const nodeResponse = await axios.get(nodeUrl, {
                timeout: 3000,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                },
            });

            return nodeResponse.data.data ? "online" : "offline";
        }
        
        if (!vmid) {
            console.warn(`Entry ${entry.id} (${entry.name}) missing VMID`);
            return "offline";
        }

        let resourceType;
        if (entry.type === "pve-qemu") {
            resourceType = "qemu";
        } else if (entry.type === "pve-lxc" || entry.type === "pve-shell") {
            resourceType = "lxc";
        } else {
            console.warn(`Unknown PVE entry type: ${entry.type}`);
            return "offline";
        }

        const statusUrl = `https://${config.ip}:${config.port}/api2/json/nodes/${node}/${resourceType}/${vmid}/status/current`;
        const response = await axios.get(statusUrl, {
            timeout: 3000,
            httpsAgent: new Agent({ rejectUnauthorized: false }),
            headers: {
                Cookie: `PVEAuthCookie=${ticket.ticket}`,
            },
        });

        const status = response.data.data.status;

        return status || "offline";

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.response?.status === 401) {
            return "offline";
        }
        
        console.error(`Error checking PVE status for entry ${entry.id}:`, error.message);
        return "offline";
    }
}

module.exports = { checkPVEStatus };
