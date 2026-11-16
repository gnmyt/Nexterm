package dev.gnm.nexterm.guacamole

import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.concurrent.atomics.AtomicBoolean
import kotlin.time.Clock

internal enum class GuacTunnelState { CONNECTING, OPEN, CLOSED, UNSTABLE }

internal class GuacWebSocketTunnel(
    private val tunnelUrl: String,
    private val http: HttpClient,
    private val userAgent: String,
    private val onInstruction: (opcode: String, args: List<String>) -> Unit,
    private val onClosed: (GuacStatus) -> Unit,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default.limitedParallelism(1))
    private var state = GuacTunnelState.CLOSED
    private var outgoing = Channel<String>(Channel.UNLIMITED)
    private var socketJob: Job? = null
    private var session: DefaultClientWebSocketSession? = null
    private var receiveTimer: Job? = null
    private var unstableTimer: Job? = null
    private var pingTimer: Job? = null
    private var lastSentPing = 0L
    private val closed = AtomicBoolean(true)

    val isConnected: Boolean get() = state == GuacTunnelState.OPEN || state == GuacTunnelState.UNSTABLE

    private fun now() = Clock.System.now().toEpochMilliseconds()

    private fun resetTimers() {
        cancelTimers()
        if (state == GuacTunnelState.UNSTABLE) state = GuacTunnelState.OPEN
        receiveTimer = scope.launch {
            delay(RECEIVE_TIMEOUT)
            closeTunnel(GuacStatus(GuacStatus.UPSTREAM_TIMEOUT, "Server timeout."))
        }
        unstableTimer = scope.launch {
            delay(UNSTABLE_THRESHOLD)
            state = GuacTunnelState.UNSTABLE
        }
        val pingDelay = (lastSentPing + PING_FREQUENCY - now()).coerceIn(0, PING_FREQUENCY)
        if (pingDelay > 0) {
            pingTimer = scope.launch {
                delay(pingDelay)
                sendPing()
            }
        } else {
            sendPing()
        }
    }

    private fun sendPing() {
        val now = now()
        sendMessage(GUAC_INTERNAL_DATA_OPCODE, "ping", now)
        lastSentPing = now
    }

    private fun cancelTimers() {
        receiveTimer?.cancel()
        unstableTimer?.cancel()
        pingTimer?.cancel()
    }

    private fun closeTunnel(status: GuacStatus) {
        cancelTimers()
        if (!closed.compareAndSet(expectedValue = false, newValue = true)) return
        state = GuacTunnelState.CLOSED
        onClosed(status)
        outgoing.close()
        val job = socketJob
        val ws = session
        scope.launch {
            runCatching { withTimeoutOrNull(1_000) { ws?.close() } }
            job?.cancel()
        }
    }

    fun sendMessage(vararg elements: Any) {
        if (!isConnected || elements.isEmpty()) return
        outgoing.trySend(GuacParser.encode(elements.asList()))
    }

    fun connect(data: String) {
        closed.store(false)
        outgoing = Channel(Channel.UNLIMITED)
        val queue = outgoing
        val url = if ('?' in tunnelUrl) "$tunnelUrl&$data" else "$tunnelUrl?$data"

        resetTimers()
        state = GuacTunnelState.CONNECTING

        val parser = GuacParser { opcode, args ->
            if (state == GuacTunnelState.CONNECTING) state = GuacTunnelState.OPEN
            if (opcode != GUAC_INTERNAL_DATA_OPCODE) onInstruction(opcode, args)
        }

        socketJob = scope.launch {
            try {
                http.webSocket(urlString = url, request = {
                    header(HttpHeaders.SecWebSocketProtocol, "guacamole")
                    header(HttpHeaders.UserAgent, userAgent)
                    timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
                }) {
                    session = this
                    launch { for (message in queue) send(Frame.Text(message)) }
                    for (frame in incoming) {
                        if (frame !is Frame.Text) continue
                        resetTimers()
                        try {
                            parser.receive(frame.readText())
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            closeTunnel(GuacStatus(GuacStatus.SERVER_ERROR, e.message ?: e.toString()))
                        }
                    }
                }
                closeTunnel(GuacStatus(GuacStatus.SUCCESS, "Connection closed."))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                closeTunnel(GuacStatus(GuacStatus.UPSTREAM_ERROR, e.message ?: e.toString()))
            } finally {
                session = null
            }
        }
    }

    fun disconnect() {
        closeTunnel(GuacStatus(GuacStatus.SUCCESS, "Manually closed."))
    }

    fun dispose() {
        disconnect()
        scope.launch {
            socketJob?.join()
            scope.cancel()
        }
    }

    private companion object {
        const val PING_FREQUENCY = 500L
        const val RECEIVE_TIMEOUT = 15_000L
        const val UNSTABLE_THRESHOLD = 1_500L
        const val GUAC_INTERNAL_DATA_OPCODE = ""
    }
}
