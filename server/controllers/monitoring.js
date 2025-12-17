const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const logger = require("../utils/logger");
const Entry = require("../models/Entry");
const { Op } = require("sequelize");
const { validateEntryAccess } = require("./entry");

const TIME_RANGES = {
    "1h": { ms: 60 * 60 * 1000, points: 60 },
    "6h": { ms: 6 * 60 * 60 * 1000, points: 360 },
    "24h": { ms: 24 * 60 * 60 * 1000, points: 720 },
};

const sampleData = (data, targetPoints) => {
    if (!data?.length || data.length <= targetPoints) return data || [];
    const step = (data.length - 1) / (targetPoints - 1);
    const sampled = [];
    for (let i = 0; i < targetPoints; i++) {
        const idx = Math.min(Math.floor(i * step), data.length - 1);
        if (data[idx] && !sampled.includes(data[idx])) sampled.push(data[idx]);
    }
    if (data[0] && sampled[0] !== data[0]) sampled.unshift(data[0]);
    if (data[data.length - 1] && sampled[sampled.length - 1] !== data[data.length - 1]) sampled.push(data[data.length - 1]);
    return sampled;
};

const extractChartData = (item) => ({
    id: item.id, entryId: item.entryId, timestamp: item.timestamp,
    cpuUsage: item.cpuUsage, memoryUsage: item.memoryUsage, processes: item.processes,
    loadAverage: item.loadAverage, uptime: item.uptime, errorMessage: item.errorMessage,
});

module.exports.getServerMonitoring = async (accountId, entryId, timeRange = "1h") => {
    try {
        const entry = await Entry.findByPk(entryId);
        const access = await validateEntryAccess(accountId, entry);
        if (!access.valid) return access;

        const { ms, points } = TIME_RANGES[timeRange] || TIME_RANGES["1h"];
        const since = new Date(Date.now() - ms);

        const [monitoringData, fallbackData, snapshot] = await Promise.all([
            MonitoringData.findAll({
                where: { entryId, timestamp: { [Op.gte]: since } },
                order: [["timestamp", "DESC"]],
            }),
            MonitoringData.findAll({
                where: { entryId },
                order: [["timestamp", "DESC"]],
                limit: 100,
            }),
            MonitoringSnapshot.findOne({ where: { entryId } }),
        ]);

        const data = monitoringData.length > 0 ? monitoringData : fallbackData;
        const latestTimeSeries = data[0] ? (data[0].toJSON ? data[0].toJSON() : data[0]) : {};
        const snapshotData = snapshot ? (snapshot.toJSON ? snapshot.toJSON() : snapshot) : {};

        return {
            server: {
                id: entry.id, name: entry.name, ip: entry.config?.ip,
                port: entry.config?.port, status: entry.status,
                monitoringEnabled: entry.config?.monitoringEnabled,
            },
            data: sampleData(data, points).map(extractChartData),
            timeRange,
            latest: { ...latestTimeSeries, ...snapshotData },
        };
    } catch (error) {
        logger.error("Error getting server monitoring", { entryId, error: error.message });
        return { code: 500, message: "Internal server error" };
    }
};

module.exports.getAllServersMonitoring = async (accountId) => {
    try {
        const entries = await Entry.findAll({ where: { type: "server" } });
        const accessChecks = await Promise.all(entries.map(e => validateEntryAccess(accountId, e).then(r => ({ entry: e, valid: r.valid }))));
        const accessible = accessChecks.filter(({ entry, valid }) => 
            valid && entry.config?.monitoringEnabled && entry.config?.protocol === "ssh"
        ).map(({ entry }) => entry);

        if (!accessible.length) return [];

        const entryIds = accessible.map(e => e.id);
        const [timeSeriesData, snapshots] = await Promise.all([
            MonitoringData.findAll({
                where: { entryId: entryIds },
                order: [["timestamp", "DESC"]],
            }),
            MonitoringSnapshot.findAll({ where: { entryId: entryIds } }),
        ]);

        const latestByEntry = {};
        for (const d of timeSeriesData) {
            if (!latestByEntry[d.entryId]) latestByEntry[d.entryId] = d;
        }
        const snapshotByEntry = {};
        for (const s of snapshots) snapshotByEntry[s.entryId] = s;

        const defaultMonitoring = {
            timestamp: null, cpuUsage: null, memoryUsage: null, memoryTotal: null,
            disk: [], uptime: null, loadAverage: [], processes: null,
            processList: [], osInfo: {}, network: [], errorMessage: "No monitoring data available",
        };

        return accessible.map(entry => {
            const ts = latestByEntry[entry.id];
            const snap = snapshotByEntry[entry.id];
            const monitoring = ts || snap ? {
                ...(ts?.toJSON ? ts.toJSON() : ts || {}),
                ...(snap?.toJSON ? snap.toJSON() : snap || {}),
            } : defaultMonitoring;
            return {
                id: entry.id, name: entry.name, ip: entry.config?.ip,
                status: entry.status, port: entry.config?.port, icon: entry.icon,
                monitoringEnabled: entry.config?.monitoringEnabled,
                monitoring,
            };
        });
    } catch (error) {
        logger.error("Error getting all servers monitoring", { error: error.message });
        return { code: 500, message: "Internal server error" };
    }
};
