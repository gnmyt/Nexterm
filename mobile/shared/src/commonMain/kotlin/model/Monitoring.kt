package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Formatters
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.time.Instant

enum class MonitoringState(val label: String, val title: String, val message: String) {
    ONLINE("Online", "", ""),
    OFFLINE("Offline", "Server Offline", "The server is currently not responding to monitoring requests."),
    ERROR("Error", "Connection Error", "Unable to establish connection to the server."),
    PENDING("Pending", "Waiting for data", "Monitoring data will appear after the next monitoring cycle."),
    UNKNOWN("Unknown", "Status Unknown", "Server status could not be determined."),
}

enum class MonitoringFilter(val label: String) { ALL("All"), ONLINE("Online"), ISSUES("Issues") }

enum class TimeRange(val key: String, val label: String) { HOUR("1h", "1h"), SIX_HOURS("6h", "6h"), DAY("24h", "24h") }

data class InfoRow(val label: String, val value: String, val detail: String? = null, val alert: Boolean = false)

data class ChartPoint(val time: Long, val value: Double)

data class ChartSeries(val title: String, val unit: String, val max: Double?, val points: List<ChartPoint>) {
    val latest: String? get() = points.lastOrNull()?.let { "${Formatters.number(it.value)}$unit" }

    val top: Double
        get() = max ?: run {
            val step = (points.maxOfOrNull { it.value } ?: 0.0).coerceAtLeast(1.0) / 4
            val magnitude = 10.0.pow(floor(log10(step)))
            listOf(1.0, 2.0, 2.5, 5.0, 10.0).first { it >= step / magnitude } * magnitude * 4
        }
}

@Serializable
data class HistoryPoint(
    val timestamp: String? = null,
    val cpuUsage: Double? = null,
    val memoryUsage: Double? = null,
    val processes: Double? = null,
) {
    val time: Long? get() = parseTime(timestamp)
}

internal fun parseTime(iso: String?): Long? = iso?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() }

@Serializable
data class MonitoringServer(
    val id: String = "",
    val name: String = "Unknown",
    val ip: String? = null,
    val port: String? = null,
    val type: String? = null,
    val status: String? = null,
    private val monitoring: Stats? = null,
    private val history: List<HistoryPoint> = emptyList(),
) {
    @Serializable
    class Stats(
        val status: String? = null,
        val timestamp: String? = null,
        val updatedAt: String? = null,
        val cpuUsage: Double? = null,
        val memoryUsage: Double? = null,
        val uptime: Double? = null,
        val processes: Double? = null,
        val loadAverage: List<Double> = emptyList(),
        val errorMessage: String? = null,
        val osInfo: OsInfo? = null,
    )

    val isPve: Boolean get() = type == "proxmox"
    val address: String get() = listOfNotNull(ip, port).joinToString(":")

    val state: MonitoringState
        get() = when {
            status == "offline" -> MonitoringState.OFFLINE
            monitoring?.status == "online" -> MonitoringState.ONLINE
            monitoring?.status == "error" || monitoring?.status == "offline" -> MonitoringState.ERROR
            status == "online" -> MonitoringState.PENDING
            else -> MonitoringState.UNKNOWN
        }

    val isOnline: Boolean get() = state == MonitoringState.ONLINE
    val cpuUsage: Double? get() = monitoring?.cpuUsage
    val memoryUsage: Double? get() = monitoring?.memoryUsage
    val cpuHistory: List<Double> get() = history.mapNotNull { it.cpuUsage }
    val memoryHistory: List<Double> get() = history.mapNotNull { it.memoryUsage }

    val issueMessage: String get() = monitoring?.errorMessage?.takeIf { state == MonitoringState.ERROR } ?: state.message

    val issueMeta: String?
        get() = when {
            state == MonitoringState.PENDING -> null
            else -> parseTime(monitoring?.timestamp ?: monitoring?.updatedAt)?.let { "Last seen ${Formatters.relativeTime(it).lowercase()}" } ?: "No recent activity"
        }

    val facts: List<InfoRow>
        get() {
            val pve = monitoring?.osInfo
            val uptime = InfoRow("Uptime", Formatters.uptime(monitoring?.uptime?.toLong()))
            return if (isPve) listOf(
                InfoRow("Nodes", pve?.onlineNodes?.let { "${it.toLong()}/${count(pve.totalNodes)}" } ?: Formatters.EMPTY),
                InfoRow("VMs/Containers", pve?.vmCount?.let { "${count(pve.runningVMs) + count(pve.runningLXC)}/${count(it) + count(pve.lxcCount)}" } ?: Formatters.EMPTY),
                uptime,
            ) else listOf(
                InfoRow("Load", monitoring?.loadAverage?.firstOrNull()?.let { Formatters.fixed(it, 2) } ?: Formatters.EMPTY),
                InfoRow("Processes", monitoring?.processes?.let { "${it.toLong()}" } ?: Formatters.EMPTY),
                uptime,
            )
        }
}

internal fun count(value: Double?): Long = (value ?: 0.0).toLong()

@Serializable
data class MonitoringDetails(val latest: MonitoringSnapshot? = null, private val data: List<HistoryPoint> = emptyList()) {
    fun charts(isPve: Boolean): List<ChartSeries> = listOf(
        series("CPU Usage", "%", 100.0) { it.cpuUsage },
        series("Memory Usage", "%", 100.0) { it.memoryUsage },
        series(if (isPve) "VMs & Containers" else "Active Processes", "", null) { it.processes },
    )

    private fun series(title: String, unit: String, max: Double?, value: (HistoryPoint) -> Double?) = ChartSeries(
        title, unit, max,
        data.mapNotNull { point -> point.time?.let { time -> value(point)?.let { ChartPoint(time, it) } } }.sortedBy { it.time },
    )
}

@Serializable
data class MonitoringSnapshot(
    val cpuUsage: Double? = null,
    val memoryUsage: Double? = null,
    val memoryTotal: Double? = null,
    val uptime: Double? = null,
    val processes: Double? = null,
    val loadAverage: List<Double> = emptyList(),
    val osInfo: OsInfo? = null,
    private val memory: Memory? = null,
    private val disk: List<Disk> = emptyList(),
    private val network: List<NetworkInterface> = emptyList(),
    private val processList: List<ProcessEntry> = emptyList(),
) {
    val memoryOverview: MemoryOverview? by lazy { MemoryOverview.from(memory) }
    val storage: StorageOverview? by lazy { StorageOverview.from(disk) }
    val networking: NetworkOverview? by lazy { NetworkOverview.from(network) }
    val hasProcesses: Boolean get() = processList.isNotEmpty()
    val processCount: Int get() = processList.size

    fun processes(query: String, sort: ProcessSort): List<ProcessEntry> {
        val q = query.trim().lowercase()
        val filtered = if (q.isEmpty()) processList else processList.filter { q in it.command.lowercase() || q in it.user.lowercase() || q in it.pid.toString() }
        return filtered.sortedByDescending { if (sort == ProcessSort.MEMORY) it.mem else it.cpu }
    }

    val overviewFacts: List<InfoRow>
        get() = listOf(
            InfoRow(
                "Load Average", loadAverage.firstOrNull()?.let { Formatters.fixed(it, 2) } ?: Formatters.EMPTY,
                loadAverage.takeIf { it.size >= 3 }?.let { "5m: ${Formatters.fixed(it[1], 2)}, 15m: ${Formatters.fixed(it[2], 2)}" },
            ),
            InfoRow("Active Processes", processes?.let { "${it.toLong()}" } ?: Formatters.EMPTY),
            InfoRow("Memory", memoryTotal?.takeIf { it > 0 }?.let { Formatters.bytes(it.toLong()) } ?: Formatters.EMPTY),
            InfoRow("Uptime", uptime?.let { Formatters.uptime(it.toLong()) } ?: Formatters.EMPTY),
        )

    val clusterFacts: List<InfoRow>
        get() = listOf(
            InfoRow("Online Nodes", "${count(osInfo?.onlineNodes)}/${count(osInfo?.totalNodes)}"),
            InfoRow("QEMU VMs", "${count(osInfo?.vmCount)}", "${count(osInfo?.runningVMs)} running"),
            InfoRow("LXC Containers", "${count(osInfo?.lxcCount)}", "${count(osInfo?.runningLXC)} running"),
            InfoRow(
                "Storage Usage", osInfo?.diskUsage?.let { "${it.toLong()}%" } ?: Formatters.EMPTY,
                osInfo?.totalDisk?.takeIf { it > 0 }?.let { "Total: ${Formatters.bytes(it.toLong())}" },
            ),
        )

    val systemInfo: List<InfoRow>
        get() = listOf(
            InfoRow("Hostname", osInfo?.hostname ?: "Unknown"),
            InfoRow("OS", osInfo?.name ?: "Unknown"),
            InfoRow("Version", osInfo?.version ?: "Unknown"),
            InfoRow("Kernel", osInfo?.kernel ?: "Unknown"),
            InfoRow("Architecture", osInfo?.architecture ?: "Unknown"),
            InfoRow("Uptime", Formatters.uptimeLong(uptime?.toLong())),
        )

    val clusterInfo: List<InfoRow>
        get() = listOf(
            InfoRow("Total CPU", "${count(osInfo?.totalCpu)} cores"),
            InfoRow("Total Memory", Formatters.bytes(osInfo?.totalMemory?.toLong())),
            InfoRow("Total Storage", Formatters.bytes(osInfo?.totalDisk?.toLong())),
            InfoRow("Uptime", Formatters.uptimeLong(uptime?.toLong())),
        )
}

enum class ProcessSort(val label: String) { CPU("CPU"), MEMORY("Memory") }

@Serializable
data class ProcessEntry(val pid: Long = 0, val user: String = "", val cpu: Double = 0.0, val mem: Double = 0.0, val command: String = "") {
    val meta: String get() = "$user · PID $pid"
    val cpuText: String get() = Formatters.percent(cpu)
    val memText: String get() = Formatters.percent(mem)
}

@Serializable
data class OsInfo(
    val hostname: String? = null,
    val name: String? = null,
    val version: String? = null,
    val kernel: String? = null,
    val architecture: String? = null,
    val onlineNodes: Double? = null,
    val totalNodes: Double? = null,
    val totalCpu: Double? = null,
    val totalMemory: Double? = null,
    val totalDisk: Double? = null,
    val diskUsage: Double? = null,
    val runningVMs: Double? = null,
    val vmCount: Double? = null,
    val runningLXC: Double? = null,
    val lxcCount: Double? = null,
    val nodes: List<PveNode> = emptyList(),
)

@Serializable
data class PveNode(
    val name: String = "",
    val status: String = "",
    val cpu: Double? = null,
    val cpuUsage: Double? = null,
    val memory: Double? = null,
    val memoryUsed: Double? = null,
    val memoryUsage: Double? = null,
    val disk: Double? = null,
    val diskUsed: Double? = null,
    val diskUsage: Double? = null,
    val uptime: Double? = null,
) {
    val isOnline: Boolean get() = status == "online"

    val usage: List<UsageRow>
        get() = listOf(
            UsageRow("CPU", cpuUsage ?: 0.0, null),
            UsageRow("Memory", memoryUsage ?: 0.0, "${Formatters.bytes(memoryUsed?.toLong())} / ${Formatters.bytes(memory?.toLong())}"),
            UsageRow("Storage", diskUsage ?: 0.0, "${Formatters.bytes(diskUsed?.toLong())} / ${Formatters.bytes(disk?.toLong())}"),
        )

    val info: List<InfoRow>
        get() = listOf(InfoRow("Cores", cpu?.let { "${it.toLong()}" } ?: Formatters.EMPTY), InfoRow("Uptime", Formatters.uptimeLong(uptime?.toLong())))
}

@Serializable
class Memory(val total: Double = 0.0, val used: Double = 0.0, val cache: Double = 0.0, val free: Double = 0.0)

data class UsageRow(val label: String, val percent: Double, val detail: String?)

@Serializable
class Disk(
    val name: String = "",
    val size: Double = 0.0,
    val model: String? = null,
    val rotational: Boolean? = null,
    val health: DiskHealth? = null,
    val partitions: List<Volume> = emptyList(),
)

@Serializable
class DiskHealth(
    val status: String? = null,
    val temperature: Double? = null,
    val powerOnHours: Double? = null,
    val wearPercent: Double? = null,
    val mediaErrors: Double? = null,
    val reallocatedSectors: Double? = null,
    val pendingSectors: Double? = null,
)

@Serializable
class Volume(
    val name: String = "",
    val size: Double = 0.0,
    val mountPoint: String? = null,
    val type: String? = null,
    val used: Double = 0.0,
    val available: Double = 0.0,
    val usagePercent: Double = 0.0,
    private val mounted: Boolean? = null,
    val inodesTotal: Double? = null,
    val inodesUsed: Double? = null,
    val inodesPercent: Double? = null,
    private val partition: String? = null,
    private val partitionSize: Double? = null,
    val layers: List<String> = emptyList(),
) {
    val isMounted: Boolean get() = mounted ?: (mountPoint?.startsWith("/") == true)
    val isSwap: Boolean get() = type == "swap" || mountPoint == "[SWAP]"
    val partitionName: String get() = partition ?: name
    val partitionBytes: Double get() = partitionSize ?: size
}

@Serializable
class NetworkInterface(
    val name: String = "",
    val ipv4: List<String> = emptyList(),
    val ipv6: List<String> = emptyList(),
    val rxBytes: Double = 0.0,
    val txBytes: Double = 0.0,
    val rxRate: Double? = null,
    val txRate: Double? = null,
    val errors: Double = 0.0,
    val dropped: Double = 0.0,
    val recentErrors: Double = 0.0,
    val recentDropped: Double = 0.0,
    val mac: String? = null,
    val state: String? = null,
    val mtu: Double? = null,
    val speed: Double? = null,
    val kind: String? = null,
    @SerialName("default") val isDefault: Boolean = false,
    val gateway: String? = null,
) {
    val isUp: Boolean get() = state == "up" || (state == "unknown" && kind == "tunnel")
    val isVirtual: Boolean get() = !isDefault && kind in setOf("bridge", "veth", "virtual")
}
