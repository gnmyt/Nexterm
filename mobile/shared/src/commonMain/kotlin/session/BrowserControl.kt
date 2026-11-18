package dev.gnm.nexterm.session

import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.boolOrNull
import dev.gnm.nexterm.util.parseJsonOrNull
import dev.gnm.nexterm.util.str
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class BrowserState(
    val address: String = "",
    val title: String = "",
    val isLoading: Boolean = false,
    val canGoBack: Boolean = false,
    val canGoForward: Boolean = false,
)

class BrowserControl internal constructor(val canControl: Boolean) {
    private val _state = MutableStateFlow(BrowserState())
    internal var send: (String) -> Unit = {}

    val state: StateFlow<BrowserState> = _state.asStateFlow()

    fun navigate(address: String) {
        val target = address.trim()
        if (target.isNotEmpty()) command("navigate $target")
    }

    fun goBack() = command("back")
    fun goForward() = command("forward")
    fun reloadOrStop() = command(if (_state.value.isLoading) "stop" else "reload")

    private fun command(text: String) {
        if (canControl) send(text)
    }

    internal fun handle(payload: String) {
        val msg = parseJsonOrNull(payload).asObject() ?: return
        if (msg.str("event") != "state") return
        _state.value = BrowserState(
            msg.str("uri") ?: "", msg.str("title") ?: "",
            msg.boolOrNull("loading") == true, msg.boolOrNull("canBack") == true, msg.boolOrNull("canForward") == true,
        )
    }

    internal companion object {
        const val PIPE = "nexterm-browser"
    }
}
