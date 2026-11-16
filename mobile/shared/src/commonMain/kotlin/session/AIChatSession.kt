package dev.gnm.nexterm.session

import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

data class AIChatState(
    val messages: List<ChatMessage>,
    val isRunning: Boolean,
    val isReady: Boolean,
    val connectionError: String?,
    internal val retryAttempts: Int,
    internal val nextId: Int,
) {
    val inputHint: String get() = if (!isReady) "Connecting..." else "Message the assistant..."
    val isEmpty: Boolean get() = messages.isEmpty() && connectionError == null
}

class AIChatSession internal constructor(
    private val channel: AIAssistantChannel,
    private val scope: CoroutineScope,
    val serverName: String?,
) {
    private val _state = MutableStateFlow(AIChatState(emptyList(), false, false, null, 0, 0))
    private var retryJob: Job? = null
    private var closed = false

    val state: StateFlow<AIChatState> = _state.asStateFlow()

    internal fun start() = connect()

    private fun connect() {
        if (closed) return
        channel.connect(::handleEvent, ::handleClosed)
    }

    fun canSend(input: String): Boolean = input.trim().isNotEmpty() && _state.value.isReady && !_state.value.isRunning

    fun send(input: String): Boolean {
        val content = input.trim()
        if (!canSend(content)) return false
        channel.sendPrompt(content)
        _state.update { it.add(ChatRole.USER, text = content).copy(isRunning = true) }
        return true
    }

    fun stop() {
        channel.abort()
        _state.update { it.endStreaming().abortRunningTools().copy(isRunning = false) }
    }

    fun confirm(callId: String, allow: Boolean) {
        channel.confirm(callId, allow)
        _state.update { it.patchTool(callId, if (allow) ToolStatus.RUNNING else ToolStatus.DENIED, null, null) }
    }

    fun close() {
        closed = true
        retryJob?.cancel()
        channel.dispose()
    }

    internal fun handleEvent(msg: JsonObject) {
        val callId = msg.str("callId")
        _state.update { s ->
            when (msg.str("type")) {
                "ready" -> s.copy(isReady = true, retryAttempts = 0, connectionError = null)
                "text-delta" -> s.appendAssistant(msg.str("delta") ?: "")
                "tool-call" -> s.endStreaming().upsertTool(callId, msg, ToolStatus.RUNNING)
                "confirm-request" -> s.upsertTool(callId, msg, ToolStatus.AWAITING_CONFIRM)
                "tool-result" -> {
                    val result = msg["result"]
                    val denied = (result as? JsonObject)?.get("denied")?.toString() == "true"
                    s.patchTool(callId, if (denied) ToolStatus.DENIED else ToolStatus.DONE, result, null)
                }
                "tool-error" -> s.patchTool(callId, ToolStatus.ERROR, null, msg.str("error"))
                "done" -> s.endStreaming().copy(isRunning = false)
                "aborted" -> s.endStreaming().abortRunningTools().copy(isRunning = false)
                "error" -> s.endStreaming().copy(isRunning = false).add(ChatRole.SYSTEM, text = msg.str("message") ?: "Something went wrong.")
                else -> s
            }
        }
    }

    internal fun handleClosed(code: Int?, reason: String?) {
        if (closed) return
        var retryDelay: Long? = null
        _state.update { cur ->
            retryDelay = null
            val s = cur.endStreaming().abortRunningTools().copy(isReady = false, isRunning = false)
            when {
                code != null && code >= 4000 -> s.copy(connectionError = reason?.takeIf { it.isNotEmpty() } ?: LOST)
                code == 1000 || code == 1005 -> s
                s.retryAttempts + 1 <= MAX_RETRIES -> {
                    val attempts = s.retryAttempts + 1
                    retryDelay = (1000L * (1 shl attempts)).coerceIn(0, 10_000)
                    s.copy(retryAttempts = attempts, connectionError = "Connection lost. Reconnecting...")
                }
                else -> s.copy(retryAttempts = s.retryAttempts + 1, connectionError = LOST)
            }
        }
        retryDelay?.let { d ->
            retryJob?.cancel()
            retryJob = scope.launch {
                delay(d)
                connect()
            }
        }
    }

    internal companion object {
        const val MAX_RETRIES = 5
        const val LOST = "Connection to the assistant was lost."
    }
}

private fun AIChatState.add(role: ChatRole, text: String = "", streaming: Boolean = false, callId: String? = null,
                            tool: String? = null, args: JsonObject = JsonObject(emptyMap()), status: ToolStatus? = null) =
    copy(messages = messages + ChatMessage(nextId, role, text, streaming, callId, tool, args, status, null, null), nextId = nextId + 1)

private fun AIChatState.appendAssistant(delta: String): AIChatState {
    if (delta.isEmpty()) return this
    val last = messages.lastOrNull()
    return if (last != null && last.role == ChatRole.ASSISTANT && last.isStreaming)
        copy(messages = messages.dropLast(1) + last.copy(text = last.text + delta))
    else add(ChatRole.ASSISTANT, text = delta, streaming = true)
}

private fun AIChatState.endStreaming(): AIChatState {
    val last = messages.lastOrNull() ?: return this
    return if (last.role == ChatRole.ASSISTANT && last.isStreaming) copy(messages = messages.dropLast(1) + last.copy(isStreaming = false)) else this
}

private fun AIChatState.upsertTool(callId: String?, msg: JsonObject, status: ToolStatus): AIChatState {
    if (callId == null) return this
    val i = messages.indexOfFirst { it.role == ChatRole.TOOL && it.callId == callId }
    return if (i == -1) add(ChatRole.TOOL, callId = callId, tool = msg.str("tool"), args = msg["args"].asObject() ?: JsonObject(emptyMap()), status = status)
    else copy(messages = messages.toMutableList().also { it[i] = it[i].copy(status = status) })
}

private fun AIChatState.patchTool(callId: String?, status: ToolStatus, result: JsonElement?, error: String?): AIChatState {
    val i = messages.indexOfFirst { it.role == ChatRole.TOOL && it.callId == callId }
    if (callId == null || i == -1) return this
    return copy(messages = messages.toMutableList().also {
        val m = it[i]
        it[i] = m.copy(status = status, result = result ?: m.result, error = error ?: m.error)
    })
}

private fun AIChatState.abortRunningTools() = copy(messages = messages.map {
    if (it.role == ChatRole.TOOL && (it.status == ToolStatus.RUNNING || it.status == ToolStatus.AWAITING_CONFIRM)) it.copy(status = ToolStatus.ABORTED) else it
})
