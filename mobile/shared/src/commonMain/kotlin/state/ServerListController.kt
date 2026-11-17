package dev.gnm.nexterm.state

import dev.gnm.nexterm.api.ActionResult
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.api.ConnectStep
import dev.gnm.nexterm.api.ConnectionRules
import dev.gnm.nexterm.api.DirectIdentity
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.api.ServerContext
import dev.gnm.nexterm.api.ServerIntent
import dev.gnm.nexterm.api.ServerMenuItem
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.EntryParser
import dev.gnm.nexterm.model.Identity
import dev.gnm.nexterm.model.RecentConnection
import dev.gnm.nexterm.model.Script
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerFolder
import dev.gnm.nexterm.model.Tag
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.session.SessionManager
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.ServerFilter
import dev.gnm.nexterm.util.ServerListRow
import dev.gnm.nexterm.util.asArray
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.str
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
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray

@OptIn(FlowPreview::class)
class ServerListController internal constructor(
    private val api: ApiClient,
    private val folderState: FolderStateStore,
    private val stream: StateStream,
    private val sessions: SessionManager,
    private val scripts: ScriptManager,
    private val scope: CoroutineScope,
) {
    private val _entries = MutableStateFlow<List<Entry>>(emptyList())
    private val _isLoading = MutableStateFlow(true)
    private val _error = MutableStateFlow<String?>(null)
    private val _searchText = MutableStateFlow("")
    private val _query = MutableStateFlow("")
    private val _selectedTags = MutableStateFlow<Set<Int>>(emptySet())
    private val _identities = MutableStateFlow<List<Identity>>(emptyList())
    private val _recentIds = MutableStateFlow<List<Int>>(emptyList())
    private var revisionCounter = 0

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

    val recent: StateFlow<List<Server>> = combine(_entries, _recentIds, _query, _selectedTags) { e, ids, q, t ->
        if (q.isNotEmpty() || t.isNotEmpty()) emptyList() else ids.mapNotNull { id -> findServer(e, id) }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())

    val menuRevision: StateFlow<Int> = combine(sessions.hibernated, stream.liveSessions, _identities, scripts.scripts) { _, _, _, _ -> ++revisionCounter }
        .stateIn(scope, SharingStarted.Eagerly, 0)

    init {
        scope.launch { _searchText.drop(1).debounce(300).collect { _query.value = it } }
        scope.launch {
            stream.entries.filterNotNull().collect {
                _entries.value = it
                _error.value = null
                _isLoading.value = false
            }
        }
        scope.launch { stream.identities.filterNotNull().collect { _identities.value = it } }
        scope.launch { sessions.sessions.map { it.size }.drop(1).collect { loadRecent() } }
    }

    fun onlineSummary(): String = "${ServerFilter.countOnline(_entries.value)} of ${totalServers.value} online"

    fun emptyTitle(): String = if (_query.value.isEmpty()) "No servers yet" else "No results"
    fun emptySubtitle(): String = if (_query.value.isEmpty()) "Add servers from the web dashboard" else "Try a different search term"

    @Throws(CancellationException::class)
    suspend fun load() {
        _isLoading.value = _entries.value.isEmpty()
        try {
            _entries.value = fetch()
            _error.value = null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            if (_entries.value.isEmpty()) _error.value = "Failed to load servers: ${e.message ?: e}"
        } finally {
            _isLoading.value = false
        }
        loadSupporting()
    }

    @Throws(Exception::class)
    suspend fun refresh() {
        _entries.value = fetch()
        _error.value = null
        loadSupporting()
    }

    private suspend fun loadSupporting() {
        if (stream.identities.value == null) _identities.value = safe(_identities.value) {
            api.getAs("/identities/list", "Failed to load identities", ListSerializer(Identity.serializer()))
        }
        loadRecent()
        safe(Unit) { scripts.load() }
    }

    private suspend fun loadRecent() {
        _recentIds.value = safe(_recentIds.value) {
            api.getAs("/entries/recent?limit=$RECENT_LIMIT", "Failed to load recent connections", ListSerializer(RecentConnection.serializer())).map { it.entryId }
        }
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

    private fun context() = ServerContext(
        _entries.value, _identities.value, sessions.hibernated.value, stream.liveSessions.value.orEmpty(), scripts.scripts.value.isNotEmpty(),
    )

    fun menu(server: Server): List<ServerMenuItem> = ConnectionRules.menu(server, context())

    fun primaryIntent(server: Server): ServerIntent = ServerIntent.Connect(server, null, null)

    fun plan(intent: ServerIntent): ConnectStep = ConnectionRules.plan(intent, context())

    fun request(server: Server, type: ConnectionType, identity: DirectIdentity?): ConnectRequest =
        ConnectionRules.request(server, type, null, identity, null, _entries.value)

    fun scriptRequest(server: Server, identityId: Int?, script: Script): ConnectRequest =
        ConnectionRules.request(server, ConnectionType.SCRIPT, identityId, null, script, _entries.value)

    @Throws(CancellationException::class)
    suspend fun scriptsFor(server: Server): List<Script> = scripts.scriptsFor(server)

    @Throws(Exception::class)
    suspend fun execute(intent: ServerIntent): ActionResult = when (intent) {
        is ServerIntent.Wake -> ActionResult(wake(intent.server), false)
        is ServerIntent.Power -> ActionResult(power(intent.server, intent.operation), false)
        is ServerIntent.Resume -> { sessions.resume(intent.sessionId); ActionResult(null, true) }
        is ServerIntent.Join -> { sessions.join(intent.session); ActionResult(null, true) }
        else -> ActionResult(null, false)
    }

    private suspend fun wake(server: Server): String {
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

    private suspend fun power(server: Server, operation: dev.gnm.nexterm.api.PowerOperation): String {
        val r = api.post("/integrations/entry/${server.id}/${operation.path}")
        val json = r.json().asObject()
        if (!r.isOk || (json?.int("code") ?: 0) >= 300) {
            throw NextermException(json?.let { it.str("message") ?: it.str("error") } ?: "Failed to ${operation.path} ${server.name} (${r.status})", r.status)
        }
        if (stream.entries.value == null) safe(Unit) { _entries.value = fetch() }
        return "${operation.done} ${server.name}"
    }

    fun close() = scope.cancel()

    private companion object {
        const val RECENT_LIMIT = 5

        fun findServer(entries: List<Entry>, id: Int): Server? {
            for (e in entries) when (e) {
                is Server -> if (e.entryId == id) return e
                is ServerFolder -> findServer(e.entries, id)?.let { return it }
            }
            return null
        }
    }
}
