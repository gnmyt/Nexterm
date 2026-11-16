package dev.gnm.nexterm.state

import kotlinx.serialization.json.JsonArray
import dev.gnm.nexterm.util.str
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.asArray
import dev.gnm.nexterm.model.EntryParser
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.Tag
import dev.gnm.nexterm.api.ConnectionRules
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.api.ConnectStep
import dev.gnm.nexterm.api.DirectIdentity
import dev.gnm.nexterm.api.ServerAction
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.util.ServerFilter
import dev.gnm.nexterm.util.ServerListRow
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class)
class ServerListController internal constructor(
    private val api: ApiClient,
    private val folderState: FolderStateStore,
    private val scope: CoroutineScope,
) {
    private val _entries = MutableStateFlow<List<Entry>>(emptyList())
    private val _isLoading = MutableStateFlow(true)
    private val _error = MutableStateFlow<String?>(null)
    private val _searchText = MutableStateFlow("")
    private val _query = MutableStateFlow("")
    private val _selectedTags = MutableStateFlow<Set<Int>>(emptySet())

    val entries: StateFlow<List<Entry>> = _entries.asStateFlow()
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()
    val searchText: StateFlow<String> = _searchText.asStateFlow()
    val query: StateFlow<String> = _query.asStateFlow()
    val selectedTags: StateFlow<Set<Int>> = _selectedTags.asStateFlow()
    val allTags: StateFlow<List<Tag>> = _entries.map(ServerFilter::collectTags).stateIn(scope, SharingStarted.Eagerly, emptyList())
    val filtered: StateFlow<List<Entry>> = combine(_entries, _query, _selectedTags) { e, q, t -> ServerFilter.filter(e, q, t) }
        .stateIn(scope, SharingStarted.Eagerly, emptyList())
    val expandedIds: StateFlow<Set<String>> = folderState.expandedIds
    val rows: StateFlow<List<ServerListRow>> = combine(filtered, expandedIds) { f, e -> ServerFilter.flatten(f, e) }
        .stateIn(scope, SharingStarted.Eagerly, emptyList())
    val totalServers: StateFlow<Int> = _entries.map(ServerFilter::countServers).stateIn(scope, SharingStarted.Eagerly, 0)

    init {
        scope.launch { _searchText.drop(1).debounce(300).collect { _query.value = it } }
    }

    fun onlineSummary(): String = "${ServerFilter.countOnline(_entries.value)} of ${totalServers.value} online"

    fun emptyTitle(): String = if (_query.value.isEmpty()) "No servers yet" else "No results"
    fun emptySubtitle(): String = if (_query.value.isEmpty()) "Add servers from the web dashboard" else "Try a different search term"

    @Throws(CancellationException::class)
    suspend fun load() {
        _isLoading.value = true
        try {
            _entries.value = fetch()
            _error.value = null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            _error.value = "Failed to load servers: ${e.message ?: e}"
        } finally {
            _isLoading.value = false
        }
    }

    @Throws(Exception::class)
    suspend fun refresh() {
        _entries.value = fetch()
        _error.value = null
    }

    private suspend fun fetch(): List<Entry> {
        val r = api.get("/entries/list")
        if (r.status != 200) throw NextermException("Failed to load servers: ${r.status} - ${r.body}", r.status)
        return EntryParser.parseList(r.json().asArray() ?: JsonArray(emptyList()))
    }

    fun setSearchText(text: String) {
        _searchText.value = text
    }

    fun clearSearch() {
        _searchText.value = ""
        _query.value = ""
    }

    fun toggleTag(id: Int) = _selectedTags.update { if (id in it) it - id else it + id }

    fun clearTags() {
        _selectedTags.value = emptySet()
    }

    fun isExpanded(folderId: String?): Boolean = folderId != null && folderId in expandedIds.value

    fun toggleFolder(folderId: String?) = folderState.toggle(folderId)

    fun plan(server: Server, action: ServerAction?): ConnectStep = ConnectionRules.plan(server, action, _entries.value)

    fun request(server: Server, type: ConnectionType, identity: DirectIdentity?): ConnectRequest =
        ConnectionRules.request(server, type, identity, _entries.value)

    @Throws(Exception::class)
    suspend fun wake(server: Server): String {
        try {
            val r = api.post("/entries/${server.id ?: throw NextermException("missing server id")}/wake")
            if (!r.isOk) throw NextermException("${r.status} - ${r.body}", r.status)
            r.json().asObject()?.let { if ((it.int("code") ?: 0) >= 300) throw NextermException(it.str("message") ?: "error") }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            throw NextermException("Failed to send magic packet: ${e.message ?: e}", cause = e)
        }
        return "Magic packet sent to ${server.name}"
    }

    fun close() = scope.cancel()
}
