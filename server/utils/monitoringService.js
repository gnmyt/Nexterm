const logger = require("./logger");
const Entry = require("../models/Entry");
const MonitoringData = require("../models/MonitoringData");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");
const { getIdentityCredentials } = require("../controllers/identity");
const { getMonitoringSettingsInternal } = require("../controllers/monitoring");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { buildSSHParams, resolveJumpHosts, resolveTrust } = require("../lib/ConnectionService");
const hostTrust = require("./hostTrust");
const { getEffectiveEntryConfig, getEntryIdentityIds } = require("./folderInheritance");
const { parseCPUUsage } = require("./cpuUsage");

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
        const cache = new Map();
        const toMonitor = await Promise.all(entries.map(async (entry) => ({ entry, config: await getEffectiveEntryConfig(entry, { cache }) })));
        const configuredEntries = toMonitor.filter(({ config }) => config.protocol === "ssh" && config.monitoringEnabled);
        if (configuredEntries.length) await Promise.allSettled(configuredEntries.map(({ entry, config }) => monitorEntry(entry, config, cache)));
    } catch (error) {
        logger.error("Error running monitoring", { error: error.message });
    }
};

const monitorEntry = async (entry, config, cache) => {
    try {
        const identityIds = await getEntryIdentityIds(entry, {
            cache,
            sharedOnly: true,
            organizationId: entry.organizationId,
            ownerAccountId: entry.accountId,
        });
        if (!identityIds.length) return saveMonitoringData(entry.id, { status: "error", errorMessage: "No identities configured" });

        const identities = await Identity.findAll({ where: { id: identityIds } });
        if (!identities?.length) return saveMonitoringData(entry.id, { status: "error", errorMessage: "No valid identities found" });

        const credentials = await getIdentityCredentials(identities[0].id);
        const data = await collectServerData({ ...entry, config }, identities[0], credentials);
        await saveMonitoringData(entry.id, data);
    } catch (error) {
        logger.error("Error monitoring entry", { entryId: entry.id, error: error.message });
        await saveMonitoringData(entry.id, { status: "error", errorMessage: error.message });
    }
};

const IFACE_FILES = [
    "address", "operstate", "mtu", "speed",
    "statistics/rx_bytes", "statistics/tx_bytes", "statistics/rx_errors", "statistics/tx_errors",
    "statistics/rx_dropped", "statistics/tx_dropped", "type",
];

const IFACE_FIELDS = [
    '"$n"',
    ...IFACE_FILES.map(file => `"$(cat "$d/${file}" 2>/dev/null)"`),
    '"$([ -e "$d/device" ] && echo 1)"',
    '"$([ -d "$d/bridge" ] && echo 1)"',
];

const IFACE_DETAIL_CMD = 'for d in /sys/class/net/*; do n=$(basename "$d"); ' +
    `printf "${IFACE_FIELDS.map(() => "%s").join("\\t")}\\n" ${IFACE_FIELDS.join(" ")}; done`;

const SMART_CMD = "PATH=\"$PATH:/usr/sbin:/sbin\"; if command -v smartctl >/dev/null 2>&1; then " +
    "for d in $(lsblk -dn -o NAME,TYPE | awk '$2==\"disk\"{print $1}'); do " +
    "echo \"###SMART $d\"; smartctl -n standby -H -A -j \"/dev/$d\" 2>/dev/null; echo; done; fi";

const COMMANDS = {
    cpu: "grep 'cpu ' /proc/stat; sleep 1; grep 'cpu ' /proc/stat",
    memory: "cat /proc/meminfo",
    uptime: "cat /proc/uptime",
    loadAverage: "cat /proc/loadavg",
    processCount: "ps -e --no-headers | wc -l",
    processList: "ps aux --sort=-%cpu | head -51",
    lsblk: "lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT,FSTYPE -J",
    df: "df -B1 --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'",
    dfInodes: "df --output=source,itotal,iused,ipcent,target | grep -E '^/dev'",
    smart: SMART_CMD,
    osRelease: "cat /etc/os-release",
    kernel: "uname -r",
    arch: "uname -m",
    hostname: "hostname",
    ipAddr: "ip -o addr show",
    ifaceDetails: IFACE_DETAIL_CMD,
    defaultRoute: "ip route show default 2>/dev/null | head -1",
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
    const jumpHosts = await resolveJumpHosts(entry, null, {
        sharedOnly: true,
        organizationId: entry.organizationId,
        ownerAccountId: entry.accountId,
    });

    try {
        const commands = Object.entries(COMMANDS).map(([id, command]) => ({ id, command }));
        const trust = await resolveTrust(entry, hostTrust.KIND.SSH, host, port, jumpHosts);
        const batch = await controlPlane.execCommandBatch(host, port, { ...params, ...trust.params }, commands, jumpHosts);
        if (batch.untrustedPeer) {
            return {
                status: "error",
                timestamp: new Date(),
                errorMessage: hostTrust.unattendedMessage(batch.untrustedPeer),
            };
        }
        if (!batch.success) {
            throw new Error(batch.errorMessage || "Failed to connect to SSH host");
        }

        const out = {};
        for (const r of batch.results || []) {
            out[r.id] = r.success ? (r.stdout || "").trim() : "";
        }

        const memory = parseMemoryUsage(out.memory);
        return {
            status: "online",
            timestamp: new Date(),
            cpuUsage: parseCPUUsage(out.cpu),
            memoryUsage: memory.usage,
            memoryTotal: memory.total,
            memory: memory.breakdown,
            disk: parseDiskUsage(out.lsblk, out.df, out.dfInodes, out.smart),
            uptime: parseUptime(out.uptime),
            loadAverage: parseLoadAverage(out.loadAverage),
            processes: parseProcessCount(out.processCount),
            processList: parseProcessList(out.processList),
            osInfo: parseOSInfo(out.osRelease, out.kernel, out.arch, out.hostname),
            network: parseNetworkInterfaces(out.ifaceDetails, out.ipAddr, out.defaultRoute),
        };
    } catch (error) {
        logger.error("Error during monitoring data collection", { error: error.message, host });
        return { status: "offline", timestamp: new Date(), errorMessage: error.message };
    }
};

const EMPTY_MEMORY = { usage: null, total: null, breakdown: null };

const parseMemoryUsage = (output) => {
    const kb = {};
    for (const line of (output || "").split("\n")) {
        const match = /^(\w+):\s+(\d+)/.exec(line);
        if (match) kb[match[1]] = Number.parseInt(match[2], 10);
    }

    const total = kb.MemTotal * 1024;
    if (!total) return EMPTY_MEMORY;

    const free = (kb.MemFree || 0) * 1024;
    const reclaimable = ((kb.Buffers || 0) + (kb.Cached || 0) + (kb.SReclaimable || 0)) * 1024;
    const available = Math.min(total, kb.MemAvailable == null ? free + reclaimable : kb.MemAvailable * 1024);
    const used = total - available;

    return {
        usage: Math.round((used / total) * 100),
        total,
        breakdown: { total, used, cache: Math.max(0, available - free), free: Math.min(free, available) },
    };
};

const isRealMount = (mountPoint) => !!mountPoint && mountPoint.startsWith("/");

const toInt = (value) => Number.parseInt(value, 10) || 0;

const toVolume = ({ name, size, mountPoint, type, partition, partitionSize }, usage) => ({
    name,
    size,
    mountPoint,
    type,
    used: usage.used || 0,
    available: usage.available || 0,
    usagePercent: usage.usagePercent || 0,
    mounted: isRealMount(mountPoint),
    inodesTotal: usage.inodesTotal ?? null,
    inodesUsed: usage.inodesUsed ?? null,
    inodesPercent: usage.inodesPercent ?? null,
    partition,
    partitionSize,
});

const collectVolumes = (node, findUsage, partition = null, layers = []) => {
    const children = node.children || [];
    if (children.length > 0 && !node.mountpoint) {
        const nextLayers = partition ? [...layers, node.type] : [];
        return children.flatMap(child => collectVolumes(child, findUsage, partition || node, nextLayers));
    }

    const usage = findUsage(node) || {};
    const root = partition || node;
    const volume = toVolume({
        name: node.name,
        size: usage.size || toInt(node.size),
        mountPoint: node.mountpoint || usage.mountPoint || null,
        type: usage.type || node.fstype || null,
        partition: root.name,
        partitionSize: toInt(root.size),
    }, usage);
    if (partition) volume.layers = [...layers, node.type].filter(Boolean);
    return [volume];
};

const parseInodeUsage = (output) => {
    const inodes = {};
    for (const line of (output || "").split("\n").filter(Boolean)) {
        const p = line.trim().split(/\s+/);
        const total = Number.parseInt(p[1], 10), used = Number.parseInt(p[2], 10);
        if (!total || Number.isNaN(used)) continue;
        inodes[p.slice(4).join(" ")] = { inodesTotal: total, inodesUsed: used, inodesPercent: Math.min(100, Math.ceil((used / total) * 100)) };
    }
    return inodes;
};

const smartAttribute = (report, id) => report.ata_smart_attributes?.table?.find(attr => attr.id === id)?.raw?.value ?? null;

const parseSmartHealth = (output) => {
    const health = {};
    for (const section of (output || "").split(/^###SMART /m).slice(1)) {
        const newline = section.indexOf("\n");
        const name = (newline === -1 ? section : section.slice(0, newline)).trim();
        let report;
        try { report = JSON.parse(section.slice(newline + 1)); } catch { continue; }

        const passed = report.smart_status?.passed;
        if (passed == null) {
            const denied = (report.smartctl?.messages || []).some(m => /permission denied/i.test(m.string || ""));
            health[name] = { status: denied ? "denied" : "unknown" };
            continue;
        }

        const nvme = report.nvme_smart_health_information_log;
        health[name] = {
            status: passed ? "passed" : "failed",
            temperature: report.temperature?.current ?? null,
            powerOnHours: report.power_on_time?.hours ?? null,
            wearPercent: nvme?.percentage_used ?? null,
            mediaErrors: nvme?.media_errors ?? null,
            reallocatedSectors: smartAttribute(report, 5),
            pendingSectors: smartAttribute(report, 197),
        };
    }
    return health;
};

const parseDiskUsage = (lsblkOutput, dfOutput, inodeOutput, smartOutput) => {
    try {
        const inodes = parseInodeUsage(inodeOutput);
        const smart = parseSmartHealth(smartOutput);
        const usageMap = {}, usageByMount = {};
        for (const line of dfOutput.split("\n").filter(Boolean)) {
            const p = line.trim().split(/\s+/);
            const usage = {
                filesystem: p[0],
                type: p[1],
                size: toInt(p[2]),
                used: toInt(p[3]),
                available: toInt(p[4]),
                usagePercent: toInt(p[5]),
                mountPoint: p.slice(6).join(" ") || "",
            };
            Object.assign(usage, inodes[usage.mountPoint]);
            usageMap[p[0]] = usage;
            if (usage.mountPoint && !usageByMount[usage.mountPoint]) usageByMount[usage.mountPoint] = usage;
        }

        const findUsage = (node) => (isRealMount(node.mountpoint) && usageByMount[node.mountpoint])
            || usageMap[`/dev/${node.name}`] || usageMap[`/dev/mapper/${node.name}`] || null;

        const disks = [];
        try {
            const lsblk = JSON.parse(lsblkOutput);
            for (const device of lsblk.blockdevices || []) {
                if (device.type !== "disk") continue;
                if (!device.children?.length && !device.mountpoint) continue;
                disks.push({
                    name: device.name,
                    size: toInt(device.size),
                    model: device.model?.trim() || null,
                    serial: device.serial?.trim() || null,
                    rotational: device.rota === true || device.rota === "1",
                    health: smart[device.name] || null,
                    partitions: device.children?.length ? device.children.flatMap(child => collectVolumes(child, findUsage)) : collectVolumes(device, findUsage),
                });
            }
        } catch {
            return Object.values(usageMap).map(usage => {
                const name = usage.filesystem.replace("/dev/", "");
                return {
                    name,
                    size: usage.size,
                    model: null,
                    serial: null,
                    rotational: null,
                    health: null,
                    partitions: [toVolume({ name, size: usage.size, mountPoint: usage.mountPoint, type: usage.type, partition: name, partitionSize: usage.size }, usage)],
                };
            });
        }
        return disks;
    } catch { return []; }
};

const parseUptime = (output) => {
    try { return Math.floor(Number.parseFloat(output.split(" ")[0])) || null; }
    catch { return null; }
};

const parseLoadAverage = (output) => {
    try { return output ? output.split(" ").slice(0, 3).map(parseFloat) : null; }
    catch { return null; }
};

const parseProcessCount = (output) => {
    try { return Number.parseInt(output) || null; }
    catch { return null; }
};

const parseProcessList = (output) => {
    try {
        return output.split("\n").slice(1, 51)
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

const parseOSInfo = (osRelease, kernel, arch, hostname) => {
    try {
        const info = { kernel, architecture: arch, hostname };
        osRelease.split("\n").forEach(line => {
            if (line.startsWith("NAME=")) info.name = line.split("=")[1].replaceAll('"', "");
            if (line.startsWith("VERSION=")) info.version = line.split("=")[1].replaceAll('"', "");
        });
        return info;
    } catch { return {}; }
};

const getInterfaceKind = (name, type, physical, bridge) => {
    if (physical) return "physical";
    if (bridge) return "bridge";
    if (name.startsWith("veth")) return "veth";
    if (type === 65534 || /^(tun|tap|wg|tailscale|zt)/.test(name)) return "tunnel";
    return "virtual";
};

const applyNetworkRates = (network, previous, previousAt) => {
    const seconds = previousAt ? (Date.now() - new Date(previousAt).getTime()) / 1000 : 0;
    if (!Array.isArray(previous) || seconds < 5 || seconds > 900) return;

    const byName = Object.fromEntries(previous.map(iface => [iface.name, iface]));
    for (const iface of network) {
        const prev = byName[iface.name];
        if (!prev || iface.rxBytes < prev.rxBytes || iface.txBytes < prev.txBytes) continue;
        iface.rxRate = Math.round((iface.rxBytes - prev.rxBytes) / seconds);
        iface.txRate = Math.round((iface.txBytes - prev.txBytes) / seconds);
        iface.recentErrors = Math.max(0, (iface.errors || 0) - (prev.errors ?? iface.errors ?? 0));
        iface.recentDropped = Math.max(0, (iface.dropped || 0) - (prev.dropped ?? iface.dropped ?? 0));
    }
};

const parseNetworkInterfaces = (ifaceDetails, ipOutput, routeOutput = "") => {
    try {
        const route = routeOutput.match(/default(?:\s+via\s+(\S+))?.*?\sdev\s+(\S+)/);
        const ifaceMap = {};
        for (const line of ifaceDetails.split("\n").filter(Boolean)) {
            const [name, mac, state, mtu, speed, rxBytes, txBytes, rxErrors, txErrors, rxDropped, txDropped, type, physical, bridge] = line.split("\t");
            if (!name || name === "lo") continue;
            const isDefault = route?.[2] === name;
            ifaceMap[name] = {
                name, ipv4: [], ipv6: [],
                rxBytes: toInt(rxBytes),
                txBytes: toInt(txBytes),
                rxRate: null,
                txRate: null,
                errors: toInt(rxErrors) + toInt(txErrors),
                dropped: toInt(rxDropped) + toInt(txDropped),
                mac: mac?.trim() || null,
                state: state?.trim() || null,
                mtu: toInt(mtu) || null,
                speed: toInt(speed) || null,
                kind: getInterfaceKind(name, Number.parseInt(type, 10), physical?.trim() === "1", bridge?.trim() === "1"),
                default: isDefault,
                gateway: isDefault ? route[1] || null : null,
            };
        }

        for (const line of ipOutput.split("\n").filter(Boolean)) {
            const match = line.match(/^\d+:\s+(\S+)\s+inet6?\s+(\S+)/);
            if (!match) continue;
            const name = match[1].replace(/@.*$/, "");
            if (name === "lo") continue;
            if (!ifaceMap[name]) ifaceMap[name] = { name, ipv4: [], ipv6: [], rxBytes: 0, txBytes: 0 };
            const addr = match[2];
            if (addr.includes(":")) ifaceMap[name].ipv6.push(addr);
            else ifaceMap[name].ipv4.push(addr);
        }

        return Object.values(ifaceMap);
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

        if (Array.isArray(data.network)) {
            const previous = await MonitoringSnapshot.findOne({ where: { entryId } });
            applyNetworkRates(data.network, previous?.network, previous?.updatedAt);
        }

        await MonitoringSnapshot.upsert({
            entryId,
            updatedAt: new Date(),
            status: data.status,
            memoryTotal: data.memoryTotal,
            memory: data.memory,
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
