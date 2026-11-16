package dev.gnm.nexterm.state

import dev.gnm.nexterm.model.InfoRow
import dev.gnm.nexterm.model.MonitoringDetails
import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.util.Formatters
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MonitoringController internal constructor(
    private val api: ApiClient,
    private val scope: CoroutineScope,
    private val refreshIntervalMs: Long,
) {
    private val _servers = MutableStateFlow<List<MonitoringServer>>(emptyList())
    private val _isLoading = MutableStateFlow(true)
    private val _error = MutableStateFlow<String?>(null)
    private val _selected = MutableStateFlow<MonitoringServer?>(null)
    private val _details = MutableStateFlow<MonitoringDetails?>(null)
    private val _isLoadingDetails = MutableStateFlow(false)
    private var timer: Job? = null

    val servers: StateFlow<List<MonitoringServer>> = _servers.asStateFlow()
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()
    val selected: StateFlow<MonitoringServer?> = _selected.asStateFlow()
    val details: StateFlow<MonitoringDetails?> = _details.asStateFlow()
    val isLoadingDetails: StateFlow<Boolean> = _isLoadingDetails.asStateFlow()

    fun start() {
        timer?.cancel()
        timer = scope.launch {
            load(_servers.value.isNotEmpty())
            while (isActive) {
                delay(refreshIntervalMs)
                load(true)
            }
        }
    }

    fun stop() {
        timer?.cancel()
        timer = null
    }

    @Throws(CancellationException::class)
    suspend fun load(silent: Boolean) {
        if (!silent) _isLoading.value = true
        try {
            val list = api.getAs("/monitoring", "Failed", ListSerializer(MonitoringServer.serializer()))
            _servers.value = list
            _error.value = null
            _selected.value?.let { sel -> _selected.value = list.firstOrNull { it.id == sel.id } ?: sel }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            _error.value = e.message ?: e.toString()
        } finally {
            _isLoading.value = false
        }
    }

    @Throws(CancellationException::class)
    suspend fun select(server: MonitoringServer) {
        _selected.value = server
        _isLoadingDetails.value = true
        try {
            val path = if (server.id.startsWith("pve-")) "/monitoring/integration/${server.id.substring(4)}" else "/monitoring/${server.id}"
            _details.value = api.getAs("$path?timeRange=1h", "Failed", MonitoringDetails.serializer())
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
        } finally {
            _isLoadingDetails.value = false
        }
    }

    fun clearSelection(): Boolean {
        if (_selected.value == null) return false
        _selected.value = null
        _details.value = null
        return true
    }

    fun reportingSummary(): String = "${_servers.value.count { it.isReporting }} of ${_servers.value.size} reporting"

    fun infoTitle(): String = if (_selected.value?.isPve == true) "Cluster Info" else "System Info"

    fun infoRows(): List<InfoRow> {
        val server = _selected.value ?: return emptyList()
        val latest = _details.value?.latest
        val os = latest?.osInfo
        fun n(v: Double?) = (v ?: 0.0).toLong()
        val uptime = InfoRow("Uptime", Formatters.uptime(latest?.uptime?.toLong()))
        return if (server.isPve) listOf(
            InfoRow("Nodes", "${n(os?.onlineNodes)} / ${n(os?.totalNodes)} online"),
            InfoRow("Total CPU", "${n(os?.totalCpu)} cores"),
            InfoRow("Total Memory", Formatters.bytes(os?.totalMemory?.toLong())),
            InfoRow("VMs", "${n(os?.runningVMs)} / ${n(os?.vmCount)} running"),
            InfoRow("Containers", "${n(os?.runningLXC)} / ${n(os?.lxcCount)} running"),
            uptime,
        ) else listOf(
            InfoRow("Hostname", os?.hostname ?: "Unknown"),
            InfoRow("OS", os?.name ?: "Unknown"),
            InfoRow("Version", os?.version ?: "Unknown"),
            InfoRow("Kernel", os?.kernel ?: "Unknown"),
            InfoRow("Architecture", os?.architecture ?: "Unknown"),
            uptime,
        )
    }

    fun performanceRows(): List<InfoRow> {
        val latest = _details.value?.latest ?: return emptyList()
        return listOfNotNull(
            latest.processes?.let { InfoRow("Processes", "${it.toLong()}") },
            latest.loadAverageText?.let { InfoRow("Load Average", it) },
        )
    }

    fun close() = scope.cancel()
}
