const test = require("node:test");
const assert = require("node:assert/strict");
const {
    parseMeminfo,
    parseMemoryUsage,
    parseProcessList,
    parseCPUUsage,
    parseDiskUsage,
    parseUptime,
    parseLoadAverage,
    parseProcessCount,
    parseOSInfo,
    parseNetworkInterfaces,
    COMMANDS,
} = require("./monitoringParsers");

const MEMINFO_FULL = [
    "MemTotal:       16137628 kB",
    "MemFree:        13383808 kB",
    "MemAvailable:   14520188 kB",
    "Buffers:          123456 kB",
    "Cached:          1378944 kB",
    "SwapCached:            0 kB",
    "Active:          1000044 kB",
    "SwapTotal:      16137628 kB",
    "SwapFree:       16137628 kB",
].join("\n");

const MEMINFO_NO_AVAILABLE = [
    "MemTotal:       16137628 kB",
    "MemFree:        12817788 kB",
    "Buffers:          123456 kB",
    "Cached:          1378944 kB",
    "SReclaimable:     200000 kB",
].join("\n");

const FREE_EN = [
    "               total        used        free      shared  buff/cache   available",
    "Mem:     16524931072  1656258560 13704818688    12845056  1540685824 14868672512",
    "Swap:    16524505088           0 16524505088",
].join("\n");

const FREE_DE_GLUED = [
    "               gesamt       benutzt     frei      gemns.  Puffer/Cache verfügbar",
    "Speicher:16524931072  1656258560 13704818688    12845056  1540685824 14868672512",
    "Swap:    16524505088           0 16524505088",
].join("\n");

test("locale-independent commands carry LC_ALL=C and meminfo as primary source", () => {
    assert.equal(COMMANDS.memory, "cat /proc/meminfo");
    assert.match(COMMANDS.memoryFallback, /^LC_ALL=C free -b/);
    assert.match(COMMANDS.processList, /^LC_ALL=C /);
    assert.match(COMMANDS.processCount, /^LC_ALL=C /);
    assert.match(COMMANDS.df, /^LC_ALL=C /);
    assert.match(COMMANDS.lsblk, /^LC_ALL=C /);
    assert.match(COMMANDS.ipAddr, /^LC_ALL=C /);
});

test("parses meminfo with MemAvailable", () => {
    const result = parseMeminfo(MEMINFO_FULL);
    assert.equal(result.total, 16524931072);
    assert.equal(result.usage, 10);
});

test("falls back to MemFree+Buffers+Cached+SReclaimable without MemAvailable", () => {
    const result = parseMeminfo(MEMINFO_NO_AVAILABLE);
    assert.equal(result.total, 16524931072);
    assert.equal(result.usage, 10);
});

test("returns nulls for empty or broken meminfo", () => {
    assert.deepEqual(parseMeminfo(""), { usage: null, total: null });
    assert.deepEqual(parseMeminfo("MemFree: 123 kB\n"), { usage: null, total: null });
    assert.deepEqual(parseMeminfo(null), { usage: null, total: null });
});

test("parses english free output", () => {
    const result = parseMemoryUsage(FREE_EN);
    assert.equal(result.total, 16524931072);
    assert.equal(result.usage, 10);
});

test("parses german free output with glued Speicher label", () => {
    const result = parseMemoryUsage(FREE_DE_GLUED);
    assert.equal(result.total, 16524931072);
    assert.equal(result.usage, 10);
});

test("rejects empty or header-only free output", () => {
    assert.deepEqual(parseMemoryUsage(""), { usage: null, total: null });
    assert.deepEqual(parseMemoryUsage("               total used\n"), { usage: null, total: null });
});

test("normalizes comma decimals in process list", () => {
    const output = [
        "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND",
        "geekom 1234 8,5 1,6 123456 78900 ? Sl 10:00 0:01 /usr/bin/app --flag",
    ].join("\n");
    const [proc] = parseProcessList(output);
    assert.equal(proc.cpu, 8.5);
    assert.equal(proc.mem, 1.6);
    assert.equal(proc.pid, 1234);
    assert.equal(proc.command, "/usr/bin/app --flag");
});

test("keeps dot decimals in process list", () => {
    const output = [
        "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND",
        "server 42 0.0 0.1 10000 2000 pts/0 Ss 09:00 0:00 sleep 60",
    ].join("\n");
    const [proc] = parseProcessList(output);
    assert.equal(proc.cpu, 0);
    assert.equal(proc.mem, 0.1);
});

test("computes cpu usage and returns null for empty input", () => {
    assert.equal(parseCPUUsage("cpu  100 200 300 400 0 0 0 0 0 0"), 60);
    assert.equal(parseCPUUsage(""), null);
    assert.equal(parseCPUUsage(null), null);
});

test("tolerates leading whitespace in meminfo keys", () => {
    const result = parseMeminfo("  MemTotal:       16137628 kB\n  MemAvailable:   14520188 kB\n");
    assert.equal(result.total, 16524931072);
    assert.equal(result.usage, 10);
});

test("parses uptime, load average and process count", () => {
    assert.equal(parseUptime("123.45 678.90"), 123);
    assert.equal(parseUptime("0.4 0"), 0);
    assert.equal(parseUptime(""), null);
    assert.deepEqual(parseLoadAverage("0.09 0.07 0.02 1/200 1234"), [0.09, 0.07, 0.02]);
    assert.deepEqual(parseLoadAverage("0.09  0.07  0.02 1/200 1234"), [0.09, 0.07, 0.02]);
    assert.equal(parseLoadAverage("a b c"), null);
    assert.equal(parseProcessCount("  174\n"), 174);
    assert.equal(parseProcessCount("0"), 0);
});

test("parses os release info", () => {
    const info = parseOSInfo('NAME="CachyOS Linux"\nVERSION="rolling"\n', "7.2.8-1-cachyos", "x86_64", "geekom-air12-n100");
    assert.equal(info.name, "CachyOS Linux");
    assert.equal(info.version, "rolling");
    assert.equal(info.kernel, "7.2.8-1-cachyos");
    assert.equal(info.hostname, "geekom-air12-n100");
});

test("keeps equals signs inside os release values", () => {
    const info = parseOSInfo('NAME="X"\nVERSION="1.0=x"\n', "k", "a", "h");
    assert.equal(info.version, "1.0=x");
});

test("maps disk usage from lsblk and df", () => {
    const df = "/dev/sda1 ext4 1000 400 600 40% /";
    const lsblk = JSON.stringify({ blockdevices: [{ name: "sda", type: "disk", size: "1000", model: "M", serial: "S", rota: "1", children: [{ name: "sda1", type: "part", size: "1000", mountpoint: "/" }] }] });
    const [disk] = parseDiskUsage(lsblk, df);
    assert.equal(disk.name, "sda");
    assert.equal(disk.partitions[0].mountPoint, "/");
    assert.equal(disk.partitions[0].usagePercent, 40);
});

test("maps network interfaces from tab details and ip output", () => {
    const details = "eth0\tAA:BB:CC:DD:EE:FF\tup\t1500\t1000\t10\t20\n";
    const ip = "2: eth0    inet 192.168.1.2/24 brd 192.168.1.255 scope global eth0";
    const [iface] = parseNetworkInterfaces(details, ip);
    assert.equal(iface.rxBytes, 10);
    assert.equal(iface.txBytes, 20);
    assert.deepEqual(iface.ipv4, ["192.168.1.2/24"]);
});

test("maps ip addresses without interface details", () => {
    const [iface] = parseNetworkInterfaces(null, "2: eth0    inet 192.168.1.2/24 brd 192.168.1.255 scope global eth0");
    assert.equal(iface.name, "eth0");
    assert.deepEqual(iface.ipv4, ["192.168.1.2/24"]);
});
