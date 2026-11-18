package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.guacamole.GuacamoleSession
import dev.gnm.nexterm.model.LiveSession
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerAccount
import dev.gnm.nexterm.model.parseTimestamp
import dev.gnm.nexterm.state.AccountManager
import dev.gnm.nexterm.state.ClientIds
import dev.gnm.nexterm.state.ScriptManager
import dev.gnm.nexterm.state.SftpSettings
import dev.gnm.nexterm.state.StateStream
import dev.gnm.nexterm.state.TerminalSettings
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.Uris
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.str
import dev.gnm.nexterm.util.stringOnly
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

@Serializable
internal class RemoteSession(
    val sessionId: String,
    val entryId: Int,
    val isHibernated: Boolean = false,
    val configuration: Configuration? = null,
    val automated: Boolean = false,
    val origin: String? = null,
    val lastActivity: String? = null,
    val connectionGeneration: Int = 0,
) {
    @Serializable
    class Configuration(
        val type: String? = null,
        val renderer: String? = null,
        val identityId: String? = null,
        val connectionReason: String? = null,
        val scriptId: Int? = null,
    )
}

class SessionManager internal constructor(
    private val api: ApiClient,
    private val ids: ClientIds,
    private val accounts: AccountManager,
    private val sftpSettings: SftpSettings,
    private val terminalSettings: TerminalSettings,
    private val stream: StateStream,
    private val scripts: ScriptManager,
    private val scope: CoroutineScope,
) {
    private val _sessions = MutableStateFlow<List<AppSession>>(emptyList())
    private val _hibernated = MutableStateFlow<List<HibernatedSession>>(emptyList())
    private val _activeSessionId = MutableStateFlow<String?>(null)
    private val lock = Mutex()
    private val sessionScopes = mutableMapOf<String, CoroutineScope>()
    private val serverCache = mutableMapOf<Int, Server>()

    val sessions: StateFlow<List<AppSession>> = _sessions.asStateFlow()
    val hibernated: StateFlow<List<HibernatedSession>> = _hibernated.asStateFlow()
    val activeSession: StateFlow<AppSession?> = combine(_sessions, _activeSessionId) { list, id -> list.firstOrNull { it.sessionId == id } }
        .stateIn(scope, SharingStarted.Eagerly, null)

    private val _fullscreen = MutableStateFlow(false)
    val fullscreen: StateFlow<Boolean> = _fullscreen.asStateFlow()

    val hasActiveSessions: Boolean get() = _sessions.value.isNotEmpty()

    init {
        scope.launch { stream.connections.filterNotNull().collect { safe(Unit) { sync(it) } } }
        scope.launch { stream.liveSessions.filterNotNull().collect(::dropEndedJoins) }
    }

    fun setFullscreen(value: Boolean) {
        _fullscreen.value = value && _sessions.value.isNotEmpty()
    }

    private fun getSession(sessionId: String): AppSession? = _sessions.value.firstOrNull { it.sessionId == sessionId }

    private fun requireAccount(): ServerAccount = accounts.activeAccount.value ?: throw NextermException("Not authenticated")

    private fun clientFor(account: ServerAccount) = api.forBaseUrl(account.baseUrl, account.token)

    @Throws(Exception::class)
    suspend fun createSession(request: ConnectRequest, connectionReason: String?): AppSession {
        val origin = SessionOrigin(request.identityId, request.identity, connectionReason, typeParameter(request.type), request.script?.id)
        return open(request.server, request.type, origin, null, request.script?.name)
    }

    private suspend fun open(server: Server, type: ConnectionType, origin: SessionOrigin, startPath: String?, scriptName: String?): AppSession = lock.withLock {
        val account = requireAccount()
        val entryId = server.entryId ?: throw NextermException("Invalid entry id: ${server.id}")
        val body = jsonOf(
            "entryId" to entryId,
            "tabId" to ids.tabId,
            "browserId" to ids.browserId,
            "identityId" to origin.identityId?.takeIf { it > 0 },
            "connectionReason" to origin.connectionReason,
            "type" to origin.typeParameter,
            "scriptId" to origin.scriptId,
            "startPath" to startPath,
            "directIdentity" to origin.directIdentity?.toJson(),
        )
        val r = clientFor(account).post("/connections", body)
        val json = r.json().asObject()
        val sessionId = json?.stringOnly("sessionId")?.takeIf { r.isOk } ?: throw failure("Failed to connect", r.status, r.body)
        val session = build(sessionId, server, type, account, origin, restored = false, generation = json.int("connectionGeneration") ?: 0, scriptName = scriptName)
        add(session)
        session
    }

    @Throws(Exception::class)
    suspend fun resume(sessionId: String): AppSession {
        val paused = _hibernated.value.firstOrNull { it.sessionId == sessionId } ?: throw NextermException("Session is no longer available")
        return lock.withLock {
            val account = requireAccount()
            val r = clientFor(account).post("/connections/$sessionId/resume", jsonOf("tabId" to ids.tabId, "browserId" to ids.browserId))
            if (!r.isOk) throw failure("Failed to resume session", r.status, r.body)
            _hibernated.update { list -> list.filterNot { it.sessionId == sessionId } }
            getSession(sessionId)?.let { _activeSessionId.value = it.sessionId; return@withLock it }
            val origin = SessionOrigin(paused.identityId, null, null, typeParameter(paused.type), null)
            build(sessionId, paused.server, paused.type, account, origin, restored = true).also(::add)
        }
    }

    @Throws(Exception::class)
    suspend fun join(live: LiveSession): AppSession = lock.withLock {
        val localId = "$JOIN_PREFIX${live.id}"
        getSession(localId)?.let { _activeSessionId.value = localId; return@withLock it }
        val account = requireAccount()
        val server = serverFor(live.entryId, account) ?: Server(id = live.entryId.toString(), name = live.entryName ?: "Server", type = live.protocol ?: "server", renderer = live.renderer)
        val type = when {
            live.type == "web" || live.renderer == "web" -> ConnectionType.BROWSER
            live.renderer == "guac" || server.isGuacamole -> ConnectionType.GUACAMOLE
            else -> ConnectionType.TERMINAL
        }
        val origin = SessionOrigin(null, null, null, null, null, joinedSessionId = live.id)
        val message = if (live.writable) null else "You joined ${live.ownerName}'s session as a viewer. You can watch, but not type."
        build(localId, server, type, account, origin, restored = true, viewOnlyMessage = message).also(::add)
    }

    fun setActive(sessionId: String) {
        if (getSession(sessionId) != null) _activeSessionId.value = sessionId
    }

    @Throws(Exception::class)
    suspend fun perform(session: AppSession, action: SessionAction): String? {
        when (action) {
            SessionAction.CLOSE -> closeSession(session.sessionId)
            SessionAction.RECONNECT -> reconnect(session)
            SessionAction.HIBERNATE -> hibernate(session)
            SessionAction.DUPLICATE -> duplicate(session)
            SessionAction.OPEN_FILES -> open(session.server, ConnectionType.SFTP, session.origin.copy(typeParameter = "sftp", scriptId = null), null, null)
            SessionAction.OPEN_TERMINAL -> open(
                session.server, ConnectionType.TERMINAL, session.origin.copy(typeParameter = "terminal", scriptId = null),
                session.sftp?.currentPath?.value, null,
            )
        }
        return when (action) {
            SessionAction.HIBERNATE -> "${session.server.name} hibernated"
            else -> null
        }
    }

    private suspend fun hibernate(session: AppSession) {
        val r = clientFor(session.account).post("/connections/${session.sessionId}/hibernate")
        if (!r.isOk) throw failure("Failed to hibernate session", r.status, r.body)
        lock.withLock {
            drop(session.sessionId)
            _hibernated.update { list ->
                list.filterNot { it.sessionId == session.sessionId } +
                    HibernatedSession(session.sessionId, session.server, session.type, session.origin.identityId, Formatters.nowMillis())
            }
        }
    }

    private suspend fun duplicate(session: AppSession) = lock.withLock {
        val r = clientFor(session.account).post("/connections/${session.sessionId}/duplicate", jsonOf("tabId" to ids.tabId, "browserId" to ids.browserId))
        val json = r.json().asObject()
        val sessionId = json?.stringOnly("sessionId")?.takeIf { r.isOk } ?: throw failure("Failed to duplicate session", r.status, r.body)
        add(build(sessionId, session.server, session.type, session.account, session.origin, restored = false, generation = json.int("connectionGeneration") ?: 0))
    }

    @Throws(Exception::class)
    suspend fun reconnect(session: AppSession) {
        session.lastRecovery = Formatters.nowMillis()
        if (session.isJoined) return session.reconnect()
        val origin = session.origin
        val body = jsonOf(
            "entryId" to session.server.entryId,
            "tabId" to ids.tabId,
            "browserId" to ids.browserId,
            "identityId" to origin.identityId?.takeIf { it > 0 },
            "connectionReason" to origin.connectionReason,
            "type" to origin.typeParameter,
            "scriptId" to origin.scriptId,
            "directIdentity" to origin.directIdentity?.toJson(),
            "connectionGeneration" to session.generation,
        )
        val r = clientFor(session.account).post("/connections/${session.sessionId}/reconnect", body)
        when {
            r.isOk -> {
                session.generation = r.json().asObject()?.int("connectionGeneration") ?: session.generation
                session.reconnect()
            }
            r.status == 410 -> {
                lock.withLock { drop(session.sessionId) }
                throw NextermException("${session.server.name}: the session was closed")
            }
            r.status == 404 && r.json().asObject()?.str("error") == "Session not found" -> session.reconnect()
            else -> throw failure("Failed to reconnect", r.status, r.body)
        }
    }

    private fun recover(sessionId: String) {
        val session = getSession(sessionId) ?: return
        if (Formatters.nowMillis() - session.lastRecovery < RECOVERY_INTERVAL_MS) return
        scope.launch { safe(Unit) { reconnect(session) } }
    }

    @Throws(CancellationException::class)
    suspend fun restoreSessions() {
        val account = accounts.activeAccount.value ?: return
        safe(Unit) {
            val r = clientFor(account).get("/connections?tabId=${Uris.encode(ids.tabId)}&browserId=${Uris.encode(ids.browserId)}")
            if (r.status == 200) sync(NextermJson.decodeFromString(ListSerializer(RemoteSession.serializer()), r.body))
        }
        stream.wake()
    }

    private suspend fun sync(remote: List<RemoteSession>) {
        val account = accounts.activeAccount.value ?: return
        val servers = remote.map { it.entryId }.toSet().mapNotNull { id -> serverFor(id, account)?.let { id to it } }.toMap()
        lock.withLock {
            if (accounts.activeAccount.value?.id != account.id) return
            _hibernated.value = remote.filter { it.isHibernated }.mapNotNull { s ->
                val server = servers[s.entryId] ?: return@mapNotNull null
                HibernatedSession(s.sessionId, server, resolveType(s, server), s.configuration?.identityId?.toIntOrNull(), parseTimestamp(s.lastActivity))
            }.sortedByDescending { it.lastActivity ?: 0 }
            remote.filter { it.isHibernated }.forEach { s -> if (getSession(s.sessionId) != null) drop(s.sessionId) }
            val restored = remote.filter { !it.isHibernated && getSession(it.sessionId) == null }.mapNotNull { s ->
                val server = servers[s.entryId] ?: return@mapNotNull null
                val config = s.configuration
                val origin = SessionOrigin(config?.identityId?.toIntOrNull(), null, config?.connectionReason, config?.type, config?.scriptId)
                build(s.sessionId, server, resolveType(s, server), account, origin, restored = true, agent = s.agentOrigin(), generation = s.connectionGeneration,
                    scriptName = config?.scriptId?.let(scripts::nameOf))
            }
            if (restored.isNotEmpty()) _sessions.update { it + restored }
            if (_sessions.value.isNotEmpty() && getSession(_activeSessionId.value ?: "") == null) {
                _activeSessionId.value = (_sessions.value.firstOrNull { !it.isViewOnly } ?: _sessions.value.first()).sessionId
            }
        }
    }

    private suspend fun dropEndedJoins(live: List<LiveSession>) {
        val alive = live.map { it.id }.toSet()
        lock.withLock { _sessions.value.filter { it.origin.joinedSessionId?.let { id -> id !in alive } == true }.forEach { drop(it.sessionId) } }
    }

    private suspend fun serverFor(entryId: Int, account: ServerAccount): Server? {
        findInTree(entryId)?.let { return it }
        serverCache[entryId]?.let { return it }
        return safe(null) {
            val r = clientFor(account).get("/entries/$entryId")
            if (r.status == 200) NextermJson.decodeFromString(Server.serializer(), r.body).also { serverCache[entryId] = it } else null
        }
    }

    private fun findInTree(entryId: Int): Server? {
        fun walk(list: List<dev.gnm.nexterm.model.Entry>): Server? {
            for (e in list) when (e) {
                is Server -> if (e.entryId == entryId) return e
                is dev.gnm.nexterm.model.ServerFolder -> walk(e.entries)?.let { return it }
            }
            return null
        }
        return walk(stream.entries.value ?: return null)
    }

    @Throws(CancellationException::class)
    suspend fun closeSession(sessionId: String) {
        val session = getSession(sessionId) ?: return
        lock.withLock { drop(sessionId) }
        if (!session.isJoined) safe(Unit) { clientFor(session.account).delete("/connections/$sessionId") }
    }

    fun reconnect(sessionId: String) {
        val session = getSession(sessionId) ?: return
        scope.launch { safe(Unit) { reconnect(session) } }
    }

    fun disconnectAll() {
        _sessions.value.forEach { it.disconnect() }
        sessionScopes.values.forEach { it.cancel() }
        sessionScopes.clear()
        serverCache.clear()
        _sessions.value = emptyList()
        _hibernated.value = emptyList()
        _activeSessionId.value = null
        _fullscreen.value = false
    }

    private fun add(session: AppSession) {
        _sessions.update { it + session }
        _activeSessionId.value = session.sessionId
    }

    private fun drop(sessionId: String) {
        val session = getSession(sessionId) ?: return
        session.disconnect()
        sessionScopes.remove(sessionId)?.cancel()
        _sessions.update { list -> list.filterNot { it.sessionId == sessionId } }
        if (_activeSessionId.value == sessionId) _activeSessionId.value = _sessions.value.lastOrNull()?.sessionId
        if (_sessions.value.isEmpty()) _fullscreen.value = false
    }

    private fun build(
        sessionId: String,
        server: Server,
        type: ConnectionType,
        account: ServerAccount,
        origin: SessionOrigin,
        restored: Boolean,
        agent: AgentOrigin? = null,
        generation: Int = 0,
        scriptName: String? = null,
        viewOnlyMessage: String? = agent?.viewOnlyMessage,
    ): AppSession {
        val client = clientFor(account)
        val sessionScope = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext.job))
        sessionScopes[sessionId] = sessionScope
        val viewOnly = viewOnlyMessage != null
        val joined = origin.joinedSessionId
        val target = if (joined != null) "joinSessionId" to joined else "sessionId" to sessionId
        val ended: () -> Unit = { scope.launch { closeSession(sessionId) } }
        val lost: (Boolean) -> Unit = { recover(sessionId) }
        fun session(terminal: TerminalConnection? = null, sftp: SftpBrowser? = null, guac: GuacamoleSession? = null, script: ScriptRun? = null, browser: BrowserControl? = null) =
            AppSession(sessionId, server, type, account, terminal, sftp, guac, agent, script, browser, viewOnlyMessage, origin, generation)
        return when (type) {
            ConnectionType.TERMINAL, ConnectionType.SCRIPT -> {
                val script = if (type == ConnectionType.SCRIPT) ScriptRun(scriptName) else null
                val query = buildMap {
                    put("sessionToken", account.token)
                    if (joined == null) put("entryId", server.id ?: "")
                    put(target.first, target.second)
                    origin.identityId?.let { put("identityId", it.toString()) }
                }
                session(terminal = TerminalConnection(client.http, { client.webSocketUrl("/ws/term", query) }, client.userAgent, sessionScope, restored,
                    terminalSettings, viewOnly, script, ended, lost), script = script)
            }
            ConnectionType.SFTP -> session(sftp = SftpBrowser(client, sessionId, account.token, sftpSettings, sessionScope, ended, lost))
            ConnectionType.GUACAMOLE, ConnectionType.BROWSER -> {
                val browser = if (type == ConnectionType.BROWSER) BrowserControl(!viewOnly) else null
                val guacamole = GuacamoleSession(
                    client.http, client.userAgent, client.webSocketUrl("/ws/guac/"),
                    "sessionToken=${Uris.encode(account.token)}&${target.first}=${Uris.encode(target.second)}", viewOnly, browser,
                )
                session(guac = guacamole, browser = browser)
            }
        }
    }

    private fun RemoteSession.agentOrigin(): AgentOrigin? = when {
        !automated -> null
        origin == "ai" -> AgentOrigin.AI
        else -> AgentOrigin.MCP
    }

    private fun resolveType(s: RemoteSession, server: Server): ConnectionType {
        val config = s.configuration
        return when {
            config?.scriptId != null -> ConnectionType.SCRIPT
            config?.type == "sftp" || config?.renderer == "sftp" -> ConnectionType.SFTP
            config?.type == "web" || config?.renderer == "web" -> ConnectionType.BROWSER
            config?.renderer == "guac" || server.isGuacamole -> ConnectionType.GUACAMOLE
            config?.renderer == "terminal" || config?.type == "terminal" -> ConnectionType.TERMINAL
            else -> dev.gnm.nexterm.api.ConnectionRules.defaultType(server)
        }
    }

    private fun typeParameter(type: ConnectionType): String? = when (type) {
        ConnectionType.SFTP -> "sftp"
        ConnectionType.BROWSER -> "web"
        else -> null
    }

    private fun failure(prefix: String, status: Int, body: String): NextermException {
        val message = dev.gnm.nexterm.util.parseJsonOrNull(body).asObject()?.let { it.str("error") ?: it.str("message") }
        return NextermException(if (message != null) "$prefix: $message" else "$prefix ($status)", status)
    }

    private companion object {
        const val JOIN_PREFIX = "join-"
        const val RECOVERY_INTERVAL_MS = 30_000L
    }
}

private fun SessionOrigin.copy(typeParameter: String?, scriptId: Int?) =
    SessionOrigin(identityId, directIdentity, connectionReason, typeParameter, scriptId, joinedSessionId)
