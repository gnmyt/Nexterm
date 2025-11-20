const MonitoringData = require("../models/MonitoringData");
const Entry = require("../models/Entry");
const { Op } = require("sequelize");
const { validateEntryAccess } = require("./entry");

module.exports.getServerMonitoring = async (accountId, entryId, timeRange = "1h") => {
    try {
        const entry = await Entry.findByPk(entryId);
        const accessCheck = await validateEntryAccess(accountId, entry);

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

        const allRecentData = await MonitoringData.findAll({
            where: { entryId: entryId },
            order: [["timestamp", "DESC"]],
            limit: 5,
        });

        const monitoringData = await MonitoringData.findAll({
            where: {
                entryId: entryId,
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

        return {
            server: {
                id: entry.id,
                name: entry.name,
                ip: entry.config?.ip,
                port: entry.config?.port,
                status: entry.status,
                monitoringEnabled: entry.config?.monitoringEnabled,
            },
            data: monitoringData,
            timeRange: timeRange,
            latest: latestData || null,
        };
    } catch (error) {
        console.error("Error getting server monitoring:", error);
        return { code: 500, message: "Internal server error" };
    }
};

module.exports.getAllServersMonitoring = async (accountId) => {
    try {
        const entries = await Entry.findAll({
            where: {
                type: "server",
            },
        });

        const accessibleEntries = [];
        for (const entry of entries) {
            const accessCheck = await validateEntryAccess(accountId, entry);
            if (accessCheck.valid && entry.config?.monitoringEnabled && entry.config?.protocol === "ssh") {
                accessibleEntries.push(entry);
            }
        }

        const entryIds = accessibleEntries.map(e => e.id);
        if (entryIds.length === 0) return [];

        const latestMonitoringPromises = entryIds.map(async (entryId) => {
            return await MonitoringData.findOne({ where: { entryId }, order: [["timestamp", "DESC"]] });
        });

        const latestMonitoringData = await Promise.all(latestMonitoringPromises);

        const monitoringMap = {};
        latestMonitoringData.forEach((data, index) => {
            if (data) monitoringMap[entryIds[index]] = data;
        });

        return accessibleEntries.map(entry => {
            const monitoring = monitoringMap[entry.id];
            return {
                id: entry.id,
                name: entry.name,
                ip: entry.config?.ip,
                status: entry.status,
                port: entry.config?.port,
                icon: entry.icon,
                monitoringEnabled: entry.config?.monitoringEnabled,
                monitoring: monitoring || {
                    timestamp: null,
                    cpuUsage: null,
                    memoryUsage: null,
                    memoryTotal: null,
                    disk: [],
                    uptime: null,
                    loadAverage: [],
                    processes: null,
                    osInfo: {},
                    network: [],
                    errorMessage: "No monitoring data available",
                },
            };
        });
    } catch (error) {
        console.error("Error getting all servers monitoring:", error);
        return { code: 500, message: "Internal server error" };
    }
};