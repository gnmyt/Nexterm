package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import dev.gnm.nexterm.session.ToolbarKey
import dev.gnm.nexterm.terminal.TerminalCursorStyle
import dev.gnm.nexterm.util.parseJsonOrNull
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

enum class ToolbarGroup(val id: String, val label: String, val description: String, val keys: List<ToolbarKey>) {
    MODIFIERS("modifiers", "Modifier Keys", "CTRL, ALT", listOf(ToolbarKey.CTRL, ToolbarKey.ALT)),
    SIGNALS("signals", "Signal Keys", "^C, ^Z, ^D", listOf(ToolbarKey.CTRL_C, ToolbarKey.CTRL_Z, ToolbarKey.CTRL_D)),
    ARROWS("arrows", "Arrow Keys", "↑ ↓ ← →", listOf(ToolbarKey.UP, ToolbarKey.DOWN, ToolbarKey.LEFT, ToolbarKey.RIGHT)),
    NAVIGATION("navigation", "Navigation Keys", "HOME, END, PGUP, PGDN", listOf(ToolbarKey.HOME, ToolbarKey.END, ToolbarKey.PAGE_UP, ToolbarKey.PAGE_DOWN)),
    FUNCTION_KEYS("functionKeys", "Function Keys", "F1–F12", listOf(
        ToolbarKey.F1, ToolbarKey.F2, ToolbarKey.F3, ToolbarKey.F4, ToolbarKey.F5, ToolbarKey.F6,
        ToolbarKey.F7, ToolbarKey.F8, ToolbarKey.F9, ToolbarKey.F10, ToolbarKey.F11, ToolbarKey.F12,
    ));

    companion object {
        fun fromId(id: String): ToolbarGroup? = entries.firstOrNull { it.id == id }
    }
}

class TerminalSettings(private val settings: Settings) {
    private val size = Pref(settings, "terminal_fontSize", settings.getDoubleOrNull("terminal_fontSize") ?: DEFAULT_FONT_SIZE) { k, v -> putDouble(k, v) }
    private val theme = settings.string("terminal_theme", DEFAULT_THEME_ID)
    private val cursor = Pref(settings, "terminal_cursorStyle", CURSOR_STYLES.firstOrNull { it.name.lowercase() == settings.getStringOrNull("terminal_cursorStyle") } ?: TerminalCursorStyle.BLOCK) { k, v -> putString(k, v.name.lowercase()) }
    private val _groupEnabled = MutableStateFlow(loadEnabled())
    private val _groupOrder = MutableStateFlow(loadOrder())

    val fontSize = size.flow
    val themeId = theme.flow
    val cursorStyle = cursor.flow
    val groupEnabled: StateFlow<Map<ToolbarGroup, Boolean>> = _groupEnabled.asStateFlow()
    val groupOrder: StateFlow<List<ToolbarGroup>> = _groupOrder.asStateFlow()

    fun isGroupEnabled(group: ToolbarGroup): Boolean = _groupEnabled.value[group] ?: false

    fun toolbarKeys(): List<ToolbarKey> =
        listOf(ToolbarKey.ESC, ToolbarKey.TAB) + _groupOrder.value.filter(::isGroupEnabled).flatMap { it.keys }

    fun setFontSize(size: Double) = this.size.set(size.coerceIn(MIN_FONT_SIZE, MAX_FONT_SIZE))
    fun setTheme(id: String) = theme.set(id)
    fun setCursorStyle(style: TerminalCursorStyle) = cursor.set(style)

    fun setGroupEnabled(group: ToolbarGroup, enabled: Boolean) {
        _groupEnabled.value = _groupEnabled.value + (group to enabled)
        val json = JsonObject(ToolbarGroup.entries.associate { it.id to JsonPrimitive(_groupEnabled.value[it] ?: false) })
        settings.putString(GROUPS_KEY, json.toString())
    }

    fun setGroupOrder(order: List<ToolbarGroup>) {
        _groupOrder.value = order
        settings.putString(ORDER_KEY, JsonArray(order.map { JsonPrimitive(it.id) }).toString())
    }

    fun moveGroup(from: Int, to: Int) {
        val list = _groupOrder.value.toMutableList()
        if (from !in list.indices || to !in list.indices) return
        list.add(to, list.removeAt(from))
        setGroupOrder(list)
    }

    private fun loadEnabled(): Map<ToolbarGroup, Boolean> {
        val result = DEFAULT_ENABLED.toMutableMap()
        val saved = settings.getStringOrNull(GROUPS_KEY)?.let(::parseJsonOrNull) as? JsonObject
        saved?.forEach { (k, v) -> ToolbarGroup.fromId(k)?.let { g -> (v as? JsonPrimitive)?.booleanOrNull?.let { result[g] = it } } }
        return result
    }

    private fun loadOrder(): List<ToolbarGroup> {
        val saved = settings.getStringOrNull(ORDER_KEY)?.let(::parseJsonOrNull) as? JsonArray
        val parsed = saved?.mapNotNull { (it as? JsonPrimitive)?.content?.let(ToolbarGroup::fromId) }
        return if (parsed != null && parsed.size == ToolbarGroup.entries.size) parsed else ToolbarGroup.entries.toList()
    }

    companion object {
        const val GROUPS_KEY = "terminal_toolbarGroups"
        const val ORDER_KEY = "terminal_toolbarOrder"
        const val DEFAULT_FONT_SIZE = 13.0
        const val MIN_FONT_SIZE = 8.0
        const val MAX_FONT_SIZE = 24.0
        const val DEFAULT_THEME_ID = "default"
        const val SCROLLBACK_LINES = 10000
        val CURSOR_STYLES = listOf(TerminalCursorStyle.BLOCK, TerminalCursorStyle.UNDERLINE, TerminalCursorStyle.BAR)

        val DEFAULT_ENABLED: Map<ToolbarGroup, Boolean> = mapOf(
            ToolbarGroup.MODIFIERS to true, ToolbarGroup.SIGNALS to true, ToolbarGroup.ARROWS to true,
            ToolbarGroup.NAVIGATION to true, ToolbarGroup.FUNCTION_KEYS to false,
        )
    }
}

