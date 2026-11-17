package dev.gnm.nexterm.state

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.model.MonitoringDetails
import dev.gnm.nexterm.model.MonitoringFilter
import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.model.TimeRange
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer

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
    private val _detailsFailed = MutableStateFlow(false)
    private val _filter = MutableStateFlow(MonitoringFilter.ALL)
    private val _query = MutableStateFlow("")
    private val _timeRange = MutableStateFlow(TimeRange.HOUR)
    private var timer: Job? = null

    val servers: StateFlow<List<MonitoringServer>> = _servers.asStateFlow()
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()
    val selected: StateFlow<MonitoringServer?> = _selected.asStateFlow()
    val details: StateFlow<MonitoringDetails?> = _details.asStateFlow()
    val detailsFailed: StateFlow<Boolean> = _detailsFailed.asStateFlow()
    val filter: StateFlow<MonitoringFilter> = _filter.asStateFlow()
    val query: StateFlow<String> = _query.asStateFlow()
    val timeRange: StateFlow<TimeRange> = _timeRange.asStateFlow()

    val visibleServers: StateFlow<List<MonitoringServer>> = combine(_servers, _filter, _query) { servers, filter, query ->
        val q = query.trim().lowercase()
        servers.filter { matches(it, filter) && (q.isEmpty() || q in it.name.lowercase() || q in it.ip.orEmpty().lowercase()) }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())

    fun start() {
        timer?.cancel()
        timer = scope.launch {
            load(_servers.value.isNotEmpty())
            while (isActive) {
                delay(refreshIntervalMs)
                load(true)
                _selected.value?.let { loadDetails(it) }
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
            val list = api.getAs("/monitoring", "Failed", ListSerializer(MonitoringServer.serializer())).sortedBy { it.id }
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
        if (_selected.value?.id != server.id) _details.value = null
        _selected.value = server
        loadDetails(server)
    }

    @Throws(CancellationException::class)
    suspend fun refreshDetails() {
        _selected.value?.let { loadDetails(it) }
    }

    @Throws(CancellationException::class)
    suspend fun setTimeRange(range: TimeRange) {
        _timeRange.value = range
        refreshDetails()
    }

    fun setFilter(filter: MonitoringFilter) {
        _filter.value = filter
    }

    fun setQuery(query: String) {
        _query.value = query
    }

    fun clearSelection(): Boolean {
        if (_selected.value == null) return false
        _selected.value = null
        _details.value = null
        _detailsFailed.value = false
        return true
    }

    fun filterLabel(filter: MonitoringFilter): String = "${filter.label} (${_servers.value.count { matches(it, filter) }})"

    fun reportingSummary(): String = "${_servers.value.count { it.isOnline }} of ${_servers.value.size} reporting"

    fun close() = scope.cancel()

    private fun matches(server: MonitoringServer, filter: MonitoringFilter) = when (filter) {
        MonitoringFilter.ALL -> true
        MonitoringFilter.ONLINE -> server.isOnline
        MonitoringFilter.ISSUES -> !server.isOnline
    }

    private suspend fun loadDetails(server: MonitoringServer) {
        try {
            val path = if (server.id.startsWith("pve-")) "/monitoring/integration/${server.id.substring(4)}" else "/monitoring/${server.id}"
            val details = api.getAs("$path?timeRange=${_timeRange.value.key}", "Failed", MonitoringDetails.serializer())
            if (_selected.value?.id != server.id) return
            _details.value = details
            _detailsFailed.value = false
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
            if (_selected.value?.id == server.id) _detailsFailed.value = _details.value == null
        }
    }
}
