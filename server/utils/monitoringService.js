const { Client } = require("ssh2");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const MonitoringData = require("../models/MonitoringData");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");
const { createSSH } = require("./createSSH");
const { getIdentityCredentials } = require("../controllers/identity");

let monitoringInterval = null;
let isRunning = false;

const start = () => {
    if (isRunning) return;
    isRunning = true;

    runMonitoring();
    monitoringInterval = setInterval(() => {
        runMonitoring();
    }, 60000);
};

const stop = () => {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    isRunning = false;
};

const runMonitoring = async () => {
    try {
        const entries = await Entry.findAll({ where: { type: "server" } });
        const monitoringEntries = entries.filter(e => e.config?.protocol === "ssh" && e.config?.monitoringEnabled);
        
        if (monitoringEntries.length === 0) return;

        const monitoringPromises = monitoringEntries.map(entry => monitorEntry(entry));
        await Promise.allSettled(monitoringPromises);
    } catch (error) {
        console.error("Error running monitoring:", error);
    }
};

const monitorEntry = async (entry) => {
    try {
        const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });

        if (!entryIdentities || entryIdentities.length === 0) {
            await saveMonitoringData(entry.id, {
                status: "error",
                errorMessage: "No identities configured",
            });
            return;
        }

        const identities = await Identity.findAll({ where: { id: entryIdentities.map(ei => ei.identityId) } });

        if (!identities || identities.length === 0) {
            await saveMonitoringData(entry.id, {
                status: "error",
                errorMessage: "No valid identities found",
            });
            return;
        }

        const identity = identities[0];
        const credentials = await getIdentityCredentials(identity.id);
        const monitoringData = await collectServerData(entry, identity, credentials);
        await saveMonitoringData(entry.id, monitoringData);
    } catch (error) {
        console.error(`Error monitoring entry ${entry.name}:`, error);
        await saveMonitoringData(entry.id, {
            status: "error",
            errorMessage: error.message,
        });
    }
};

const collectServerData = async (entry, identity, credentials) => {
    return new Promise((resolve) => {
        const conn = new Client();
        let monitoringData = {
            status: "offline",
            timestamp: new Date(),
        };

        const timeout = setTimeout(() => {
            conn.end();
            if (conn._jumpConnections) conn._jumpConnections.forEach(c => c.ssh.end());
            resolve({ ...monitoringData, errorMessage: "Connection timeout" });
        }, 30000);

        conn.on("ready", async () => {
            clearTimeout(timeout);

            try {
                monitoringData.status = "online";

                const [cpuData, memoryData, diskData, uptimeData, loadData, processData, osData, networkData] = await Promise.all([
                    getCPUUsage(conn),
                    getMemoryUsage(conn),
                    getDiskUsage(conn),
                    getUptime(conn),
                    getLoadAverage(conn),
                    getProcessCount(conn),
                    getOSInfo(conn),
                    getNetworkInterfaces(conn),
                ]);

                monitoringData = {
                    ...monitoringData,
                    cpuUsage: cpuData,
                    memoryUsage: memoryData.usage,
                    memoryTotal: memoryData.total,
                    disk: diskData,
                    uptime: uptimeData,
                    loadAverage: loadData,
                    processes: processData,
                    osInfo: osData,
                    network: networkData,
                };
            } catch (error) {
                monitoringData.status = "error";
                monitoringData.errorMessage = error.message;
            }

            conn.end();
            if (conn._jumpConnections) conn._jumpConnections.forEach(c => c.ssh.end());
            resolve(monitoringData);
        });

        conn.on("error", (err) => {
            clearTimeout(timeout);
            if (conn._jumpConnections) conn._jumpConnections.forEach(c => c.ssh.end());
            resolve({ ...monitoringData, status: "offline", errorMessage: err.message });
        });
        
        createSSH(entry, identity).then(({ ssh, sshOptions }) => {
            if (ssh._jumpConnections) {
                conn._jumpConnections = ssh._jumpConnections;
            }
            conn.connect(sshOptions);
        }).catch((error) => {
            clearTimeout(timeout);
            resolve({ ...monitoringData, status: "error", errorMessage: error.message });
        });
    });
};

const executeCommand = (conn, command) => {
    return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
            if (err) return reject(err);

            let output = "";
            stream.on("data", (data) => {
                output += data.toString();
            });

            stream.on("close", (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
        });
    });
};

const getCPUUsage = async (conn) => {
    try {
        const output = await executeCommand(conn, "grep 'cpu ' /proc/stat");
        const values = output.split(" ").filter(x => x).slice(1).map(Number);
        const idle = values[3];
        const total = values.reduce((a, b) => a + b, 0);
        return Math.round(((total - idle) / total) * 100 * 100) / 100;
    } catch (error) {
        return null;
    }
};

const getMemoryUsage = async (conn) => {
    try {
        const output = await executeCommand(conn, "free -b");
        const lines = output.split("\n");
        const memLine = lines[1].split(/\s+/);
        const total = parseInt(memLine[1]);
        const available = parseInt(memLine[6] || memLine[3]);
        const used = total - available;
        return {
            usage: Math.round((used / total) * 100 * 100) / 100,
            total: total,
        };
    } catch (error) {
        return { usage: null, total: null };
    }
};

const getDiskUsage = async (conn) => {
    try {
        const output = await executeCommand(conn, "df -h --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'");
        const lines = output.split("\n").filter(line => line.trim());

        return lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                filesystem: parts[0],
                type: parts[1],
                size: parts[2],
                used: parts[3],
                available: parts[4],
                usagePercent: parseInt(parts[5].replace("%", "")),
                mountPoint: parts[6],
            };
        });
    } catch (error) {
        return [];
    }
};

const getUptime = async (conn) => {
    try {
        const output = await executeCommand(conn, "cat /proc/uptime");
        return Math.floor(parseFloat(output.split(" ")[0]));
    } catch (error) {
        return null;
    }
};

const getLoadAverage = async (conn) => {
    try {
        const output = await executeCommand(conn, "cat /proc/loadavg");
        return output.split(" ").slice(0, 3).map(parseFloat);
    } catch (error) {
        return null;
    }
};

const getProcessCount = async (conn) => {
    try {
        const output = await executeCommand(conn, "ps -e --no-headers | wc -l");
        return parseInt(output);
    } catch (error) {
        return null;
    }
};

const getOSInfo = async (conn) => {
    try {
        const [osRelease, kernel, arch] = await Promise.all([
            executeCommand(conn, "cat /etc/os-release").catch(() => ""),
            executeCommand(conn, "uname -r").catch(() => ""),
            executeCommand(conn, "uname -m").catch(() => ""),
        ]);

        const osInfo = {};

        if (osRelease) {
            const lines = osRelease.split("\n");
            lines.forEach(line => {
                if (line.includes("NAME=")) {
                    osInfo.name = line.split("=")[1].replace(/"/g, "");
                } else if (line.includes("VERSION=")) {
                    osInfo.version = line.split("=")[1].replace(/"/g, "");
                }
            });
        }

        osInfo.kernel = kernel;
        osInfo.architecture = arch;

        return osInfo;
    } catch (error) {
        return {};
    }
};

const getNetworkInterfaces = async (conn) => {
    try {
        const output = await executeCommand(conn, "ip -s link show | grep -E '^[0-9]+:' -A 1");
        const interfaces = [];
        const lines = output.split("\n");

        for (let i = 0; i < lines.length; i += 2) {
            if (lines[i] && lines[i + 1]) {
                const interfaceLine = lines[i];
                const statsLine = lines[i + 1];

                const interfaceMatch = interfaceLine.match(/^\d+:\s+([^:]+):/);
                if (interfaceMatch) {
                    const name = interfaceMatch[1];
                    const stats = statsLine.trim().split(/\s+/);

                    if (stats.length >= 2) {
                        interfaces.push({
                            name: name,
                            rxBytes: parseInt(stats[0]) || 0,
                            txBytes: parseInt(stats[8]) || 0,
                        });
                    }
                }
            }
        }

        return interfaces;
    } catch (error) {
        return [];
    }
};

const saveMonitoringData = async (entryId, data) => {
    try {
        await MonitoringData.create({ entryId: entryId, ...data });
    } catch (error) {
        console.error(`Error saving monitoring data for entry ${entryId}:`, error);
    }
};

const cleanupOldData = async () => {
    try {
        const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await MonitoringData.destroy({
            where: {
                timestamp: {
                    [Op.lt]: cutoffDate,
                },
            },
        });
    } catch (error) {
        console.error("Error cleaning up old monitoring data:", error);
    }
};

setInterval(() => {
    cleanupOldData();
}, 60 * 60 * 1000);

module.exports = {
    start, stop, runMonitoring, monitorEntry, collectServerData, executeCommand, getCPUUsage,
    getMemoryUsage, getDiskUsage, getUptime, getLoadAverage, getProcessCount, getOSInfo, getNetworkInterfaces,
    saveMonitoringData, cleanupOldData,
};