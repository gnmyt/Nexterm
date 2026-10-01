const logger = require("./logger");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");
const { getIdentityCredentials } = require("../controllers/identity");
const { getMonitoringSettingsInternal } = require("../controllers/monitoring");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { buildSSHParams, resolveJumpHosts } = require("../lib/ConnectionService");
const { buildWindowsMonitoringCommand, isWindowsProbeResult, isPowerShellProbeResult, parseWindowsMonitoringOutput } = require("./windowsMonitoring");
const { COMMANDS, WINDOWS_OS_COMMAND, parseCPUUsage, parseMeminfo, parseMemoryUsage, parseDiskUsage, parseUptime, parseLoadAverage, parseProcessCount, parseProcessList, parseOSInfo, parseNetworkInterfaces } = require("./monitoringParsers");

let monitoringInterval = null;
let isRunning = false;
let currentSettings = null;

const start = async () => {
    if (isRunning) return;
    isRunning = true;

    currentSettings = await getMonitoringSettingsInternal();
    const interval = currentSettings?.monitoringInterval ? currentSettings.monitoringInterval * 1000 : 60000;

    logger.system("Starting monitoring service", { interval });

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

        if (!currentSettings?.monitoringEnabled) {
            logger.verbose("Monitoring is disabled, skipping cycle");
            return;
        }

        const entries = await Entry.findAll({ where: { type: "server" } });
        const toMonitor = entries.filter(e => e.config?.protocol === "ssh" && e.config?.monitoringEnabled);
        if (toMonitor.length) await Promise.allSettled(toMonitor.map(monitorEntry));
    } catch (error) {
        logger.error("Error running monitoring", { error: error.message });
    }
};

const monitorEntry = async (entry) => {
    try {
        const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [["isDefault", "DESC"]] });
        if (!entryIdentities?.length) return saveMonitoringData(entry.id, { status: "error", errorMessage: "No identities configured" });

        const identities = await Identity.findAll({ where: { id: entryIdentities.map(ei => ei.identityId) } });
        if (!identities?.length) return saveMonitoringData(entry.id, { status: "error", errorMessage: "No valid identities found" });

        const credentials = await getIdentityCredentials(identities[0].id);
        const data = await collectServerData(entry, identities[0], credentials);
        await saveMonitoringData(entry.id, data);
    } catch (error) {
        logger.error("Error monitoring entry", { entryId: entry.id, error: error.message });
        await saveMonitoringData(entry.id, { status: "error", errorMessage: error.message });
    }
};

const osDetectionCache = new Map();

const collectServerData = async (entry, identity, credentials) => {
    if (!controlPlane.hasEngine()) {
        return { status: "error", timestamp: new Date(), errorMessage: "No engine connected. Monitoring requires the Nexterm Engine." };
    }

    const host = entry.config?.ip;
    const port = entry.config?.port || 22;
    if (!host) {
        return { status: "error", timestamp: new Date(), errorMessage: "Missing host configuration" };
    }

    const params = buildSSHParams(identity, credentials);
    const jumpHosts = await resolveJumpHosts(entry);

    try {
        const platformProbe = await controlPlane.execCommand(host, port, params, "cmd /c echo NEXTERM_WINDOWS", jumpHosts);
        if (isWindowsProbeResult(platformProbe)) {
            const shellProbe = await controlPlane.execCommand(host, port, params, "Write-Output NEXTERM_POWERSHELL", jumpHosts);
            const shell = isPowerShellProbeResult(shellProbe) ? "powershell" : "cmd";
            const windowsResult = await controlPlane.execCommand(host, port, params, buildWindowsMonitoringCommand(shell), jumpHosts);
            if (!windowsResult.success || windowsResult.exitCode !== 0) {
                throw new Error(windowsResult.errorMessage || windowsResult.stderr?.trim() || "Failed to collect Windows monitoring data");
            }
            return parseWindowsMonitoringOutput(windowsResult.stdout);
        }

        const commands = Object.entries(COMMANDS).map(([id, command]) => ({ id, command }));
        const batch = await controlPlane.execCommandBatch(host, port, params, commands, jumpHosts);
        if (!batch.success) {
            throw new Error(batch.errorMessage || "Failed to connect to SSH host");
        }

        const out = {};
        for (const r of batch.results || []) {
            out[r.id] = r.success ? (r.stdout || "").trim() : "";
        }

        const meminfo = parseMeminfo(out.memory);
        const fallback = parseMemoryUsage(out.memoryFallback);
        const memory = { total: meminfo.total ?? fallback.total ?? null, usage: meminfo.usage ?? fallback.usage ?? null };
        const osInfo = parseOSInfo(out.osRelease, out.kernel, out.arch, out.hostname);
        if (!osInfo.name && out.windowsOS) {
            const [name, version] = out.windowsOS.split("|");
            if (name) {
                osInfo.name = name.trim();
                osInfo.version = version?.trim() || null;
            }
        }

        return {
            status: "online",
            timestamp: new Date(),
            cpuUsage: parseCPUUsage(out.cpu),
            memoryUsage: memory.usage,
            memoryTotal: memory.total,
            disk: parseDiskUsage(out.lsblk, out.df),
            uptime: parseUptime(out.uptime),
            loadAverage: parseLoadAverage(out.loadAverage),
            processes: parseProcessCount(out.processCount),
            processList: parseProcessList(out.processList),
            osInfo,
            network: parseNetworkInterfaces(out.ifaceDetails, out.ipAddr),
        };
    } catch (error) {
        logger.error("Error during monitoring data collection", { error: error.message, host });
        return { status: "offline", timestamp: new Date(), errorMessage: error.message };
    }
};

const detectServerOS = async (entry) => {
    const cached = osDetectionCache.get(entry.id);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = (async () => {
        if (!controlPlane.hasEngine()) return null;
        const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [["isDefault", "DESC"]] });
        if (!entryIdentities?.length) return null;
        const identity = await Identity.findByPk(entryIdentities[0].identityId);
        if (!identity) return null;
        const credentials = await getIdentityCredentials(identity.id);
        const host = entry.config?.ip;
        if (!host) return null;

        const batch = await controlPlane.execCommandBatch(
            host,
            entry.config?.port || 22,
            buildSSHParams(identity, credentials),
            [
                { id: "linuxOS", command: "cat /etc/os-release" },
                { id: "windowsOS", command: WINDOWS_OS_COMMAND },
            ],
            await resolveJumpHosts(entry),
            entry.config?.engineId,
        );
        if (!batch.success) return null;

        const output = Object.fromEntries((batch.results || []).map(result => [result.id, result.success ? (result.stdout || "").trim() : ""]));
        const osInfo = parseOSInfo(output.linuxOS || "", "", "", "");
        if (osInfo.name) return osInfo;
        if (output.windowsOS) {
            const [name, version] = output.windowsOS.split("|");
            if (name) return { name: name.trim(), version: version?.trim() || null };
        }
        return null;
    })();

    osDetectionCache.set(entry.id, { promise, expiresAt: Date.now() + 60_000 });
    try {
        return await promise;
    } catch (error) {
        osDetectionCache.delete(entry.id);
        logger.debug("Could not detect SSH server operating system", { entryId: entry.id, error: error.message });
        return null;
    }
};

const saveMonitoringData = async (entryId, data) => {
    try {
        await MonitoringData.create({
            entryId,
            timestamp: data.timestamp || new Date(),
            status: data.status,
            cpuUsage: data.cpuUsage == null ? null : Math.round(data.cpuUsage),
            memoryUsage: data.memoryUsage == null ? null : Math.round(data.memoryUsage),
            uptime: data.uptime,
            loadAverage: data.loadAverage,
            processes: data.processes,
            errorMessage: data.errorMessage,
        });

        await MonitoringSnapshot.upsert({
            entryId,
            updatedAt: new Date(),
            status: data.status,
            memoryTotal: data.memoryTotal,
            disk: data.disk,
            network: data.network,
            processList: data.processList,
            osInfo: data.osInfo,
        });
    } catch (error) {
        logger.error("Error saving monitoring data", { entryId, error: error.message });
    }
};

const cleanupOldData = async () => {
    try {
        const settings = await getMonitoringSettingsInternal();
        const retentionHours = settings?.dataRetentionHours || 24;
        const retentionMs = retentionHours * 60 * 60 * 1000;

        await MonitoringData.destroy({ where: { timestamp: { [Op.lt]: new Date(Date.now() - retentionMs) } } });
        logger.verbose("Cleaned up old monitoring data", { retentionHours });
    } catch (error) {
        logger.error("Error cleaning up monitoring data", { error: error.message });
    }
};

setInterval(cleanupOldData, 60 * 60 * 1000);

module.exports = { start, stop, detectServerOS };
