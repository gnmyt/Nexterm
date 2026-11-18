const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter 'Name=''_Total''' -ErrorAction SilentlyContinue
$memoryTotal = [int64]$os.TotalVisibleMemorySize * 1024
$memoryAvailable = [int64]$os.FreePhysicalMemory * 1024
$memoryUsage = if ($memoryTotal -gt 0) { [math]::Round((($memoryTotal - $memoryAvailable) / $memoryTotal) * 100, 0) } else { $null }
$logicalProcessors = [math]::Max(1, [int]$computer.NumberOfLogicalProcessors)

$cpuByProcess = @{}
try {
    Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop | ForEach-Object {
        if ([int]$_.IDProcess -gt 0) { $cpuByProcess[[string]$_.IDProcess] = $_ }
    }
} catch {}

$processList = @(Get-Process -IncludeUserName -ErrorAction SilentlyContinue | ForEach-Object {
    $perf = $cpuByProcess[[string]$_.Id]
    $cpuPercent = if ($perf) { [math]::Min(100, [math]::Max(0, [double]$perf.PercentProcessorTime / $logicalProcessors)) } else { $null }
    $memoryPercent = if ($memoryTotal -gt 0) { [math]::Round(([double]$_.WorkingSet64 / $memoryTotal) * 100, 1) } else { $null }
    [pscustomobject]@{
        user = $_.UserName
        pid = [int]$_.Id
        cpu = $cpuPercent
        mem = $memoryPercent
        vsz = [int64]$_.VirtualMemorySize64
        rss = [int64]$_.WorkingSet64
        tty = $null
        stat = $null
        start = $null
        time = $null
        command = $_.ProcessName
    }
} | Sort-Object @{ Expression = { if ($null -eq $_.cpu) { -1 } else { $_.cpu } }; Descending = $true } | Select-Object -First 50)

$diskList = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
    $size = if ($_.Size) { [int64]$_.Size } else { 0L }
    $free = if ($_.FreeSpace) { [int64]$_.FreeSpace } else { 0L }
    $used = [math]::Max([int64]0, $size - $free)
    $usage = if ($size -gt 0) { [math]::Round(($used / $size) * 100, 0) } else { 0 }
    [pscustomobject]@{
        name = [string]$_.DeviceID
        size = $size
        model = $null
        serial = $null
        rotational = $null
        partitions = @([pscustomobject]@{
            name = [string]$_.DeviceID
            size = $size
            mountPoint = [string]$_.DeviceID + '\'
            type = [string]$_.FileSystem
            used = $used
            available = $free
            usagePercent = $usage
        })
    }
})

$adapterStats = @{}
try {
    Get-NetAdapterStatistics -ErrorAction Stop | ForEach-Object { $adapterStats[[string]$_.Name] = $_ }
} catch {}
$physicalAdapters = @(Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue)
$networkList = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' | ForEach-Object {
    $config = $_
    $adapter = $physicalAdapters | Where-Object { $_.Index -eq $config.Index } | Select-Object -First 1
    $stats = $null
    if ($adapter) {
        $stats = $adapterStats[[string]$adapter.NetConnectionID]
        if (-not $stats) { $stats = $adapterStats[[string]$adapter.Name] }
    }
    $addresses = @($config.IPAddress | Where-Object { $_ })
    [pscustomobject]@{
        name = if ($adapter -and $adapter.NetConnectionID) { [string]$adapter.NetConnectionID } else { [string]$config.Description }
        ipv4 = @($addresses | Where-Object { $_ -notmatch ':' })
        ipv6 = @($addresses | Where-Object { $_ -match ':' })
        rxBytes = if ($stats) { [int64]$stats.ReceivedBytes } else { $null }
        txBytes = if ($stats) { [int64]$stats.SentBytes } else { $null }
        mac = [string]$config.MACAddress
        state = if ($adapter -and $adapter.NetEnabled) { 'up' } else { 'down' }
        mtu = $null
        speed = if ($adapter -and $adapter.Speed) { [math]::Round(([double]$adapter.Speed / 1000000), 0) } else { $null }
    }
})

$uptime = [int64]([datetime]::Now - $os.LastBootUpTime).TotalSeconds
$result = [pscustomobject]@{
    cpuUsage = if ($cpu) { [math]::Round([double]$cpu.PercentProcessorTime, 0) } else { $null }
    memoryUsage = $memoryUsage
    memoryTotal = $memoryTotal
    uptime = $uptime
    processes = @(Get-Process -ErrorAction SilentlyContinue).Count
    processList = $processList
    disk = $diskList
    osInfo = [pscustomobject]@{
        platform = 'windows'
        hostname = [string]$computer.Name
        name = [string]$os.Caption
        version = ('{0} (Build {1})' -f $os.Version, $os.BuildNumber)
        architecture = [string]$os.OSArchitecture
    }
    network = $networkList
}
$result | ConvertTo-Json -Depth 6 -Compress
`;

const buildWindowsMonitoringCommand = (shell = "cmd") => {
    if (shell === "powershell") return POWERSHELL_SCRIPT.trim();
    return `powershell.exe -NoLogo -NoProfile -NonInteractive -Command "& {\n${POWERSHELL_SCRIPT.trim()}\n}"`;
};

const isWindowsProbeResult = (result) => result?.success
    && (result.stdout || "").trim().toUpperCase() === "NEXTERM_WINDOWS";

const isPowerShellProbeResult = (result) => result?.success
    && (result.stdout || "").trim().toUpperCase() === "NEXTERM_POWERSHELL";

const asNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseWindowsMonitoringOutput = (output) => {
    let parsed;
    try {
        parsed = JSON.parse(String(output || "").trim());
    } catch (error) {
        throw new Error(`Invalid Windows monitoring JSON: ${error.message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid Windows monitoring payload");
    }

    const disk = Array.isArray(parsed.disk) ? parsed.disk.map(item => {
        const name = String(item.name || "");
        const size = asNumberOrNull(item.size) || 0;
        return {
            name,
            size,
            model: item.model || null,
            serial: item.serial || null,
            rotational: typeof item.rotational === "boolean" ? item.rotational : null,
            health: null,
            partitions: Array.isArray(item.partitions) ? item.partitions.map(partition => ({
                name: String(partition.name || ""),
                size: asNumberOrNull(partition.size) || 0,
                mountPoint: partition.mountPoint || null,
                type: partition.type || null,
                used: asNumberOrNull(partition.used) || 0,
                available: asNumberOrNull(partition.available) || 0,
                usagePercent: asNumberOrNull(partition.usagePercent) || 0,
                mounted: !!partition.mountPoint,
                inodesTotal: null,
                inodesUsed: null,
                inodesPercent: null,
                partition: name,
                partitionSize: size,
            })) : [],
        };
    }) : [];

    return {
        status: "online",
        timestamp: new Date(),
        cpuUsage: asNumberOrNull(parsed.cpuUsage),
        memoryUsage: asNumberOrNull(parsed.memoryUsage),
        memoryTotal: asNumberOrNull(parsed.memoryTotal),
        uptime: asNumberOrNull(parsed.uptime),
        loadAverage: null,
        processes: asNumberOrNull(parsed.processes),
        processList: Array.isArray(parsed.processList) ? parsed.processList.map(process => ({
            user: process.user || null,
            pid: asNumberOrNull(process.pid),
            cpu: asNumberOrNull(process.cpu) ?? 0,
            mem: asNumberOrNull(process.mem) ?? 0,
            vsz: asNumberOrNull(process.vsz),
            rss: asNumberOrNull(process.rss),
            tty: process.tty || null,
            stat: process.stat || null,
            start: process.start || null,
            time: process.time || null,
            command: String(process.command || ""),
        })) : [],
        disk,
        osInfo: {
            platform: "windows",
            hostname: parsed.osInfo?.hostname || null,
            name: parsed.osInfo?.name || null,
            version: parsed.osInfo?.version || null,
            architecture: parsed.osInfo?.architecture || null,
        },
        network: Array.isArray(parsed.network) ? parsed.network.map(adapter => ({
            name: String(adapter.name || ""),
            ipv4: Array.isArray(adapter.ipv4) ? adapter.ipv4.map(String) : [],
            ipv6: Array.isArray(adapter.ipv6) ? adapter.ipv6.map(String) : [],
            rxBytes: asNumberOrNull(adapter.rxBytes) ?? 0,
            txBytes: asNumberOrNull(adapter.txBytes) ?? 0,
            rxRate: null,
            txRate: null,
            errors: 0,
            dropped: 0,
            mac: adapter.mac || null,
            state: adapter.state || null,
            mtu: asNumberOrNull(adapter.mtu),
            speed: asNumberOrNull(adapter.speed),
            kind: "physical",
            default: false,
            gateway: null,
        })) : [],
    };
};

module.exports = { buildWindowsMonitoringCommand, isWindowsProbeResult, isPowerShellProbeResult, parseWindowsMonitoringOutput };
