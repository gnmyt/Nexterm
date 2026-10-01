const IFACE_DETAIL_CMD =
    'for d in /sys/class/net/*; do n=$(basename "$d"); ' +
    'printf "%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n" "$n" ' +
    '"$(cat "$d/address" 2>/dev/null)" ' +
    '"$(cat "$d/operstate" 2>/dev/null)" ' +
    '"$(cat "$d/mtu" 2>/dev/null)" ' +
    '"$(cat "$d/speed" 2>/dev/null)" ' +
    '"$(cat "$d/statistics/rx_bytes" 2>/dev/null)" ' +
    '"$(cat "$d/statistics/tx_bytes" 2>/dev/null)"; done';

const WINDOWS_OS_COMMAND = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(
    "$os = Get-CimInstance Win32_OperatingSystem; Write-Output ($os.Caption + '|' + $os.Version)",
    "utf16le",
).toString("base64")}`;

const COMMANDS = {
    cpu: "grep 'cpu ' /proc/stat",
    memory: "cat /proc/meminfo",
    memoryFallback: "LC_ALL=C free -b",
    uptime: "cat /proc/uptime",
    loadAverage: "cat /proc/loadavg",
    processCount: "LC_ALL=C ps -e --no-headers | wc -l",
    processList: "LC_ALL=C ps aux --sort=-%cpu | head -51",
    lsblk: "LC_ALL=C lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT -J",
    df: "LC_ALL=C df -B1 --output=source,fstype,size,used,avail,pcent,target | grep -E '^/dev'",
    osRelease: "cat /etc/os-release",
    windowsOS: WINDOWS_OS_COMMAND,
    kernel: "uname -r",
    arch: "uname -m",
    hostname: "hostname",
    ipAddr: "LC_ALL=C ip -o addr show",
    ifaceDetails: IFACE_DETAIL_CMD,
};

const parseCPUUsage = (output) => {
    try {
        const vals = String(output || "").split(" ").filter(Boolean).slice(1).map(Number);
        const total = vals.reduce((a, b) => a + b, 0);
        if (!vals.length || !(total > 0) || !Number.isFinite(vals[3])) return null;
        const result = Math.round(((total - vals[3]) / total) * 100);
        return Number.isFinite(result) ? result : null;
    } catch { return null; }
};

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

const parseDiskUsage = (lsblkOutput, dfOutput) => {
    try {
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

const parseNetworkInterfaces = (ifaceDetails, ipOutput) => {
    try {
        const ifaceMap = {};
        for (const line of String(ifaceDetails || "").split("\n").filter(Boolean)) {
            const [name, mac, state, mtu, speed, rxBytes, txBytes] = line.split("\t");
            if (!name || name === "lo") continue;
            ifaceMap[name] = {
                name, ipv4: [], ipv6: [],
                rxBytes: Number.parseInt(rxBytes, 10) || 0,
                txBytes: Number.parseInt(txBytes, 10) || 0,
                mac: mac?.trim() || null,
                state: state?.trim() || null,
                mtu: Number.parseInt(mtu, 10) || null,
                speed: Number.parseInt(speed, 10) || null,
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

module.exports = { IFACE_DETAIL_CMD, WINDOWS_OS_COMMAND, COMMANDS, parseCPUUsage, parseMeminfo, parseMemoryUsage, parseDiskUsage, parseUptime, parseLoadAverage, parseProcessCount, parseProcessList, parseOSInfo, parseNetworkInterfaces };
