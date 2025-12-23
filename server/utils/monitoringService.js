const { Client } = require("ssh2");
const logger = require("./logger");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");
const { createSSH } = require("./createSSH");
const { getIdentityCredentials } = require("../controllers/identity");
const { getMonitoringSettingsInternal } = require("../controllers/monitoring");

let monitoringInterval = null;
let isRunning = false;
let currentSettings = null;

const start = async () => {
    if (isRunning) return;
    isRunning = true;

    currentSettings = await getMonitoringSettingsInternal();
    const interval = currentSettings?.monitoringInterval ? currentSettings.monitoringInterval * 1000 : 60000;
    
    logger.system(`Starting monitoring service`, { interval });
    
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

const collectServerData = async (entry, identity) => {
    return new Promise((resolve) => {
        const conn = new Client();
        let data = { status: "offline", timestamp: new Date() };

        const timeout = setTimeout(() => {
            conn.end();
            conn._jumpConnections?.forEach(c => c.ssh.end());
            resolve({ ...data, errorMessage: "Connection timeout" });
        }, 30000);

        conn.on("ready", async () => {
            clearTimeout(timeout);
            try {
                const [cpu, mem, uptime, load, processes] = await Promise.all([
                    getCPUUsage(conn), getMemoryUsage(conn), getUptime(conn), getLoadAverage(conn), getProcessCount(conn)
                ]);
                const [disk, os, network] = await Promise.all([getDiskUsage(conn), getOSInfo(conn), getNetworkInterfaces(conn)]);
                const processList = await getProcessList(conn);
                
                data = {
                    status: "online", timestamp: new Date(), cpuUsage: cpu,
                    memoryUsage: mem.usage, memoryTotal: mem.total, disk, uptime,
                    loadAverage: load, processes, processList, osInfo: os, network
                };
            } catch (error) {
                logger.error("Error during data collection", { error: error.message });
                data = { ...data, status: "error", errorMessage: error.message };
            }
            conn.end();
            conn._jumpConnections?.forEach(c => c.ssh.end());
            resolve(data);
        });

        conn.on("error", (err) => {
            clearTimeout(timeout);
            conn._jumpConnections?.forEach(c => c.ssh.end());
            resolve({ ...data, status: "offline", errorMessage: err.message });
        });

        createSSH(entry, identity).then(({ ssh, sshOptions }) => {
            if (ssh._jumpConnections) conn._jumpConnections = ssh._jumpConnections;
            conn.connect(sshOptions);
        }).catch((error) => {
            clearTimeout(timeout);
            resolve({ ...data, status: "error", errorMessage: error.message });
        });
    });
};

const executeCommand = (conn, cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let output = "";
        stream.on("data", d => output += d.toString());
        stream.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(`Command failed: ${code}`)));
    });
});

const getCPUUsage = async (conn) => {
    try {
        const output = await executeCommand(conn, "grep 'cpu ' /proc/stat");
        const vals = output.split(" ").filter(Boolean).slice(1).map(Number);
        return Math.round(((vals.reduce((a, b) => a + b, 0) - vals[3]) / vals.reduce((a, b) => a + b, 0)) * 100);
    } catch { return null; }
};

const getMemoryUsage = async (conn) => {
    try {
        const lines = (await executeCommand(conn, "free -b")).split("\n");
        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1]), available = parseInt(parts[6] || parts[3]);
        return { usage: Math.round(((total - available) / total) * 100), total };
    } catch { return { usage: null, total: null }; }
};

const getDiskUsage = async (conn) => {
    try {
        const [lsblkOutput, dfOutput] = await Promise.all([
            executeCommand(conn, "lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT -J").catch(() => ""),
            executeCommand(conn, "df -B1 --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'").catch(() => ""),
        ]);

        const usageMap = {};
        for (const line of dfOutput.split("\n").filter(Boolean)) {
            const p = line.trim().split(/\s+/);
            usageMap[p[0]] = {
                filesystem: p[0],
                type: p[1],
                size: parseInt(p[2], 10) || 0,
                used: parseInt(p[3], 10) || 0,
                available: parseInt(p[4], 10) || 0,
                usagePercent: parseInt(p[5], 10) || 0,
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
                    size: parseInt(device.size, 10) || 0,
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
                        size: parseInt(child.size, 10) || 0,
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
                            size: parseInt(device.size, 10) || 0,
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

const getUptime = async (conn) => {
    try { return Math.floor(parseFloat((await executeCommand(conn, "cat /proc/uptime")).split(" ")[0])); }
    catch { return null; }
};

const getLoadAverage = async (conn) => {
    try { return (await executeCommand(conn, "cat /proc/loadavg")).split(" ").slice(0, 3).map(parseFloat); }
    catch { return null; }
};

const getProcessCount = async (conn) => {
    try { return parseInt(await executeCommand(conn, "ps -e --no-headers | wc -l")); }
    catch { return null; }
};

const getProcessList = async (conn) => {
    try {
        return (await executeCommand(conn, "ps aux --sort=-%cpu | head -51")).split("\n").slice(1, 51)
            .filter(Boolean).map(line => {
                const p = line.trim().split(/\s+/);
                return p.length >= 11 ? {
                    user: p[0], pid: parseInt(p[1]), cpu: parseFloat(p[2]), mem: parseFloat(p[3]),
                    vsz: parseInt(p[4]), rss: parseInt(p[5]), tty: p[6], stat: p[7],
                    start: p[8], time: p[9], command: p.slice(10).join(" ")
                } : null;
            }).filter(Boolean);
    } catch { return []; }
};

const getOSInfo = async (conn) => {
    try {
        const [osRelease, kernel, arch, hostname] = await Promise.all([
            executeCommand(conn, "cat /etc/os-release").catch(() => ""),
            executeCommand(conn, "uname -r").catch(() => ""),
            executeCommand(conn, "uname -m").catch(() => ""),
            executeCommand(conn, "hostname").catch(() => ""),
        ]);
        const info = { kernel, architecture: arch, hostname: hostname.trim() };
        osRelease.split("\n").forEach(line => {
            if (line.startsWith("NAME=")) info.name = line.split("=")[1].replace(/"/g, "");
            if (line.startsWith("VERSION=")) info.version = line.split("=")[1].replace(/"/g, "");
        });
        return info;
    } catch { return {}; }
};

const getNetworkInterfaces = async (conn) => {
    try {
        const [procNetDev, ipOutput] = await Promise.all([
            executeCommand(conn, "cat /proc/net/dev"),
            executeCommand(conn, "ip -o addr show").catch(() => ""),
        ]);
        
        const trafficMap = {};
        for (const line of procNetDev.split("\n").slice(2).filter(Boolean)) {
            const match = line.match(/^\s*([^:]+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
            if (match && match[1] !== "lo") {
                trafficMap[match[1].trim()] = { rxBytes: parseInt(match[2], 10) || 0, txBytes: parseInt(match[3], 10) || 0 };
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
                    executeCommand(conn, `cat /sys/class/net/${iface.name}/address`).catch(() => ""),
                    executeCommand(conn, `cat /sys/class/net/${iface.name}/operstate`).catch(() => ""),
                    executeCommand(conn, `cat /sys/class/net/${iface.name}/mtu`).catch(() => ""),
                    executeCommand(conn, `cat /sys/class/net/${iface.name}/speed`).catch(() => ""),
                ]);
                iface.mac = mac.trim() || null;
                iface.state = state.trim() || null;
                iface.mtu = parseInt(mtu.trim(), 10) || null;
                iface.speed = parseInt(speed.trim(), 10) || null;
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
            cpuUsage: data.cpuUsage != null ? Math.round(data.cpuUsage) : null,
            memoryUsage: data.memoryUsage != null ? Math.round(data.memoryUsage) : null,
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

module.exports = {
    start, stop, runMonitoring, monitorEntry, collectServerData, executeCommand,
    getCPUUsage, getMemoryUsage, getDiskUsage, getUptime, getLoadAverage,
    getProcessCount, getProcessList, getOSInfo, getNetworkInterfaces, saveMonitoringData, cleanupOldData,
    MonitoringSnapshot: require("../models/MonitoringSnapshot"),
};
