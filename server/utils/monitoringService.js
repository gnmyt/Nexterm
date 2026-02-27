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

const executeCommand = async (host, port, params, cmd, jumpHosts = []) => {
    if (!controlPlane.hasEngine()) throw new Error("No engine connected");

    const result = await controlPlane.execCommand(host, port, params, cmd, jumpHosts);
    if (!result.success) {
        throw new Error(result.errorMessage || "Command execution failed");
    }
    if (result.exitCode !== 0) {
        throw new Error(`Command failed with exit code ${result.exitCode}`);
    }
    return (result.stdout || "").trim();
};

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
        const execCmd = (cmd) => executeCommand(host, port, params, cmd, jumpHosts);

        const [cpu, mem, uptime, load, processes] = await Promise.all([
            getCPUUsage(execCmd), getMemoryUsage(execCmd), getUptime(execCmd), getLoadAverage(execCmd), getProcessCount(execCmd)
        ]);
        const [disk, os, network] = await Promise.all([getDiskUsage(execCmd), getOSInfo(execCmd), getNetworkInterfaces(execCmd)]);
        const processList = await getProcessList(execCmd);

        return {
            status: "online", timestamp: new Date(), cpuUsage: cpu,
            memoryUsage: mem.usage, memoryTotal: mem.total, disk, uptime,
            loadAverage: load, processes, processList, osInfo: os, network
        };
    } catch (error) {
        logger.error("Error during monitoring data collection", { error: error.message, host });
        return { status: "offline", timestamp: new Date(), errorMessage: error.message };
    }
};

const getCPUUsage = async (execCmd) => {
    try {
        const output = await execCmd("grep 'cpu ' /proc/stat");
        const vals = output.split(" ").filter(Boolean).slice(1).map(Number);
        return Math.round(((vals.reduce((a, b) => a + b, 0) - vals[3]) / vals.reduce((a, b) => a + b, 0)) * 100);
    } catch { return null; }
};

const getMemoryUsage = async (execCmd) => {
    try {
        const lines = (await execCmd("free -b")).split("\n");
        const parts = lines[1].split(/\s+/);
        const total = Number.parseInt(parts[1]), available = Number.parseInt(parts[6] || parts[3]);
        return { usage: Math.round(((total - available) / total) * 100), total };
    } catch { return { usage: null, total: null }; }
};

const getDiskUsage = async (execCmd) => {
    try {
        const [lsblkOutput, dfOutput] = await Promise.all([
            execCmd("lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT -J").catch(() => ""),
            execCmd("df -B1 --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'").catch(() => ""),
        ]);

        const usageMap = {};
        for (const line of dfOutput.split("\n").filter(Boolean)) {
            const p = line.trim().split(/\s+/);
            usageMap[p[0]] = {
                filesystem: p[0],
                type: p[1],
                size: Number.parseInt(p[2], 10) || 0,
                used: Number.parseInt(p[3], 10) || 0,
                available: Number.parseInt(p[4], 10) || 0,
                usagePercent: Number.parseInt(p[5], 10) || 0,
                mountPoint: p[6] || "",
            };
        }

        const disks = [];
        try {
            const lsblk = JSON.parse(lsblkOutput);
            for (const device of lsblk.blockdevices || []) {
                if (device.type !== "disk") continue;
                const disk = {
                    name: device.name,
                    size: Number.parseInt(device.size, 10) || 0,
                    model: device.model?.trim() || null,
                    serial: device.serial?.trim() || null,
                    rotational: device.rota === true || device.rota === "1",
                    partitions: [],
                };
                for (const child of device.children || []) {
                    if (child.type !== "part") continue;
                    const devPath = `/dev/${child.name}`;
                    const usage = usageMap[devPath] || {};
                    disk.partitions.push({
                        name: child.name,
                        size: Number.parseInt(child.size, 10) || 0,
                        mountPoint: child.mountpoint || usage.mountPoint || null,
                        type: usage.type || null,
                        used: usage.used || 0,
                        available: usage.available || 0,
                        usagePercent: usage.usagePercent || 0,
                    });
                }
                if (disk.partitions.length > 0 || device.mountpoint) {
                    if (device.mountpoint && disk.partitions.length === 0) {
                        const devPath = `/dev/${device.name}`;
                        const usage = usageMap[devPath] || {};
                        disk.partitions.push({
                            name: device.name,
                            size: Number.parseInt(device.size, 10) || 0,
                            mountPoint: device.mountpoint || usage.mountPoint || null,
                            type: usage.type || null,
                            used: usage.used || 0,
                            available: usage.available || 0,
                            usagePercent: usage.usagePercent || 0,
                        });
                    }
                    disks.push(disk);
                }
            }
        } catch {
            return Object.values(usageMap).map(u => ({
                name: u.filesystem.replace("/dev/", ""),
                size: u.size,
                model: null,
                serial: null,
                rotational: null,
                partitions: [{
                    name: u.filesystem.replace("/dev/", ""),
                    size: u.size,
                    mountPoint: u.mountPoint,
                    type: u.type,
                    used: u.used,
                    available: u.available,
                    usagePercent: u.usagePercent,
                }],
            }));
        }
        return disks;
    } catch { return []; }
};

const getUptime = async (execCmd) => {
    try { return Math.floor(Number.parseFloat((await execCmd("cat /proc/uptime")).split(" ")[0])); }
    catch { return null; }
};

const getLoadAverage = async (execCmd) => {
    try { return (await execCmd("cat /proc/loadavg")).split(" ").slice(0, 3).map(parseFloat); }
    catch { return null; }
};

const getProcessCount = async (execCmd) => {
    try { return Number.parseInt(await execCmd("ps -e --no-headers | wc -l")); }
    catch { return null; }
};

const getProcessList = async (execCmd) => {
    try {
        return (await execCmd("ps aux --sort=-%cpu | head -51")).split("\n").slice(1, 51)
            .filter(Boolean).map(line => {
                const p = line.trim().split(/\s+/);
                return p.length >= 11 ? {
                    user: p[0], pid: Number.parseInt(p[1]), cpu: Number.parseFloat(p[2]), mem: Number.parseFloat(p[3]),
                    vsz: Number.parseInt(p[4]), rss: Number.parseInt(p[5]), tty: p[6], stat: p[7],
                    start: p[8], time: p[9], command: p.slice(10).join(" ")
                } : null;
            }).filter(Boolean);
    } catch { return []; }
};

const getOSInfo = async (execCmd) => {
    try {
        const [osRelease, kernel, arch, hostname] = await Promise.all([
            execCmd("cat /etc/os-release").catch(() => ""),
            execCmd("uname -r").catch(() => ""),
            execCmd("uname -m").catch(() => ""),
            execCmd("hostname").catch(() => ""),
        ]);
        const info = { kernel, architecture: arch, hostname: hostname.trim() };
        osRelease.split("\n").forEach(line => {
            if (line.startsWith("NAME=")) info.name = line.split("=")[1].replaceAll('"', "");
            if (line.startsWith("VERSION=")) info.version = line.split("=")[1].replaceAll('"', "");
        });
        return info;
    } catch { return {}; }
};

const getNetworkInterfaces = async (execCmd) => {
    try {
        const [procNetDev, ipOutput] = await Promise.all([
            execCmd("cat /proc/net/dev"),
            execCmd("ip -o addr show").catch(() => ""),
        ]);
        
        const trafficMap = {};
        for (const line of procNetDev.split("\n").slice(2).filter(Boolean)) {
            const match = line.match(/^\s*([^:]+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
            if (match && match[1] !== "lo") {
                trafficMap[match[1].trim()] = { rxBytes: Number.parseInt(match[2], 10) || 0, txBytes: Number.parseInt(match[3], 10) || 0 };
            }
        }
        
        const ifaceMap = {};
        for (const line of ipOutput.split("\n").filter(Boolean)) {
            const match = line.match(/^\d+:\s+(\S+)\s+inet6?\s+(\S+)/);
            if (match) {
                const name = match[1].replace(/@.*$/, "");
                if (name === "lo") continue;
                if (!ifaceMap[name]) ifaceMap[name] = { name, ipv4: [], ipv6: [], ...trafficMap[name] };
                const addr = match[2];
                if (addr.includes(":")) ifaceMap[name].ipv6.push(addr);
                else ifaceMap[name].ipv4.push(addr);
            }
        }
        
        for (const name of Object.keys(trafficMap)) {
            if (!ifaceMap[name]) ifaceMap[name] = { name, ipv4: [], ipv6: [], ...trafficMap[name] };
        }
        
        const interfaces = Object.values(ifaceMap);
        
        await Promise.all(interfaces.map(async (iface) => {
            try {
                const [mac, state, mtu, speed] = await Promise.all([
                    execCmd(`cat /sys/class/net/${iface.name}/address`).catch(() => ""),
                    execCmd(`cat /sys/class/net/${iface.name}/operstate`).catch(() => ""),
                    execCmd(`cat /sys/class/net/${iface.name}/mtu`).catch(() => ""),
                    execCmd(`cat /sys/class/net/${iface.name}/speed`).catch(() => ""),
                ]);
                iface.mac = mac.trim() || null;
                iface.state = state.trim() || null;
                iface.mtu = Number.parseInt(mtu.trim(), 10) || null;
                iface.speed = Number.parseInt(speed.trim(), 10) || null;
            } catch {}
        }));
        
        return interfaces;
    } catch (error) {
        logger.error("Error getting network interfaces", { error: error.message });
        return [];
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

module.exports = { start, stop };
