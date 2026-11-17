package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerAccount
import com.russhwolf.settings.Settings
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.guacamole.GuacamoleSession
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.stringOnly
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlin.random.Random
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.state.SftpSettings
import dev.gnm.nexterm.state.TerminalSettings
import dev.gnm.nexterm.state.AccountManager
import dev.gnm.nexterm.util.Uris
import dev.gnm.nexterm.util.asObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.job
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@Serializable
internal class RemoteSession(
    val sessionId: String,
    val entryId: Int,
    val isHibernated: Boolean = false,
    val configuration: Configuration? = null,
    val automated: Boolean = false,
    val origin: String? = null,
) {
    @Serializable
    class Configuration(val type: String? = null, val renderer: String? = null, val identityId: String? = null)
}

class SessionManager internal constructor(
    private val api: ApiClient,
    private val settings: Settings,
    private val accounts: AccountManager,
    private val sftpSettings: SftpSettings,
    private val terminalSettings: TerminalSettings,
    private val scope: CoroutineScope,
) {
    private val _sessions = MutableStateFlow<List<AppSession>>(emptyList())
    private val _activeSessionId = MutableStateFlow<String?>(null)
    private val restoreLock = Mutex()
    private val sessionScopes = mutableMapOf<String, CoroutineScope>()
    private val appInstanceId = "app_${Formatters.nowMillis()}_${randomString()}"
    private val deviceId: String by lazy {
        settings.getStringOrNull(DEVICE_ID_KEY) ?: "device_${Formatters.nowMillis()}_${randomString()}".also { settings.putString(DEVICE_ID_KEY, it) }
    }

    val sessions: StateFlow<List<AppSession>> = _sessions.asStateFlow()
    val activeSession: StateFlow<AppSession?> = combine(_sessions, _activeSessionId) { list, id -> list.firstOrNull { it.sessionId == id } }
        .stateIn(scope, SharingStarted.Eagerly, null)

    private val _fullscreen = MutableStateFlow(false)
    val fullscreen: StateFlow<Boolean> = _fullscreen.asStateFlow()

    val hasActiveSessions: Boolean get() = _sessions.value.isNotEmpty()

    fun setFullscreen(value: Boolean) {
        _fullscreen.value = value && _sessions.value.isNotEmpty()
    }

    private fun getSession(sessionId: String): AppSession? = _sessions.value.firstOrNull { it.sessionId == sessionId }

    @Throws(Exception::class)
    suspend fun createSession(request: ConnectRequest, connectionReason: String?): AppSession {
        val server = request.server
        val type = request.type
        val directIdentity = request.identity
        val account = accounts.activeAccount.value ?: throw NextermException("Not authenticated")
        val entryId = server.entryId ?: throw NextermException("Invalid entry id: ${server.id}")
        val identityId = if (directIdentity != null) null else server.identities.firstOrNull()
        val body = jsonOf(
            "entryId" to entryId,
            "tabId" to appInstanceId,
            "browserId" to deviceId,
            "identityId" to identityId?.takeIf { it > 0 },
            "connectionReason" to connectionReason,
            "type" to if (type == ConnectionType.SFTP) "sftp" else null,
            "directIdentity" to directIdentity?.toJson(),
        )
        val r = api.post("/connections", body)
        val sessionId = r.json().asObject()?.stringOnly("sessionId")?.takeIf { r.isOk }
            ?: throw NextermException("Failed to create session: ${r.status} - ${r.body}", r.status)
        val session = build(sessionId, server, type, account, identityId, restored = false)
        _sessions.update { it + session }
        _activeSessionId.value = session.sessionId
        return session
    }

    fun setActive(sessionId: String) {
        if (getSession(sessionId) != null) _activeSessionId.value = sessionId
    }

    @Throws(CancellationException::class)
    suspend fun restoreSessions() = restoreLock.withLock {
        val account = accounts.activeAccount.value ?: return@withLock
        try {
            val r = api.get("/connections?tabId=${Uris.encode(appInstanceId)}&browserId=${Uris.encode(deviceId)}")
            if (r.status != 200) return@withLock
            val remote = NextermJson.decodeFromString(ListSerializer(RemoteSession.serializer()), r.body)
            if (remote.isEmpty()) return@withLock
            val entries = mutableMapOf<Int, Server>()
            for (eid in remote.map { it.entryId }.toSet()) {
                try {
                    val r = api.get("/entries/$eid")
                    if (r.status == 200) entries[eid] = NextermJson.decodeFromString(Server.serializer(), r.body)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Throwable) {
                }
            }
            val restored = mutableListOf<AppSession>()
            for (s in remote) {
                if (getSession(s.sessionId) != null || s.isHibernated) continue
                val server = entries[s.entryId] ?: continue
                restored += build(s.sessionId, server, resolveType(s, server), account, s.configuration?.identityId?.toIntOrNull(), restored = true, agent = s.agentOrigin())
            }
            if (restored.isNotEmpty()) _sessions.update { it + restored }
            if (_sessions.value.isNotEmpty() && _activeSessionId.value == null) {
                _activeSessionId.value = (_sessions.value.firstOrNull { !it.isViewOnly } ?: _sessions.value.first()).sessionId
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
        }
    }

    @Throws(CancellationException::class)
    suspend fun closeSession(sessionId: String) {
        val session = getSession(sessionId) ?: return
        session.disconnect()
        sessionScopes.remove(sessionId)?.cancel()
        safe(Unit) { api.forBaseUrl(session.account.baseUrl, session.account.token).delete("/connections/$sessionId") }
        _sessions.update { list -> list.filterNot { it.sessionId == sessionId } }
        if (_activeSessionId.value == sessionId) _activeSessionId.value = _sessions.value.lastOrNull()?.sessionId
        if (_sessions.value.isEmpty()) _fullscreen.value = false
    }

    fun reconnect(session: AppSession) = session.reconnect()

    fun disconnectAll() {
        _sessions.value.forEach { it.disconnect() }
        sessionScopes.values.forEach { it.cancel() }
        sessionScopes.clear()
        _sessions.value = emptyList()
        _activeSessionId.value = null
        _fullscreen.value = false
    }

    private fun build(
        sessionId: String,
        server: Server,
        type: ConnectionType,
        account: ServerAccount,
        identityId: Int?,
        restored: Boolean,
        agent: AgentOrigin? = null,
    ): AppSession {
        val client = api.forBaseUrl(account.baseUrl, account.token)
        val sessionScope = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext.job))
        sessionScopes[sessionId] = sessionScope
        return when (type) {
            ConnectionType.TERMINAL -> {
                val query = buildMap {
                    put("sessionToken", account.token)
                    put("entryId", server.id ?: "")
                    put("sessionId", sessionId)
                    identityId?.let { put("identityId", it.toString()) }
                }
                val terminal = TerminalConnection(client.http, { client.webSocketUrl("/ws/term", query) }, client.userAgent, sessionScope, restored, terminalSettings, viewOnly = agent != null)
                AppSession(sessionId, server, type, account, terminal, null, null, agent)
            }
            ConnectionType.SFTP -> AppSession(sessionId, server, type, account, null, SftpBrowser(client, sessionId, account.token, sftpSettings, sessionScope), null, agent)
            ConnectionType.GUACAMOLE -> {
                val guacamole = GuacamoleSession(
                    client.http,
                    client.userAgent,
                    client.webSocketUrl("/ws/guac/"),
                    "sessionToken=${Uris.encode(account.token)}&sessionId=${Uris.encode(sessionId)}",
                    viewOnly = agent != null,
                )
                AppSession(sessionId, server, type, account, null, null, guacamole, agent)
            }
        }
    }

    private fun RemoteSession.agentOrigin(): AgentOrigin? = when {
        !automated -> null
        origin == "ai" -> AgentOrigin.AI
        else -> AgentOrigin.MCP
    }

    private fun resolveType(s: RemoteSession, server: Server): ConnectionType = when {
        s.configuration?.type == "sftp" || s.configuration?.renderer == "sftp" -> ConnectionType.SFTP
        server.isGuacamole || s.configuration?.renderer == "guac" -> ConnectionType.GUACAMOLE
        else -> ConnectionType.TERMINAL
    }

    private companion object {
        const val DEVICE_ID_KEY = "nexterm_device_id"
        const val CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
        fun randomString() = (1..9).map { CHARS[Random.nextInt(CHARS.length)] }.joinToString("")
    }
}
