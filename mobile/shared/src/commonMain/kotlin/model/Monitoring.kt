package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Formatters
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MonitoringServer(
    val id: String = "",
    val name: String = "Unknown",
    val ip: String? = null,
    val type: String? = null,
    @SerialName("cpuUsage") private val cpu: Double? = null,
    @SerialName("memoryUsage") private val memory: Double? = null,
    @SerialName("errorMessage") private val error: String? = null,
    private val monitoring: Stats? = null,
) {
    @Serializable
    class Stats(val cpuUsage: Double? = null, val memoryUsage: Double? = null, val errorMessage: String? = null)

    val cpuUsage: Double? get() = cpu ?: monitoring?.cpuUsage
    val memoryUsage: Double? get() = memory ?: monitoring?.memoryUsage
    val errorMessage: String? get() = error ?: monitoring?.errorMessage
    val isPve: Boolean get() = type == "proxmox"
    val hasData: Boolean get() = cpuUsage != null
    val isReporting: Boolean get() = hasData && errorMessage == null
    val hasError: Boolean get() = errorMessage != null && !hasData
}

@Serializable
data class MonitoringDetails(val latest: MonitoringSnapshot? = null)

@Serializable
data class MonitoringSnapshot(
    val cpuUsage: Double? = null,
    val memoryUsage: Double? = null,
    val uptime: Double? = null,
    val processes: Double? = null,
    val loadAverage: List<Double> = emptyList(),
    val osInfo: OsInfo? = null,
) {
    val loadAverageText: String? get() = loadAverage.takeIf { it.isNotEmpty() }?.joinToString(", ") { Formatters.fixed(it, 2) }
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
    val runningVMs: Double? = null,
    val vmCount: Double? = null,
    val runningLXC: Double? = null,
    val lxcCount: Double? = null,
    val nodes: List<PveNode> = emptyList(),
)

@Serializable
data class PveNode(val name: String = "", val status: String = "", val cpuUsage: Double? = null, val memoryUsage: Double? = null, val diskUsage: Double? = null) {
    val isOnline: Boolean get() = status == "online"
}

data class InfoRow(val label: String, val value: String)
