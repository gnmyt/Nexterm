package dev.gnm.nexterm.guacamole

import dev.gnm.nexterm.session.ConnectionState
import io.ktor.client.HttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class GuacamoleSession internal constructor(
    private val http: HttpClient,
    private val userAgent: String,
    private val webSocketUrl: String,
    private val connectData: String,
    val viewOnly: Boolean = false,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var clientJob: Job? = null
    private var client: GuacClient? = null
    private val _state = MutableStateFlow(ConnectionState.CONNECTING)
    private val _viewport = MutableStateFlow<GuacamoleViewport?>(null)
    private val viewportFlow = _viewport.asStateFlow()

    val state: StateFlow<ConnectionState> = _state.asStateFlow()
    val viewport: StateFlow<GuacamoleViewport?>
        get() {
            if (client == null) reconnect()
            return viewportFlow
        }

    internal fun reconnect() {
        clientJob?.cancel()
        _viewport.value?.dispose()
        client?.dispose()
        _state.value = ConnectionState.CONNECTING
        val newClient = GuacClient(webSocketUrl, http, userAgent, viewOnly)
        client = newClient
        _viewport.value = GuacamoleViewport(GuacamoleDisplayState(newClient))
        clientJob = scope.launch {
            newClient.state.collect {
                _state.value = when (it) {
                    GuacClientState.CONNECTED -> ConnectionState.CONNECTED
                    GuacClientState.DISCONNECTING, GuacClientState.DISCONNECTED -> ConnectionState.DISCONNECTED
                    else -> ConnectionState.CONNECTING
                }
            }
        }
        newClient.connect(connectData)
    }

    internal fun close() {
        _viewport.value?.dispose()
        client?.disconnect()
        client?.dispose()
        scope.cancel()
    }
}
