const pve = require("../../controllers/pve");

const RESOURCE_META = {
    "pve-qemu": { renderer: "guac", icon: "server" },
    "pve-lxc": { renderer: "terminal", icon: "linux" },
    "pve-shell": { renderer: "terminal", icon: "terminal" },
};

const toServer = (config) => ({
    ip: config.ip,
    port: config.port,
    username: config.username,
    password: config.password,
});

module.exports = {
    type: "proxmox",
    displayName: "Proxmox VE",

    async testConnection(config) {
        const server = { ip: config.ip, port: config.port };
        const ticket = await pve.createTicket(server, config.username, config.password);
        await pve.getAllNodes(server, ticket);
    },

    async discover(config) {
        const { resources } = await pve.getAllResources(toServer(config));

        return resources.map((node) => ({
            key: node.node,
            name: node.node,
            status: node.status || "online",
            reachable: (node.status || "online") === "online",
            resources: node.resources.map((resource) => {
                const meta = RESOURCE_META[resource.type] || { renderer: "terminal", icon: "terminal" };
                const providerId = resource.type === "pve-shell" ? "shell" : String(resource.id);

                return {
                    providerId,
                    type: resource.type,
                    name: resource.name,
                    status: resource.status || null,
                    renderer: meta.renderer,
                    icon: meta.icon,
                    config: { nodeName: node.node, vmid: resource.id, providerId },
                };
            }),
        }));
    },

    supportsPower(entry) {
        return entry.type === "pve-qemu" || entry.type === "pve-lxc";
    },

    async setPower(config, entry, action) {
        const server = { ...toServer(config), nodeName: entry.config?.nodeName };
        const vmId = entry.config?.vmid;
        const type = entry.type === "pve-qemu" ? "qemu" : "lxc";

        if (action === "start") return pve.startPVEServer(server, vmId, type);
        if (action === "stop") return pve.stopPVEServer(server, vmId, type);
        if (action === "shutdown") return pve.shutdownPVEServer(server, vmId, type);

        throw new Error(`Unsupported power action: ${action}`);
    },

    async collectMetrics(config) {
        const server = { ip: config.ip, port: config.port };

        try {
            const ticket = await pve.createTicket(server, config.username, config.password);
            const nodes = await pve.getAllNodes(server, ticket) || [];
            const resources = await pve.getClusterResources(server, ticket).catch(() => []) || [];

            let totalCpu = 0, totalCpuUsed = 0, totalMem = 0, totalMemUsed = 0;
            let totalDisk = 0, totalDiskUsed = 0, totalUptime = 0, onlineNodes = 0;

            const nodeDetails = nodes.map((node) => {
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

            const countByType = (type, status) => resources.filter((r) => r.type === type && (!status || r.status === status)).length;

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
    },
};
