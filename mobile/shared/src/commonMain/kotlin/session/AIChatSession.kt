package dev.gnm.nexterm.session

import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.util.arr
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
import dev.gnm.nexterm.util.jsonOf
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

enum class ApprovalMode(val wire: String, val label: String, val detail: String, val iconKey: String) {
    ASK("ask", "Ask First", "Confirm every action that changes something", "help-circle-outline"),
    ALLOW("allow", "Allow All", "Run actions without asking", "play"),
    READONLY("readonly", "Read-Only", "Never change anything on your servers", "lock-outline");

    companion object {
        fun parse(value: String?): ApprovalMode = entries.firstOrNull { it.wire == value } ?: ASK
    }
}

data class AIChatState(
    val messages: List<ChatMessage>,
    val isRunning: Boolean,
    val isReady: Boolean,
    val connectionError: String?,
    val allowedServers: List<Server> = emptyList(),
    val activeEntryId: Int? = null,
    val approvalMode: ApprovalMode = ApprovalMode.ASK,
    val canContinue: Boolean = false,
    val agentSessionCount: Int = 0,
    val isUnavailable: Boolean = false,
    internal val retryAttempts: Int = 0,
    internal val nextId: Int = 0,
) {
    val inputHint: String
        get() = when {
            isUnavailable -> "Assistant unavailable"
            !isReady -> "Connecting..."
            allowedServers.isEmpty() -> "Ask anything..."
            else -> "Ask about ${scopeLabel}..."
        }
    val isEmpty: Boolean get() = messages.isEmpty() && connectionError == null
    val isReconnecting: Boolean get() = connectionError == AIChatSession.RECONNECTING
    val scopeLabel: String
        get() = when (allowedServers.size) {
            0 -> "No servers"
            1 -> allowedServers[0].name
            else -> "${allowedServers.size} servers"
        }
    val agentSessionsLabel: String?
        get() = agentSessionCount.takeIf { it > 0 }?.let { "$it assistant session${if (it == 1) "" else "s"} open" }
    val pendingApproval: ChatMessage? get() = messages.firstOrNull { it.isAwaitingConfirmation }
    val suggestions: List<String>
        get() = if (allowedServers.isEmpty()) listOf("Which of my servers are offline?", "Summarise the health of my servers", "Which server has the least free disk space?")
        else listOf("Check disk usage", "Why is the load high?", "Show failed services", "Are there pending updates?")

    fun isAllowed(server: Server): Boolean = allowedServers.any { it.entryId == server.entryId }
}

class AIChatSession internal constructor(
    private val channel: AIAssistantChannel,
    private val scope: CoroutineScope,
    initialMode: ApprovalMode,
    private val saveMode: (ApprovalMode) -> Unit,
) {
    private val _state = MutableStateFlow(AIChatState(emptyList(), false, false, null, approvalMode = initialMode))
    private var retryJob: Job? = null
    private var started = false
    private var restarting = false

    val state: StateFlow<AIChatState> = _state.asStateFlow()

    fun activate() {
        if (started) return
        started = true
        connect()
    }

    private fun connect() {
        if (!started) return
        channel.connect(::handleEvent, ::handleClosed)
    }

    fun retry() {
        _state.update { it.copy(connectionError = null, isUnavailable = false, retryAttempts = 0) }
        started = true
        connect()
    }

    fun canSend(input: String): Boolean = input.trim().isNotEmpty() && _state.value.isReady && !_state.value.isRunning

    fun send(input: String): Boolean {
        val content = input.trim()
        if (!canSend(content)) return false
        channel.sendPrompt(content)
        _state.update { it.add(ChatRole.USER, text = content).copy(isRunning = true, canContinue = false) }
        return true
    }

    fun stop() {
        channel.abort()
        _state.update { it.endStreaming().abortRunningTools().copy(isRunning = false) }
    }

    fun continueRun() {
        if (!_state.value.isReady || _state.value.isRunning) return
        channel.continueTurn()
        _state.update { it.copy(isRunning = true, canContinue = false) }
    }

    private fun allow(server: Server) {
        if (server.entryId == null) return
        _state.update { it.copy(allowedServers = it.allowedServers + server) }
        pushConfig()
    }

    fun revoke(server: Server) {
        _state.update { s ->
            s.copy(allowedServers = s.allowedServers.filterNot { it.entryId == server.entryId }, activeEntryId = s.activeEntryId.takeIf { it != server.entryId })
        }
        pushConfig()
    }

    fun toggle(server: Server) = if (_state.value.isAllowed(server)) revoke(server) else allow(server)

    fun focus(server: Server?) {
        _state.update { s ->
            s.copy(allowedServers = if (server?.entryId == null || s.isAllowed(server)) s.allowedServers else s.allowedServers + server, activeEntryId = server?.entryId)
        }
        pushConfig()
    }

    fun setApprovalMode(mode: ApprovalMode) {
        saveMode(mode)
        _state.update { it.copy(approvalMode = mode) }
        pushConfig()
    }

    private fun pushConfig() {
        val s = _state.value
        if (s.isReady) channel.sendConfig(s.allowedServers.mapNotNull { it.entryId }, s.activeEntryId, s.approvalMode.wire)
    }

    fun confirm(callId: String, allow: Boolean) {
        channel.confirm(callId, allow)
        _state.update { it.patchTool(callId, if (allow) ToolStatus.RUNNING else ToolStatus.DENIED, null, null) }
    }

    fun answer(callId: String, text: String) = answer(callId, JsonPrimitive(text.trim()))

    fun answer(callId: String, choices: List<String>) = answer(callId, JsonArray(choices.map { JsonPrimitive(it) }))

    private fun answer(callId: String, value: JsonElement) {
        if ((value as? JsonPrimitive)?.content?.isEmpty() == true || (value as? JsonArray)?.isEmpty() == true) return
        channel.answer(callId, value)
        _state.update { it.patchTool(callId, ToolStatus.DONE, jsonOf("answer" to value), null) }
    }

    fun newChat() {
        retryJob?.cancel()
        val wasReady = _state.value.isReady
        _state.update { AIChatState(emptyList(), false, false, null, it.allowedServers, it.activeEntryId, it.approvalMode) }
        if (!started) return
        if (wasReady) {
            restarting = true
            channel.closeConversation()
        } else {
            channel.renewConversation()
            connect()
        }
    }

    internal fun reset() {
        retryJob?.cancel()
        started = false
        restarting = false
        channel.dispose()
        channel.renewConversation()
        _state.update { AIChatState(emptyList(), false, false, null, approvalMode = it.approvalMode) }
    }

    internal fun handleEvent(msg: JsonObject) {
        val callId = msg.str("callId")
        val type = msg.str("type")
        _state.update { s ->
            when (type) {
                "ready" -> s.copy(isReady = true, retryAttempts = 0, connectionError = null, isUnavailable = false, agentSessionCount = msg.arr("sessions")?.size ?: 0)
                "config" -> {
                    val ids = msg.arr("allowedEntryIds")?.mapNotNull { (it as? JsonPrimitive)?.content?.toIntOrNull() }
                    val kept = if (ids == null) s.allowedServers else s.allowedServers.filter { it.entryId in ids }
                    s.copy(allowedServers = kept, activeEntryId = s.activeEntryId.takeIf { id -> kept.any { it.entryId == id } },
                        approvalMode = msg.str("approvalMode")?.let(ApprovalMode::parse) ?: s.approvalMode)
                }
                "text-delta" -> s.appendAssistant(msg.str("delta") ?: "")
                "tool-call" -> s.endStreaming().upsertTool(callId, msg, ToolStatus.RUNNING)
                "confirm-request" -> s.upsertTool(callId, msg, ToolStatus.AWAITING_CONFIRM)
                "question" -> s.endStreaming().upsertQuestion(callId, msg)
                "tool-result" -> {
                    val result = msg["result"]
                    val denied = (result as? JsonObject)?.get("denied")?.toString() == "true"
                    s.patchTool(callId, if (denied) ToolStatus.DENIED else ToolStatus.DONE, result, null)
                }
                "tool-error" -> s.patchTool(callId, ToolStatus.ERROR, null, msg.str("error"))
                "step-limit" -> s.copy(canContinue = true).add(ChatRole.NOTE, text = "The assistant paused after many steps.")
                "compacted" -> s.add(ChatRole.NOTE, text = "Earlier messages were summarised to save space.")
                "done" -> s.endStreaming().copy(isRunning = false, agentSessionCount = msg.arr("sessions")?.size ?: s.agentSessionCount)
                "aborted" -> s.endStreaming().abortRunningTools().copy(isRunning = false)
                "error" -> s.endStreaming().abortRunningTools().copy(isRunning = false, canContinue = true)
                    .add(ChatRole.SYSTEM, text = msg.str("message") ?: "Something went wrong.")
                else -> s
            }
        }
        if (type == "ready") pushConfig()
    }

    internal fun handleClosed(code: Int?, reason: String?) {
        if (!started) return
        if (restarting) {
            restarting = false
            channel.renewConversation()
            connect()
            return
        }
        var retryDelay: Long? = null
        _state.update { cur ->
            retryDelay = null
            val s = cur.endStreaming().abortRunningTools().copy(isReady = false, isRunning = false)
            when {
                code != null && code >= 4000 -> s.copy(connectionError = reason?.takeIf { it.isNotEmpty() } ?: LOST, isUnavailable = code == NOT_CONFIGURED)
                code == 1000 || code == 1005 -> s
                s.retryAttempts + 1 <= MAX_RETRIES -> {
                    val attempts = s.retryAttempts + 1
                    retryDelay = (1000L * (1 shl attempts)).coerceIn(0, 10_000)
                    s.copy(retryAttempts = attempts, connectionError = RECONNECTING)
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
        const val NOT_CONFIGURED = 4020
        const val LOST = "Connection to the assistant was lost."
        const val RECONNECTING = "Connection lost. Reconnecting..."
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

private fun AIChatState.upsertQuestion(callId: String?, msg: JsonObject): AIChatState {
    if (callId == null) return this
    val args = JsonObject(listOf("question", "options", "multiSelect", "allowFreeText").mapNotNull { k -> msg[k]?.let { k to it } }.toMap())
    val i = messages.indexOfFirst { it.role == ChatRole.TOOL && it.callId == callId }
    return if (i == -1) add(ChatRole.TOOL, callId = callId, tool = AITools.ASK_USER, args = args, status = ToolStatus.AWAITING_ANSWER)
    else copy(messages = messages.toMutableList().also { it[i] = it[i].copy(tool = AITools.ASK_USER, args = args, status = ToolStatus.AWAITING_ANSWER) })
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
    if (it.role == ChatRole.TOOL && (it.status == ToolStatus.RUNNING || it.status == ToolStatus.AWAITING_CONFIRM || it.status == ToolStatus.AWAITING_ANSWER)) it.copy(status = ToolStatus.ABORTED) else it
})
