package dev.gnm.nexterm.guacamole

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import io.ktor.client.HttpClient
import kotlin.io.encoding.Base64
import kotlin.math.floor
import kotlin.concurrent.Volatile

enum class GuacClientState { IDLE, CONNECTING, WAITING, CONNECTED, DISCONNECTING, DISCONNECTED }

class GuacClient internal constructor(url: String, http: HttpClient, userAgent: String, val viewOnly: Boolean = false) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val tunnel = GuacWebSocketTunnel(url, http, userAgent, ::onInstruction, ::onClosed)
    internal lateinit var display: GuacamoleDisplayState

    private val _state = MutableStateFlow(GuacClientState.IDLE)
    val state: StateFlow<GuacClientState> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun clearError() {
        _error.value = null
    }

    private val streams = HashMap<Int, GuacInputStream>()
    private var nextOutputStream = 0
    internal var onPipe: ((name: String, text: String) -> Unit)? = null
    private var currentTimestamp = 0L
    private var keepAliveJob: Job? = null
    @Volatile
    private var activity = 0L

    val isConnected: Boolean
        get() = _state.value == GuacClientState.WAITING || _state.value == GuacClientState.CONNECTED

    private fun setState(newState: GuacClientState) {
        _state.value = newState
    }

    private fun onInstruction(opcode: String, args: List<String>) {
        activity++
        try {
            dispatch(opcode, args)
        } catch (_: NumberFormatException) {
        } catch (_: IndexOutOfBoundsException) {
        }
    }

    private fun onClosed(status: GuacStatus) {
        if (status.isError) _error.value = status.message
        if (_state.value != GuacClientState.DISCONNECTING) {
            keepAliveJob?.cancel()
            setState(GuacClientState.DISCONNECTED)
        }
    }

    fun connect(data: String) {
        setState(GuacClientState.CONNECTING)
        _error.value = null
        try {
            tunnel.connect(data)
        } catch (e: Exception) {
            setState(GuacClientState.IDLE)
            throw e
        }
        startKeepAlive()
        setState(GuacClientState.WAITING)
    }

    fun disconnect() {
        val s = _state.value
        if (s == GuacClientState.DISCONNECTED || s == GuacClientState.DISCONNECTING) return
        setState(GuacClientState.DISCONNECTING)
        keepAliveJob?.cancel()
        tunnel.disconnect()
        setState(GuacClientState.DISCONNECTED)
    }

    fun dispose() {
        disconnect()
        scope.cancel()
        tunnel.dispose()
        display.disposeAll()
    }

    private fun startKeepAlive() {
        keepAliveJob?.cancel()
        keepAliveJob = scope.launch {
            var seen = activity
            var idleMillis = 0L
            while (isActive) {
                delay(KEEP_ALIVE_TICK_MILLIS)
                val current = activity
                idleMillis = if (current != seen) 0 else idleMillis + KEEP_ALIVE_TICK_MILLIS
                seen = current
                if (idleMillis >= KEEP_ALIVE_MILLIS) {
                    if (isConnected) tunnel.sendMessage("nop")
                    idleMillis = 0
                }
            }
        }
    }

    fun sendMouseState(mouse: GuacMouseState) {
        if (!isConnected || viewOnly) return
        display.moveCursor(mouse.x, mouse.y)
        tunnel.sendMessage("mouse", floor(mouse.x).toInt(), floor(mouse.y).toInt(), mouse.buttonMask)
    }

    fun sendKeyEvent(pressed: Boolean, keysym: Int) {
        if (!isConnected || viewOnly) return
        tunnel.sendMessage("key", keysym, if (pressed) 1 else 0)
    }

    fun sendKeyPress(keysym: Int, holdMillis: Long = 50) {
        sendKeyEvent(true, keysym)
        later(holdMillis) { sendKeyEvent(false, keysym) }
    }

    internal fun later(delayMillis: Long, block: () -> Unit) {
        scope.launch {
            delay(delayMillis)
            block()
        }
    }

    fun sendKeyPress(keysym: Int) = sendKeyPress(keysym, 50)

    fun sendText(text: String) {
        GuacKeysym.forText(text).forEach { sendKeyPress(it) }
    }

    fun sendSize(width: Int, height: Int) {
        if (!isConnected) return
        tunnel.sendMessage("size", width, height)
    }

    internal fun sendPipe(name: String, mimetype: String, text: String) {
        if (!isConnected || viewOnly) return
        val index = nextOutputStream++
        tunnel.sendMessage("pipe", index, mimetype, name)
        text.encodeToByteArray().asList().chunked(PIPE_CHUNK_BYTES).forEach { tunnel.sendMessage("blob", index, Base64.encode(it.toByteArray())) }
        tunnel.sendMessage("end", index)
    }

    fun sendAck(streamIndex: Int, message: String, code: Int) {
        if (!isConnected) return
        tunnel.sendMessage("ack", streamIndex, message, code)
    }

    private fun receiveBytes(streamIndex: Int, onComplete: (ByteArray) -> Unit) {
        val stream = GuacInputStream(streamIndex)
        streams[streamIndex] = stream
        val chunks = ArrayList<ByteArray>()
        stream.onBlob = { data -> decodeBase64(data)?.let(chunks::add) }
        stream.onEnd = {
            val out = ByteArray(chunks.sumOf { it.size })
            var pos = 0
            chunks.forEach { it.copyInto(out, pos); pos += it.size }
            onComplete(out)
        }
    }

    private fun drainStream(streamIndex: Int) {
        sendAck(streamIndex, "OK", GuacStatus.SUCCESS)
        streams[streamIndex] = GuacInputStream(streamIndex)
    }

    private fun dispatch(opcode: String, a: List<String>) {
        val d = display
        fun i(n: Int) = a[n].toInt()
        fun f(n: Int) = a[n].toDouble()
        when (opcode) {
            "png", "jpeg" -> decodeBase64(a[4])?.let {
                d.drawImage(i(1), i(0), i(2), i(3), "image/$opcode", it)
            }
            "img" -> {
                val streamIndex = i(0)
                val mask = i(1)
                val layer = i(2)
                val mimetype = a[3]
                val x = i(4)
                val y = i(5)
                receiveBytes(streamIndex) { d.drawImage(layer, mask, x, y, mimetype, it) }
                sendAck(streamIndex, "OK", GuacStatus.SUCCESS)
            }
            "copy" -> d.copy(i(0), i(1), i(2), i(3), i(4), i(5), i(6), i(7), i(8))
            "transfer" -> {
                val fn = i(5)
                if (fn != TRANSFER_NOOP) d.transfer(i(0), i(1), i(2), i(3), i(4), fn, i(6), i(7), i(8))
            }
            "rect" -> d.rect(i(0), i(1), i(2), i(3), i(4))
            "cfill" -> d.fillColor(i(1), i(0), i(2), i(3), i(4), i(5))
            "size" -> d.resize(i(0), i(1), i(2))
            "move" -> {
                val layer = i(0)
                val parent = i(1)
                if (layer > 0 && parent >= 0) d.move(layer, parent, i(2), i(3), i(4))
            }
            "shade" -> if (i(0) >= 0) d.shade(i(0), i(1))
            "dispose" -> if (i(0) != 0) d.dispose(i(0))
            "cursor" -> d.setCursor(i(0), i(1), i(2), i(3), i(4), i(5), i(6))
            "mouse" -> {
                d.showCursor(true)
                d.moveCursor(f(0), f(1))
            }
            "sync" -> {
                val timestamp = a[0].toLong()
                val frames = a.getOrNull(1)?.toIntOrNull() ?: 0
                d.flush(timestamp, frames)
                if (timestamp != currentTimestamp) {
                    tunnel.sendMessage("sync", timestamp)
                    currentTimestamp = timestamp
                }
                if (_state.value == GuacClientState.WAITING) setState(GuacClientState.CONNECTED)
            }
            "blob" -> streams[i(0)]?.onBlob?.invoke(a[1])
            "end" -> streams.remove(i(0))?.onEnd?.invoke()
            "audio", "video" -> drainStream(i(0))
            "pipe" -> {
                val handler = onPipe
                val name = a[2]
                if (handler == null) sendAck(i(0), "Unsupported", GuacStatus.UNSUPPORTED)
                else {
                    receiveBytes(i(0)) { handler(name, it.decodeToString()) }
                    sendAck(i(0), "OK", GuacStatus.SUCCESS)
                }
            }
            "clipboard", "file", "argv" -> sendAck(i(0), "Unsupported", GuacStatus.UNSUPPORTED)
            "body" -> sendAck(i(1), "Receipt of body unsupported", GuacStatus.UNSUPPORTED)
            "error" -> {
                _error.value = a[0]
                disconnect()
            }
            "disconnect" -> disconnect()
        }
    }

    private companion object {
        const val KEEP_ALIVE_MILLIS = 5_000L
        const val KEEP_ALIVE_TICK_MILLIS = 500L
        const val TRANSFER_NOOP = 0x5
        const val PIPE_CHUNK_BYTES = 4096

        fun decodeBase64(data: String): ByteArray? = try {
            Base64.decode(data)
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
