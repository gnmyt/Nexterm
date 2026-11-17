package dev.gnm.nexterm.session

import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
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

enum class ConnectionState {
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    DISCONNECTED,
    CLOSED,
}

internal class ReconnectingSocket(
    private val http: HttpClient,
    private val url: () -> String,
    private val userAgent: String,
    private val scope: CoroutineScope,
    private val onOpen: suspend DefaultClientWebSocketSession.() -> Unit,
    private val onFrame: suspend (Frame) -> Unit,
    private val onDown: (String?) -> Unit,
    private val onEnded: () -> Unit = {},
    private val onLost: (fatal: Boolean) -> Unit = {},
    private val maxAttempts: Int = 5,
) {
    private val _state = MutableStateFlow(ConnectionState.CONNECTING)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val queue = Channel<Frame>(Channel.UNLIMITED)
    private var job: Job? = null
    private var closed = false

    fun start() {
        if (closed) return
        job?.cancel()
        job = scope.launch {
            var attempts = 0
            while (isActive) {
                _state.value = if (attempts == 0) ConnectionState.CONNECTING else ConnectionState.RECONNECTING
                var error: String? = null
                var close: CloseReason? = null
                try {
                    http.webSocket(url(), request = {
                        header(HttpHeaders.UserAgent, userAgent)
                        timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
                    }) {
                        attempts = 0
                        _state.value = ConnectionState.CONNECTED
                        val sender = launch { for (f in queue) send(f) }
                        try {
                            onOpen()
                            for (frame in incoming) onFrame(frame)
                        } finally {
                            sender.cancel()
                        }
                        close = withTimeoutOrNull(1000) { closeReason.await() }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Throwable) {
                    error = e.message ?: e.toString()
                }
                if (closed) break
                val reason = close
                val code = reason?.code?.toInt()
                if (reason != null && code != null && code >= 4000) {
                    onDown(reason.message.ifEmpty { "Connection closed ($code)" })
                    _state.value = ConnectionState.DISCONNECTED
                    onLost(true)
                    break
                }
                if (error == null && (code == 1000 || code == 1005)) {
                    onDown(null)
                    _state.value = ConnectionState.DISCONNECTED
                    onEnded()
                    break
                }
                onDown(error)
                if (attempts >= maxAttempts) {
                    _state.value = ConnectionState.DISCONNECTED
                    onLost(false)
                    break
                }
                attempts++
                _state.value = ConnectionState.RECONNECTING
                delay(attempts.coerceIn(1, 5) * 1000L)
            }
        }
    }

    fun send(frame: Frame) {
        if (!closed) queue.trySend(frame)
    }

    fun reconnect() {
        if (closed) return
        start()
    }

    fun close() {
        closed = true
        job?.cancel()
        queue.close()
        _state.value = ConnectionState.CLOSED
    }
}
