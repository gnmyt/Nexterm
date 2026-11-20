package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.session.ApprovalMode
import dev.gnm.nexterm.util.Flag
import dev.gnm.nexterm.util.arr
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.str
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

class AIManager internal constructor(private val api: ApiClient, private val settings: Settings) {
    private val _isAvailable = MutableStateFlow(false)
    val isAvailable: StateFlow<Boolean> = _isAvailable.asStateFlow()

    internal val approvalMode: ApprovalMode
        get() = ApprovalMode.parse(settings.getStringOrNull(MODE_KEY)).let { if (it == ApprovalMode.ALLOW) ApprovalMode.ASK else it }

    internal fun saveApprovalMode(mode: ApprovalMode) = settings.putString(MODE_KEY, mode.wire)

    @Throws(CancellationException::class)
    suspend fun loadSettings() {
        _isAvailable.value = safe(false) { api.getAs("/ai", "Failed to load AI settings", Status.serializer()).isConfigured }
    }

    fun commandSuggester(sessionId: String): CommandSuggester = CommandSuggester(this, sessionId)

    internal suspend fun suggestCommands(sessionId: String, prompt: String, rejected: List<String>): List<String> {
        val r = api.post("/ai/command", jsonOf("sessionId" to sessionId, "prompt" to prompt.trim().take(2000), "rejected" to rejected.takeLast(12)))
        val json = r.json().asObject()
        if (!r.isOk) throw NextermException(json?.str("error") ?: "Could not generate a command (${r.status})", r.status)
        return json?.arr("commands").orEmpty().mapNotNull { (it as? JsonPrimitive)?.content?.takeIf { c -> c.isNotBlank() } }
    }

    fun clear() {
        _isAvailable.value = false
    }

    @Serializable
    private class Status(val isConfigured: Flag = false)

    private companion object {
        const val MODE_KEY = "aiApprovalMode"
    }
}

data class CommandSuggestions(val commands: List<String> = emptyList(), val isBusy: Boolean = false, val error: String? = null)

class CommandSuggester internal constructor(private val ai: AIManager, private val sessionId: String) {
    private val _state = MutableStateFlow(CommandSuggestions())
    private var rejected = emptyList<String>()

    val state: StateFlow<CommandSuggestions> = _state.asStateFlow()

    @Throws(CancellationException::class)
    suspend fun generate(prompt: String, fresh: Boolean) {
        if (prompt.isBlank() || _state.value.isBusy) return
        rejected = if (fresh) emptyList() else rejected + _state.value.commands
        _state.update { it.copy(isBusy = true, error = null) }
        try {
            val commands = ai.suggestCommands(sessionId, prompt, rejected)
            _state.value = CommandSuggestions(commands, error = "No suggestions. Try describing it differently.".takeIf { commands.isEmpty() })
        } catch (e: CancellationException) {
            _state.update { it.copy(isBusy = false) }
            throw e
        } catch (e: Exception) {
            _state.update { it.copy(isBusy = false, error = e.message ?: "Could not generate a command") }
        }
    }
}
