package dev.gnm.nexterm.state

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.EntryParser
import dev.gnm.nexterm.model.Identity
import dev.gnm.nexterm.model.LiveSession
import dev.gnm.nexterm.model.ServerAccount
import dev.gnm.nexterm.session.RemoteSession
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.asArray
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.parseJsonOrNull
import dev.gnm.nexterm.util.str
import io.ktor.client.plugins.timeout
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement

class StateStream internal constructor(
    private val api: ApiClient,
    private val ids: ClientIds,
    private val scope: CoroutineScope,
    private val onLogout: suspend (ServerAccount) -> Unit,
) {
    private var job: Job? = null
    private var outgoing = Channel<String>(Channel.UNLIMITED)
    private var account: ServerAccount? = null

    private val _isConnected = MutableStateFlow(false)
    private val _entries = MutableStateFlow<List<Entry>?>(null)
    private val _connections = MutableStateFlow<List<RemoteSession>?>(null)
    private val _liveSessions = MutableStateFlow<List<LiveSession>?>(null)
    private val _identities = MutableStateFlow<List<Identity>?>(null)

    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    val entries: StateFlow<List<Entry>?> = _entries.asStateFlow()
    internal val connections: StateFlow<List<RemoteSession>?> = _connections.asStateFlow()
    val liveSessions: StateFlow<List<LiveSession>?> = _liveSessions.asStateFlow()
    val identities: StateFlow<List<Identity>?> = _identities.asStateFlow()

    internal fun start(account: ServerAccount) {
        if (this.account?.id == account.id && job?.isActive == true) return
        stop()
        this.account = account
        val out = Channel<String>(Channel.UNLIMITED).also { outgoing = it }
        val client = api.forBaseUrl(account.baseUrl, account.token)
        job = scope.launch {
            var backoff = MIN_BACKOFF
            while (isActive) {
                var code: Int? = null
                try {
                    val url = client.webSocketUrl("/ws/state", mapOf("sessionToken" to account.token, "tabId" to ids.tabId, "browserId" to ids.browserId))
                    client.http.webSocket(url, request = {
                        header(HttpHeaders.UserAgent, client.userAgent)
                        timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
                    }) {
                        _isConnected.value = true
                        backoff = MIN_BACKOFF
                        val sender = launch { for (m in out) send(Frame.Text(m)) }
                        try {
                            for (frame in incoming) if (frame is Frame.Text) handle(frame.readText(), account)
                        } finally {
                            sender.cancel()
                        }
                        code = withTimeoutOrNull(1000) { closeReason.await() }?.code?.toInt()
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Throwable) {
                }
                _isConnected.value = false
                if (code == LOGOUT_CODE || code == INVALID_TOKEN_CODE) {
                    onLogout(account)
                    break
                }
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF)
            }
        }
    }

    internal fun stop() {
        job?.cancel()
        job = null
        outgoing.close()
        account = null
        _isConnected.value = false
        _entries.value = null
        _connections.value = null
        _liveSessions.value = null
        _identities.value = null
    }

    internal fun wake() {
        val current = account ?: return
        if (_isConnected.value) refresh() else {
            job?.cancel()
            job = null
            start(current)
        }
    }

    fun refresh(type: String? = null) {
        outgoing.trySend(jsonOf("action" to "refresh", "type" to type).toString())
    }

    private suspend fun handle(text: String, account: ServerAccount) {
        val msg = parseJsonOrNull(text).asObject() ?: return
        val data = msg["data"]
        try {
            when (msg.str("type")) {
                "ENTRIES" -> _entries.value = EntryParser.parseList(data.asArray() ?: JsonArray(emptyList()))
                "CONNECTIONS" -> _connections.value = decode(data, RemoteSession.serializer())
                "LIVE_SESSIONS" -> _liveSessions.value = decode(data, LiveSession.serializer())
                "IDENTITIES" -> _identities.value = decode(data, Identity.serializer())
                "LOGOUT" -> onLogout(account)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
        }
    }

    private fun <T> decode(data: JsonElement?, serializer: kotlinx.serialization.KSerializer<T>): List<T> =
        NextermJson.decodeFromJsonElement(ListSerializer(serializer), data ?: JsonArray(emptyList()))

    private companion object {
        const val LOGOUT_CODE = 4010
        const val INVALID_TOKEN_CODE = 4003
        const val MIN_BACKOFF = 3_000L
        const val MAX_BACKOFF = 30_000L
    }
}
