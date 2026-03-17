const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const MonitoringSettings = require("../models/MonitoringSettings");
const logger = require("../utils/logger");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const { Op } = require("sequelize");
const { validateEntryAccess } = require("./entry");
const { validateIntegrationAccess } = require("./integration");

const TIME_RANGES = { "1h": { ms: 3600000, points: 60 }, "6h": { ms: 21600000, points: 360 }, "24h": { ms: 86400000, points: 720 } };

const sampleData = (data, targetPoints) => {
    if (!data?.length || data.length <= targetPoints) return data || [];
    const step = (data.length - 1) / (targetPoints - 1);
    return Array.from({ length: targetPoints }, (_, i) => data[Math.min(Math.floor(i * step), data.length - 1)]).filter((v, i, a) => a.indexOf(v) === i);
};

const extractChartData = (item) => ({
    id: item.id, entryId: item.entryId, integrationId: item.integrationId, timestamp: item.timestamp,
    cpuUsage: item.cpuUsage, memoryUsage: item.memoryUsage, processes: item.processes,
    loadAverage: item.loadAverage, uptime: item.uptime, errorMessage: item.errorMessage,
});

const toJson = (obj) => obj?.toJSON ? obj.toJSON() : obj || {};

const fetchMonitoringData = async (whereClause, timeRange) => {
    const { ms, points } = TIME_RANGES[timeRange] || TIME_RANGES["1h"];
    const [data, fallback, snapshot] = await Promise.all([
        MonitoringData.findAll({ where: { ...whereClause, timestamp: { [Op.gte]: new Date(Date.now() - ms) } }, order: [["timestamp", "DESC"]] }),
        MonitoringData.findAll({ where: whereClause, order: [["timestamp", "DESC"]], limit: 100 }),
        MonitoringSnapshot.findOne({ where: whereClause }),
    ]);
    const result = data.length > 0 ? data : fallback;
    return { data: sampleData(result, points).map(extractChartData), latest: { ...toJson(result[0]), ...toJson(snapshot) } };
};

module.exports.getIntegrationMonitoring = async (accountId, integrationId, timeRange = "1h") => {
    try {
        const integration = await Integration.findByPk(integrationId);
        const access = await validateIntegrationAccess(accountId, integration);
        if (!access.valid) return access.error;
        const { data, latest } = await fetchMonitoringData({ integrationId }, timeRange);
        return {
            server: { id: `pve-${integration.id}`, integrationId: integration.id, name: integration.name, ip: integration.config?.ip, port: integration.config?.port, status: integration.status, monitoringEnabled: integration.config?.monitoringEnabled, type: "proxmox" },
            data, timeRange, latest,
        };
    } catch (error) {
        logger.error("Error getting integration monitoring", { integrationId, error: error.message });
        return { code: 500, message: "Internal server error" };
    }
};

module.exports.getServerMonitoring = async (accountId, entryId, timeRange = "1h") => {
    try {
        const entry = await Entry.findByPk(entryId);
        const access = await validateEntryAccess(accountId, entry);
        if (!access.valid) return access;
        const { data, latest } = await fetchMonitoringData({ entryId }, timeRange);
        return {
            server: { id: entry.id, name: entry.name, ip: entry.config?.ip, port: entry.config?.port, status: entry.status, monitoringEnabled: entry.config?.monitoringEnabled },
            data, timeRange, latest,
        };
    } catch (error) {
        logger.error("Error getting server monitoring", { entryId, error: error.message });
        return { code: 500, message: "Internal server error" };
    }
};

const DEFAULT_MONITORING = { timestamp: null, cpuUsage: null, memoryUsage: null, memoryTotal: null, disk: [], uptime: null, loadAverage: [], processes: null, processList: [], osInfo: {}, network: [], errorMessage: "No monitoring data available" };

const buildMonitoringResult = (items, idField, tsMap, snapMap, transform) => items.map(item => {
    const ts = tsMap[item.id], snap = snapMap[item.id];
    return { ...transform(item), monitoring: ts || snap ? { ...toJson(ts), ...toJson(snap) } : DEFAULT_MONITORING };
});

module.exports.getAllServersMonitoring = async (accountId) => {
    try {
        const entries = await Entry.findAll({ where: { type: "server" } });
        const accessChecks = await Promise.all(entries.map(e => validateEntryAccess(accountId, e).then(r => ({ item: e, valid: r.valid }))));
        const accessibleEntries = accessChecks.filter(({ item, valid }) => valid && item.config?.monitoringEnabled && item.config?.protocol === "ssh").map(({ item }) => item);

        const integrations = await Integration.findAll({ where: { type: "proxmox" } });
        const intAccessChecks = await Promise.all(integrations.map(i => validateIntegrationAccess(accountId, i).then(r => ({ item: i, valid: r.valid }))));
        const accessibleInts = intAccessChecks.filter(({ item, valid }) => valid && item.config?.monitoringEnabled).map(({ item }) => item);

        const entryIds = accessibleEntries.map(e => e.id), intIds = accessibleInts.map(i => i.id);
        const [entryData, entrySnaps, intData, intSnaps] = await Promise.all([
            entryIds.length ? MonitoringData.findAll({ where: { entryId: entryIds }, order: [["timestamp", "DESC"]] }) : [],
            entryIds.length ? MonitoringSnapshot.findAll({ where: { entryId: entryIds } }) : [],
            intIds.length ? MonitoringData.findAll({ where: { integrationId: intIds }, order: [["timestamp", "DESC"]] }) : [],
            intIds.length ? MonitoringSnapshot.findAll({ where: { integrationId: intIds } }) : [],
        ]);

        const latestByEntry = {}, snapByEntry = {}, latestByInt = {}, snapByInt = {};
        entryData.forEach(d => { if (!latestByEntry[d.entryId]) latestByEntry[d.entryId] = d; });
        entrySnaps.forEach(s => snapByEntry[s.entryId] = s);
        intData.forEach(d => { if (!latestByInt[d.integrationId]) latestByInt[d.integrationId] = d; });
        intSnaps.forEach(s => snapByInt[s.integrationId] = s);

        return [
            ...buildMonitoringResult(accessibleEntries, "id", latestByEntry, snapByEntry, e => ({ id: e.id, name: e.name, ip: e.config?.ip, status: e.status, port: e.config?.port, icon: e.icon, monitoringEnabled: e.config?.monitoringEnabled, type: "server" })),
            ...buildMonitoringResult(accessibleInts, "id", latestByInt, snapByInt, i => ({ id: `pve-${i.id}`, integrationId: i.id, name: i.name, ip: i.config?.ip, status: i.status, port: i.config?.port, icon: "proxmox", monitoringEnabled: i.config?.monitoringEnabled, type: "proxmox" })),
        ];
    } catch (error) {
        logger.error("Error getting all servers monitoring", { error: error.message });
        return { code: 500, message: "Internal server error" };
    }
};

module.exports.getMonitoringSettings = async () => {
    try {
        let settings = await MonitoringSettings.findOne();
        
        if (!settings) {
            settings = await MonitoringSettings.create({});
        }
        
        return settings.dataValues ? { ...settings.dataValues } : { ...settings };
    } catch (error) {
        logger.error("Error getting monitoring settings", { error: error.message });
        return { code: 500, message: "Failed to retrieve monitoring settings" };
    }
};

module.exports.updateMonitoringSettings = async (updateData) => {
    try {
        let settings = await MonitoringSettings.findOne();
        
        if (!settings) {
            settings = await MonitoringSettings.create({});
        }
        
        const updatePayload = {};
        
        if (updateData.statusCheckerEnabled !== undefined) {
            updatePayload.statusCheckerEnabled = updateData.statusCheckerEnabled;
        }
        if (updateData.statusInterval !== undefined) {
            updatePayload.statusInterval = Math.max(10, Math.min(300, updateData.statusInterval));
        }
        if (updateData.monitoringEnabled !== undefined) {
            updatePayload.monitoringEnabled = updateData.monitoringEnabled;
        }
        if (updateData.monitoringInterval !== undefined) {
            updatePayload.monitoringInterval = Math.max(30, Math.min(600, updateData.monitoringInterval));
        }
        if (updateData.dataRetentionHours !== undefined) {
            updatePayload.dataRetentionHours = Math.max(1, Math.min(24, updateData.dataRetentionHours));
        }
        if (updateData.connectionTimeout !== undefined) {
            updatePayload.connectionTimeout = Math.max(5, Math.min(120, updateData.connectionTimeout));
        }
        if (updateData.batchSize !== undefined) {
            updatePayload.batchSize = Math.max(1, Math.min(50, updateData.batchSize));
        }
        
        const settingsId = settings.dataValues ? settings.dataValues.id : settings.id;
        await MonitoringSettings.update(updatePayload, { where: { id: settingsId } });
        
        const updatedSettings = await MonitoringSettings.findOne();
        
        return updatedSettings.dataValues ? { ...updatedSettings.dataValues } : { ...updatedSettings };
    } catch (error) {
        logger.error("Error updating monitoring settings", { error: error.message });
        return { code: 500, message: "Failed to update monitoring settings" };
    }
};

module.exports.getMonitoringSettingsInternal = async () => {
    try {
        let settings = await MonitoringSettings.findOne();
        
        if (!settings) {
            settings = await MonitoringSettings.create({});
        }
        
        return settings;
    } catch (error) {
        logger.error("Error getting monitoring settings internally", { error: error.message });
        return null;
    }
};
