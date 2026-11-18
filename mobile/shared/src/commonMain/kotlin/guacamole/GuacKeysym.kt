package dev.gnm.nexterm.guacamole

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class GuacKey(val label: String, val keysym: Int)

object GuacKeysym {
    const val ESCAPE = 0xFF1B
    const val TAB = 0xFF09
    const val ENTER = 0xFF0D
    const val BACKSPACE = 0xFF08
    const val DELETE = 0xFFFF
    const val UP = 0xFF52
    const val DOWN = 0xFF54
    const val LEFT = 0xFF51
    const val RIGHT = 0xFF53
    const val HOME = 0xFF50
    const val END = 0xFF57
    const val PAGE_UP = 0xFF55
    const val PAGE_DOWN = 0xFF56
    const val CTRL = 0xFFE3
    const val ALT = 0xFFE9
    const val SHIFT = 0xFFE1

    val toolbar: List<GuacKey> = listOf(
        "Esc" to ESCAPE, "Tab" to TAB, "Enter" to ENTER, "Backspace" to BACKSPACE, "Delete" to DELETE,
        "↑" to UP, "↓" to DOWN, "←" to LEFT, "→" to RIGHT, "Home" to HOME, "End" to END, "Page Up" to PAGE_UP, "Page Down" to PAGE_DOWN,
    ).map { GuacKey(it.first, it.second) }

    fun fromCodePoint(codePoint: Int): Int = when (codePoint) {
        '\n'.code, '\r'.code -> ENTER
        '\t'.code -> TAB
        '\b'.code -> BACKSPACE
        0x1B -> ESCAPE
        else -> if (codePoint < 128) codePoint else codePoint + 0x01000000
    }

    fun forText(text: String): List<Int> {
        val result = ArrayList<Int>(text.length)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c.isHighSurrogate() && i + 1 < text.length && text[i + 1].isLowSurrogate()) {
                result.add(fromCodePoint(0x10000 + ((c.code - 0xD800) shl 10) + (text[i + 1].code - 0xDC00)))
                i += 2
            } else {
                result.add(fromCodePoint(c.code))
                i++
            }
        }
        return result
    }
}

class GuacKeyboard(private val client: GuacClient) {
    private val _ctrl = MutableStateFlow(false)
    private val _alt = MutableStateFlow(false)
    private val _shift = MutableStateFlow(false)
    val ctrl: StateFlow<Boolean> = _ctrl.asStateFlow()
    val alt: StateFlow<Boolean> = _alt.asStateFlow()
    val shift: StateFlow<Boolean> = _shift.asStateFlow()

    private var previousText = ""

    fun sendKeyPress(keysym: Int) = client.sendKeyPress(keysym)

    fun toggleCtrl() = toggle(_ctrl, GuacKeysym.CTRL)
    fun toggleAlt() = toggle(_alt, GuacKeysym.ALT)
    fun toggleShift() = toggle(_shift, GuacKeysym.SHIFT)

    private fun toggle(flag: MutableStateFlow<Boolean>, keysym: Int) {
        flag.value = !flag.value
        client.sendKeyEvent(flag.value, keysym)
    }

    fun releaseModifiers() {
        listOf(_ctrl to GuacKeysym.CTRL, _alt to GuacKeysym.ALT, _shift to GuacKeysym.SHIFT).forEach { (flag, ks) ->
            if (flag.value) {
                flag.value = false
                client.sendKeyEvent(false, ks)
            }
        }
    }

    fun sendText(text: String) {
        client.sendText(text)
        releaseModifiers()
    }

    fun sendCtrlAltDel() {
        client.sendKeyEvent(true, GuacKeysym.CTRL)
        client.sendKeyEvent(true, GuacKeysym.ALT)
        client.sendKeyPress(GuacKeysym.DELETE)
        client.later(100) {
            client.sendKeyEvent(false, GuacKeysym.ALT)
            client.sendKeyEvent(false, GuacKeysym.CTRL)
        }
    }

    fun onTextFieldChanged(text: String) {
        val previous = previousText
        previousText = text
        when {
            text.length < previous.length -> repeat(previous.length - text.length) { sendKeyPress(GuacKeysym.BACKSPACE) }
            text.length > previous.length -> sendText(text.substring(previous.length))
        }
    }

    fun resetTextField() {
        previousText = ""
    }
}
