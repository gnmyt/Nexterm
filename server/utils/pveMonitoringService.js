const logger = require("./logger");
const Integration = require("../models/Integration");
const Credential = require("../models/Credential");
const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const { Op } = require("sequelize");
const axios = require("axios");
const https = require("https");

let monitoringInterval = null;
let isRunning = false;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const start = () => {
    if (isRunning) return;
    isRunning = true;
    logger.system("Starting PVE monitoring service", { interval: 60000 });
    runMonitoring();
    monitoringInterval = setInterval(runMonitoring, 60000);
};

const stop = () => {
    if (monitoringInterval) clearInterval(monitoringInterval);
    monitoringInterval = null;
    isRunning = false;
};

const runMonitoring = async () => {
    try {
        const integrations = await Integration.findAll({ where: { type: "proxmox" } });
        const toMonitor = integrations.filter(i => i.config?.monitoringEnabled);
        if (toMonitor.length) await Promise.allSettled(toMonitor.map(monitorIntegration));
    } catch (error) {
        logger.error("Error running PVE monitoring", { error: error.message });
    }
};

const monitorIntegration = async (integration) => {
    try {
        const credential = await Credential.findOne({ where: { integrationId: integration.id, type: "password" } });
        if (!credential) return saveMonitoringData(integration.id, { status: "error", errorMessage: "No credentials configured" });
        await saveMonitoringData(integration.id, await collectPVEData(integration, credential.secret));
    } catch (error) {
        logger.error("Error monitoring PVE integration", { integrationId: integration.id, error: error.message });
        await saveMonitoringData(integration.id, { status: "error", errorMessage: error.message });
    }
};

const pveRequest = async (ip, port, path, headers = {}) => {
    const { data } = await axios.get(`https://${ip}:${port}/api2/json${path}`, { httpsAgent, headers, timeout: 10000 });
    return data.data || [];
};

const createTicket = async (ip, port, username, password) => {
    const { data } = await axios.post(`https://${ip}:${port}/api2/json/access/ticket`, { username, password }, { timeout: 10000, httpsAgent });
    return data.data;
};

const collectPVEData = async (integration, password) => {
    const { ip, port, username } = integration.config;

    try {
        const ticket = await createTicket(ip, port, username, password);
        const headers = { Cookie: `PVEAuthCookie=${ticket.ticket}` };

        const nodes = await pveRequest(ip, port, "/nodes", headers);
        const resources = await pveRequest(ip, port, "/cluster/resources", headers).catch(() => []);

        let totalCpu = 0, totalCpuUsed = 0, totalMem = 0, totalMemUsed = 0;
        let totalDisk = 0, totalDiskUsed = 0, totalUptime = 0, onlineNodes = 0;

        const nodeDetails = nodes.map(node => {
            const online = node.status === "online";
            if (online) {
                onlineNodes++;
                totalCpu += node.maxcpu || 0;
                totalCpuUsed += (node.cpu || 0) * (node.maxcpu || 1);
                totalMem += node.maxmem || 0;
                totalMemUsed += node.mem || 0;
                totalDisk += node.maxdisk || 0;
                totalDiskUsed += node.disk || 0;
                totalUptime = Math.max(totalUptime, node.uptime || 0);
            }
            return online ? {
                name: node.node, status: node.status, cpu: node.maxcpu || 0,
                cpuUsage: Math.round((node.cpu || 0) * 100), memory: node.maxmem || 0,
                memoryUsed: node.mem || 0, memoryUsage: node.maxmem ? Math.round((node.mem / node.maxmem) * 100) : 0,
                disk: node.maxdisk || 0, diskUsed: node.disk || 0,
                diskUsage: node.maxdisk ? Math.round((node.disk / node.maxdisk) * 100) : 0, uptime: node.uptime || 0,
            } : { name: node.node, status: node.status, cpu: 0, cpuUsage: 0, memory: 0, memoryUsed: 0, memoryUsage: 0, disk: 0, diskUsed: 0, diskUsage: 0, uptime: 0 };
        });

        const countByType = (type, status) => resources.filter(r => r.type === type && (!status || r.status === status)).length;

        return {
            status: onlineNodes > 0 ? "online" : "offline", timestamp: new Date(),
            cpuUsage: totalCpu > 0 ? Math.round((totalCpuUsed / totalCpu) * 100) : 0,
            memoryUsage: totalMem > 0 ? Math.round((totalMemUsed / totalMem) * 100) : 0,
            memoryTotal: totalMem, uptime: totalUptime, loadAverage: null,
            processes: countByType("qemu") + countByType("lxc"),
            pveInfo: {
                nodes: nodeDetails, totalNodes: nodes.length, onlineNodes, totalCpu, totalMemory: totalMem,
                totalDisk, diskUsed: totalDiskUsed, diskUsage: totalDisk > 0 ? Math.round((totalDiskUsed / totalDisk) * 100) : 0,
                vmCount: countByType("qemu"), lxcCount: countByType("lxc"),
                runningVMs: countByType("qemu", "running"), runningLXC: countByType("lxc", "running"),
            },
        };
    } catch (error) {
        if (error.response?.status === 401) return { status: "error", errorMessage: "Authentication failed" };
        if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") return { status: "offline", errorMessage: "Connection failed" };
        throw error;
    }
};

const saveMonitoringData = async (integrationId, data) => {
    try {
        await MonitoringData.create({
            integrationId, entryId: null, timestamp: data.timestamp || new Date(), status: data.status,
            cpuUsage: data.cpuUsage != null ? Math.round(data.cpuUsage) : null,
            memoryUsage: data.memoryUsage != null ? Math.round(data.memoryUsage) : null,
            uptime: data.uptime, loadAverage: data.loadAverage, processes: data.processes, errorMessage: data.errorMessage,
        });

        const snapshotData = {
            integrationId, entryId: null, updatedAt: new Date(), status: data.status,
            memoryTotal: data.memoryTotal, disk: null, network: null, processList: null, osInfo: data.pveInfo || null,
        };
        const [updated] = await MonitoringSnapshot.update(snapshotData, { where: { integrationId } });
        if (!updated) await MonitoringSnapshot.create(snapshotData);
    } catch (error) {
        logger.error("Error saving PVE monitoring data", { integrationId, error: error.message });
    }
};

setInterval(async () => {
    try {
        await MonitoringData.destroy({ where: { integrationId: { [Op.ne]: null }, timestamp: { [Op.lt]: new Date(Date.now() - 86400000) } } });
    } catch (error) {
        logger.error("Error cleaning up PVE monitoring data", { error: error.message });
    }
}, 3600000);

module.exports = { start, stop, runMonitoring, monitorIntegration, collectPVEData };
