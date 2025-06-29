const ServerMonitoring = require("../models/ServerMonitoring");
const Server = require("../models/Server");
const { Op } = require("sequelize");
const { validateServerAccess } = require("./server");

module.exports.getServerMonitoring = async (accountId, serverId, timeRange = "1h") => {
    try {
        const server = await Server.findByPk(serverId);
        const accessCheck = await validateServerAccess(accountId, server);

        if (!accessCheck.valid) return accessCheck;

        let since;
        switch (timeRange) {
            case "1h":
                since = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case "6h":
                since = new Date(Date.now() - 6 * 60 * 60 * 1000);
                break;
            case "24h":
                since = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            default:
                since = new Date(Date.now() - 60 * 60 * 1000);
        }

        const allRecentData = await ServerMonitoring.findAll({
            where: { serverId: serverId },
            order: [["timestamp", "DESC"]],
            limit: 5,
        });

        const monitoringData = await ServerMonitoring.findAll({
            where: {
                serverId: serverId,
                timestamp: {
                    [Op.gte]: since,
                },
            },
            order: [["timestamp", "DESC"]],
            limit: timeRange === "24h" ? 1440 : timeRange === "6h" ? 360 : 60,
        });

        let latestData = monitoringData.length > 0 ? monitoringData[0] : null;

        if (!latestData && allRecentData.length > 0) {
            latestData = allRecentData[0];
            monitoringData.push(...allRecentData);
        }

        const parsedMonitoringData = monitoringData.map(item => ({
            ...item.dataValues || item,
            diskUsage: JSON.parse(item.diskUsage) || [],
            loadAverage: JSON.parse(item.loadAverage) || [],
            osInfo: JSON.parse(item.osInfo) || {},
            networkInterfaces: JSON.parse(item.networkInterfaces) || [],
        }));

        return {
            server: {
                id: server.id,
                name: server.name,
                ip: server.ip,
                port: server.port,
                monitoringEnabled: server.monitoringEnabled,
            },
            data: parsedMonitoringData,
            timeRange: timeRange,
            latest: latestData ? {
                status: latestData.status,
                timestamp: latestData.timestamp,
                cpuUsage: latestData.cpuUsage,
                memoryUsage: latestData.memoryUsage,
                memoryTotal: latestData.memoryTotal,
                diskUsage: JSON.parse(latestData.diskUsage) || [],
                uptime: latestData.uptime,
                loadAverage: JSON.parse(latestData.loadAverage) || [],
                processes: latestData.processes,
                osInfo: JSON.parse(latestData.osInfo) || {},
                networkInterfaces: JSON.parse(latestData.networkInterfaces) || [],
                errorMessage: latestData.errorMessage,
            } : null,
        };
    } catch (error) {
        console.error("Error getting server monitoring:", error);
        return { code: 500, message: "Internal server error" };
    }
};

module.exports.getAllServersMonitoring = async (accountId) => {
    try {
        const servers = await Server.findAll({
            where: {
                [Op.or]: [{ accountId: accountId }, { organizationId: { [Op.not]: null } }],
                protocol: "ssh",
                monitoringEnabled: true,
            },
        });

        const accessibleServers = [];
        for (const server of servers) {
            const accessCheck = await validateServerAccess(accountId, server);
            if (accessCheck.valid) accessibleServers.push(server);
        }

        const serverIds = accessibleServers.map(s => s.id);
        if (serverIds.length === 0) return [];

        const latestMonitoringPromises = serverIds.map(async (serverId) => {
            return await ServerMonitoring.findOne({ where: { serverId }, order: [["timestamp", "DESC"]] });
        });

        const latestMonitoringData = await Promise.all(latestMonitoringPromises);

        const monitoringMap = {};
        latestMonitoringData.forEach((data, index) => {
            if (data) monitoringMap[serverIds[index]] = data;
        });

        return accessibleServers.map(server => {
            const monitoring = monitoringMap[server.id];
            return {
                id: server.id,
                name: server.name,
                ip: server.ip,
                port: server.port,
                icon: server.icon,
                monitoringEnabled: server.monitoringEnabled,
                monitoring: monitoring ? {
                    status: monitoring.status,
                    timestamp: monitoring.timestamp,
                    cpuUsage: monitoring.cpuUsage,
                    memoryUsage: monitoring.memoryUsage,
                    memoryTotal: monitoring.memoryTotal,
                    diskUsage: JSON.parse(monitoring.diskUsage) || [],
                    uptime: monitoring.uptime,
                    loadAverage: JSON.parse(monitoring.loadAverage) || [],
                    processes: monitoring.processes,
                    osInfo: JSON.parse(monitoring.osInfo) || {},
                    networkInterfaces: JSON.parse(monitoring.networkInterfaces) || [],
                    errorMessage: monitoring.errorMessage,
                } : {
                    status: "unknown",
                    timestamp: null,
                    cpuUsage: null,
                    memoryUsage: null,
                    memoryTotal: null,
                    diskUsage: [],
                    uptime: null,
                    loadAverage: [],
                    processes: null,
                    osInfo: {},
                    networkInterfaces: [],
                    errorMessage: "No monitoring data available",
                },
            };
        });
    } catch (error) {
        console.error("Error getting all servers monitoring:", error);
        return { code: 500, message: "Internal server error" };
    }
};