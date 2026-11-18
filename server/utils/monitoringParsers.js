const { parseCPUUsage } = require("./cpuUsage");

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

const WINDOWS_OS_COMMAND = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(
    "$os = Get-CimInstance Win32_OperatingSystem; Write-Output ($os.Caption + '|' + $os.Version)",
    "utf16le",
).toString("base64")}`;

const COMMANDS = {
    cpu: "grep 'cpu ' /proc/stat; sleep 1; grep 'cpu ' /proc/stat",
    memory: "cat /proc/meminfo",
    memoryFallback: "LC_ALL=C free -b",
    uptime: "cat /proc/uptime",
    loadAverage: "cat /proc/loadavg",
    processCount: "LC_ALL=C ps -e --no-headers | wc -l",
    processList: "LC_ALL=C ps aux --sort=-%cpu | head -51",
    lsblk: "LC_ALL=C lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT,FSTYPE -J",
    df: "LC_ALL=C df -B1 --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'",
    dfInodes: "LC_ALL=C df --output=source,itotal,iused,ipcent,target | grep -E '^/dev'",
    smart: SMART_CMD,
    osRelease: "cat /etc/os-release",
    windowsOS: WINDOWS_OS_COMMAND,
    kernel: "uname -r",
    arch: "uname -m",
    hostname: "hostname",
    ipAddr: "LC_ALL=C ip -o addr show",
    ifaceDetails: IFACE_DETAIL_CMD,
    defaultRoute: "ip route show default 2>/dev/null | head -1",
};

const toInt = (value) => Number.parseInt(value, 10) || 0;

const parseMeminfo = (output) => {
    try {
        if (!output) return { usage: null, total: null };
        const getKb = (key) => {
            const m = output.match(new RegExp("^\\s*" + key + ":\\s+(\\d+)\\s*kB", "m"));
            return m ? Number.parseInt(m[1], 10) : null;
        };
        const totalKb = getKb("MemTotal");
        if (totalKb == null || !(totalKb > 0)) return { usage: null, total: null };
        const total = totalKb * 1024;
        let availableKb = getKb("MemAvailable");
        if (availableKb == null) {
            const free = getKb("MemFree") || 0;
            const buffers = getKb("Buffers") || 0;
            const cached = getKb("Cached") || 0;
            const reclaimable = getKb("SReclaimable") || 0;
            const sum = free + buffers + cached + reclaimable;
            availableKb = sum > 0 ? sum : null;
        }
        if (availableKb == null) return { usage: null, total };
        return { usage: Math.round(((total - availableKb * 1024) / total) * 100), total };
    } catch { return { usage: null, total: null }; }
};

const parseMemoryUsage = (output) => {
    try {
        if (!output) return { usage: null, total: null };
        const line = output.split("\n").find((l) => /^\s*(Mem|Speicher):/.test(l));
        if (!line) return { usage: null, total: null };
        const numbers = (line.match(/\d+/g) || []).map(Number);
        if (numbers.length < 3) return { usage: null, total: null };
        const total = numbers[0];
        const available = numbers.length >= 6 ? numbers[5] : numbers[2];
        if (!(total > 0) || available == null || !Number.isFinite(available)) return { usage: null, total: null };
        return { usage: Math.round(((total - available) / total) * 100), total };
    } catch { return { usage: null, total: null }; }
};

const isRealMount = (mountPoint) => !!mountPoint && mountPoint.startsWith("/");

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
    try {
        if (!output) return null;
        const secs = Math.floor(Number.parseFloat(String(output).split(" ")[0]));
        return Number.isFinite(secs) ? secs : null;
    }
    catch { return null; }
};

const parseLoadAverage = (output) => {
    try {
        if (!output) return null;
        const vals = String(output).split(/\s+/).filter(Boolean).slice(0, 3).map(Number);
        if (vals.length < 3 || vals.some((v) => !Number.isFinite(v))) return null;
        return vals;
    }
    catch { return null; }
};

const parseProcessCount = (output) => {
    try {
        if (output == null) return null;
        const n = Number.parseInt(String(output).trim(), 10);
        return Number.isFinite(n) ? n : null;
    }
    catch { return null; }
};

const parseProcessList = (output) => {
    try {
        return output.split("\n").slice(1, 51)
            .filter(Boolean).map(line => {
                const p = line.trim().split(/\s+/);
                return p.length >= 11 ? {
                    user: p[0], pid: Number.parseInt(p[1]), cpu: Number.parseFloat(String(p[2]).replace(",", ".")), mem: Number.parseFloat(String(p[3]).replace(",", ".")),
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
            if (line.startsWith("NAME=")) info.name = line.slice(5).replaceAll('"', "");
            if (line.startsWith("VERSION=")) info.version = line.slice(8).replaceAll('"', "");
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
        for (const line of String(ifaceDetails || "").split("\n").filter(Boolean)) {
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

        for (const line of String(ipOutput || "").split("\n").filter(Boolean)) {
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
    } catch { return []; }
};

module.exports = { IFACE_DETAIL_CMD, WINDOWS_OS_COMMAND, COMMANDS, parseCPUUsage, applyNetworkRates, parseMeminfo, parseMemoryUsage, parseDiskUsage, parseInodeUsage, parseSmartHealth, parseUptime, parseLoadAverage, parseProcessCount, parseProcessList, parseOSInfo, parseNetworkInterfaces };
