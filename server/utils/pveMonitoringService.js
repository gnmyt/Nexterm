const logger = require("./logger");
const Integration = require("../models/Integration");
const Credential = require("../models/Credential");
const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const { Op } = require("sequelize");
const { getProvider } = require("../lib/hypervisors");
const { getMonitoringSettingsInternal } = require("../controllers/monitoring");

let monitoringInterval = null;
let isRunning = false;
let currentSettings = null;

const start = async () => {
    if (isRunning) return;
    isRunning = true;

    currentSettings = await getMonitoringSettingsInternal();
    const interval = currentSettings?.monitoringInterval ? currentSettings.monitoringInterval * 1000 : 60000;
    
    logger.system("Starting PVE monitoring service", { interval });
    runMonitoring();
    monitoringInterval = setInterval(runMonitoring, interval);
};

const stop = () => {
    if (monitoringInterval) clearInterval(monitoringInterval);
    monitoringInterval = null;
    isRunning = false;
};

const runMonitoring = async () => {
    try {
        currentSettings = await getMonitoringSettingsInternal();

        if (!currentSettings || !currentSettings.monitoringEnabled) {
            logger.verbose("PVE monitoring is disabled, skipping cycle");
            return;
        }
        
        const integrations = await Integration.findAll();
        const toMonitor = integrations.filter(i => i.config?.monitoringEnabled && getProvider(i.type)?.collectMetrics);
        if (toMonitor.length) await Promise.allSettled(toMonitor.map(monitorIntegration));
    } catch (error) {
        logger.error("Error running integration monitoring", { error: error.message });
    }
};

const monitorIntegration = async (integration) => {
    try {
        const provider = getProvider(integration.type);
        if (!provider?.collectMetrics) return;

        const credential = await Credential.findOne({ where: { integrationId: integration.id, type: "password" } });
        if (!credential) return saveMonitoringData(integration.id, { status: "error", errorMessage: "No credentials configured" });

        const { ip, port, username } = integration.config;
        const data = await provider.collectMetrics({ ip, port, username, password: credential.secret });
        await saveMonitoringData(integration.id, data);
    } catch (error) {
        logger.error("Error monitoring integration", { integrationId: integration.id, error: error.message });
        await saveMonitoringData(integration.id, { status: "error", errorMessage: error.message });
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

module.exports = { start, stop, runMonitoring };
