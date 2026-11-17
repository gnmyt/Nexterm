package dev.gnm.nexterm.session

import io.ktor.client.HttpClient
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import dev.gnm.nexterm.state.TerminalSettings
import dev.gnm.nexterm.terminal.Terminal
import dev.gnm.nexterm.terminal.TerminalController
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class TerminalConnection internal constructor(
    http: HttpClient,
    url: () -> String,
    userAgent: String,
    scope: CoroutineScope,
    attachesToExistingShell: Boolean,
    settings: TerminalSettings,
    val viewOnly: Boolean = false,
) {
    private val _receivedData = MutableStateFlow(false)
    private val _error = MutableStateFlow<String?>(null)
    private val emulator = Terminal(TerminalSettings.SCROLLBACK_LINES).also {
        it.onOutput = ::send
        it.onResponse = ::respond
        it.onResize = ::resize
    }
    private var cols = 0
    private var rows = 0
    private var opened = attachesToExistingShell
    private var typed = !attachesToExistingShell

    private val socket = ReconnectingSocket(
        http, url, userAgent, scope,
        onOpen = {
            if (opened) typed = false
            opened = true
            _receivedData.value = false
            _error.value = null
            launch {
                delay(100)
                sendRaw(if (cols > 0 && rows > 0) "\u0001$cols,$rows" else "\u000180,30")
            }
        },
        onFrame = { frame ->
            if (frame is Frame.Text) {
                val text = frame.readText()
                _receivedData.value = true
                val data = if (text.startsWith("\u0002")) text.substring(1) else text
                emulator.write(data)
            }
        },
        onDown = { err -> if (err != null) _error.value = "Connection error: $err" },
    )

    val state: StateFlow<ConnectionState> = socket.state
    val receivedData: StateFlow<Boolean> = _receivedData.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()
    val controller = TerminalController(emulator, settings, scope)

    init {
        socket.start()
    }

    fun send(data: String) {
        if (viewOnly) return
        typed = true
        sendRaw(data)
    }

    private fun respond(data: String) {
        if (typed && !viewOnly) sendRaw(data)
    }

    private fun resize(cols: Int, rows: Int) {
        this.cols = cols
        this.rows = rows
        if (state.value == ConnectionState.CONNECTED) sendRaw("\u0001$cols,$rows")
    }

    fun reconnect() = socket.reconnect()

    fun clearError() {
        _error.value = null
    }

    internal fun close() {
        socket.close()
        emulator.close()
    }

    private fun sendRaw(data: String) {
        socket.send(Frame.Text(data))
    }
}
