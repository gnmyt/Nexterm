const { engineFetch } = require("../../lib/engineFetch");
const { createTicket, getNodeForServer } = require("../../controllers/pve");
const Integration = require("../../models/Integration");
const Credential = require("../../models/Credential");
const logger = require("../../utils/logger");

const checkPVEStatus = async (entry) => {
    try {
        const { integrationId } = entry;
        
        if (!integrationId) {
            logger.warn(`Entry missing integration ID`, { entryId: entry.id, name: entry.name });
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
            const nodeResponse = await engineFetch(nodeUrl, {
                timeout: 3000,
                insecure: true,
                headers: {
                    Cookie: `PVEAuthCookie=${ticket.ticket}`,
                },
            });

            return nodeResponse.ok ? "online" : "offline";
        }
        
        if (!vmid) {
            logger.warn(`Entry missing VMID`, { entryId: entry.id, name: entry.name });
            return "offline";
        }

        let resourceType;
        if (entry.type === "pve-qemu") {
            resourceType = "qemu";
        } else if (entry.type === "pve-lxc" || entry.type === "pve-shell") {
            resourceType = "lxc";
        } else {
            logger.warn(`Unknown PVE entry type`, { entryId: entry.id, type: entry.type });
            return "offline";
        }

        const statusUrl = `https://${config.ip}:${config.port}/api2/json/nodes/${node}/${resourceType}/${vmid}/status/current`;
        const response = await engineFetch(statusUrl, {
            timeout: 3000,
            insecure: true,
            headers: {
                Cookie: `PVEAuthCookie=${ticket.ticket}`,
            },
        });

        if (!response.ok) return "offline";
        const data = response.json();
        const status = data.data?.status;

        return status || "offline";

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.response?.status === 401) {
            return "offline";
        }
        
        logger.error(`Error checking PVE status`, { entryId: entry.id, error: error.message });
        return "offline";
    }
}

module.exports = { checkPVEStatus };
