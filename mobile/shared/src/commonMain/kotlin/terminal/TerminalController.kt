package dev.gnm.nexterm.terminal

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.gnm.nexterm.session.ToolbarKey
import dev.gnm.nexterm.state.TerminalSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class TerminalController internal constructor(val terminal: Terminal, private val settings: TerminalSettings, scope: CoroutineScope) {
    var theme: TerminalTheme by mutableStateOf(TerminalThemes.default)
        private set
    var fontSize: Float by mutableStateOf(13f)
        private set
    var cursorStyle: TerminalCursorStyle by mutableStateOf(TerminalCursorStyle.BLOCK)
        private set
    var hasSelection: Boolean by mutableStateOf(false)
        internal set

    private val _ctrl = MutableStateFlow(false)
    private val _alt = MutableStateFlow(false)
    val ctrlActive: StateFlow<Boolean> = _ctrl.asStateFlow()
    val altActive: StateFlow<Boolean> = _alt.asStateFlow()

    init {
        scope.launch(Dispatchers.Main) { settings.themeId.collect { theme = TerminalThemes.byId(it) } }
        scope.launch(Dispatchers.Main) { settings.fontSize.collect(::setFontSize) }
        scope.launch(Dispatchers.Main) { settings.cursorStyle.collect { cursorStyle = it } }
    }

    internal fun setFontSize(size: Double) {
        fontSize = size.toFloat().coerceIn(TerminalSettings.MIN_FONT_SIZE.toFloat(), TerminalSettings.MAX_FONT_SIZE.toFloat())
    }

    internal fun saveFontSize() = settings.setFontSize(fontSize.toDouble())

    fun press(key: ToolbarKey) {
        when (key) {
            ToolbarKey.CTRL -> _ctrl.value = !_ctrl.value
            ToolbarKey.ALT -> _alt.value = !_alt.value
            else -> sendKey(key.key ?: return, ctrl = key.ctrl)
        }
    }

    fun input(text: String) {
        scrollToBottom()
        val ctrl = _ctrl.value
        val alt = _alt.value
        if (!(ctrl || alt) || text.length != 1) return terminal.textInput(text)
        resetModifiers()
        val key = TerminalKey.forChar(text[0])
        if (key != null && terminal.keyInput(key, ctrl = ctrl, alt = alt, shift = text[0].isUpperCase() && !ctrl)) return
        terminal.textInput(if (alt) "\u001b$text" else text)
    }

    fun sendKey(key: TerminalKey, ctrl: Boolean = false, alt: Boolean = false, shift: Boolean = false) {
        scrollToBottom()
        terminal.keyInput(key, ctrl || _ctrl.value, alt || _alt.value, shift)
        resetModifiers()
    }

    fun paste(text: String) {
        scrollToBottom()
        terminal.paste(text)
    }

    fun copySelection(): String? = terminal.selectedText.also { clearSelection() }

    fun clearSelection() {
        terminal.clearSelection()
        hasSelection = false
    }

    private fun scrollToBottom() = terminal.scrollToBottom()

    private fun resetModifiers() {
        _ctrl.value = false
        _alt.value = false
    }
}
