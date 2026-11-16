package dev.gnm.nexterm.terminal

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class Terminal(val maxLines: Int = 10_000, cols: Int = 80, rows: Int = 24) {
    var onOutput: ((String) -> Unit)? = null
    var onResponse: ((String) -> Unit)? = null
    var onResize: ((cols: Int, rows: Int) -> Unit)? = null

    private val lock = TerminalLock()
    private var handle = Vt.create(cols, rows, maxLines).also { check(it != 0L) { "ghostty_terminal_new failed" } }
    private val _revision = MutableStateFlow(0L)
    val revision: StateFlow<Long> = _revision.asStateFlow()

    var cols = cols
        private set
    var rows = rows
        private set
    private var cellWidth = 1
    private var cellHeight = 1

    fun write(data: String) = write(data.encodeToByteArray())

    fun write(data: ByteArray, length: Int = data.size) {
        val out = lock.withLock {
            if (handle == 0L) return
            if (Vt.write(handle, data, length) != 0) Vt.takeOutput(handle) else null
        }
        bump()
        out?.let { (onResponse ?: onOutput)?.invoke(it.decodeToString()) }
    }

    fun resize(cols: Int, rows: Int, cellWidth: Int = 0, cellHeight: Int = 0) {
        val c = cols.coerceAtLeast(1)
        val r = rows.coerceAtLeast(1)
        locked {
            Vt.resize(handle, c, r, cellWidth, cellHeight)
            this.cols = c
            this.rows = r
            this.cellWidth = cellWidth.coerceAtLeast(1)
            this.cellHeight = cellHeight.coerceAtLeast(1)
        }
        bump()
        onResize?.invoke(c, r)
    }

    fun setTheme(theme: TerminalTheme) {
        locked { Vt.setColors(handle, theme.foreground, theme.background, theme.cursor, theme.palette.toIntArray()) }
        bump()
    }

    fun keyInput(key: TerminalKey, ctrl: Boolean = false, alt: Boolean = false, shift: Boolean = false): Boolean {
        val text = if (key.char != '\u0000' && !ctrl) {
            (if (shift) key.char.uppercaseChar() else key.char).toString().encodeToByteArray()
        } else null
        return emit { Vt.key(handle, key.code, mods(ctrl, alt, shift), text, key.char.code) }
    }

    fun textInput(text: String) {
        emit { Vt.text(handle, text.encodeToByteArray()); true }
    }

    fun paste(text: String) {
        emit { Vt.paste(handle, text.encodeToByteArray()); true }
    }

    fun mouseInput(button: TerminalMouseButton, action: TerminalMouseAction, x: Float, y: Float, ctrl: Boolean = false, alt: Boolean = false, shift: Boolean = false): Boolean =
        emit {
            Vt.mouse(handle, action.ordinal, button.code, mods(ctrl, alt, shift), x, y, cols * cellWidth, rows * cellHeight, cellWidth, cellHeight)
        }

    val isAltScreen: Boolean get() = locked { Vt.mode(handle, 1049, false) || Vt.mode(handle, 1047, false) || Vt.mode(handle, 47, false) }

    fun scrollLines(lines: Int) = scroll(2, lines.toLong())
    fun scrollToBottom() = scroll(1, 0)

    fun selectWords(x1: Int, y1: Int, x2: Int, y2: Int): Boolean {
        val ok = locked { Vt.selectWords(handle, x1.coerceIn(0, cols - 1), y1.coerceIn(0, rows - 1), x2.coerceIn(0, cols - 1), y2.coerceIn(0, rows - 1)) }
        bump()
        return ok
    }

    fun clearSelection() {
        locked { Vt.clearSelection(handle) }
        bump()
    }

    val selectedText: String? get() = locked { Vt.selectionText(handle) }?.decodeToString()

    fun snapshot(into: TerminalSnapshot): Boolean = lock.withLock {
        if (handle == 0L) return false
        into.ensure(cols, rows)
        Vt.snapshot(handle, into.codePoints, into.foreground, into.background, into.flags, into.extra, into.info)
    }

    fun close() = lock.withLock {
        if (handle != 0L) Vt.free(handle)
        handle = 0L
    }

    private fun bump() = _revision.update { it + 1 }

    private fun scroll(kind: Int, delta: Long) {
        locked { Vt.scroll(handle, kind, delta) }
        bump()
    }

    private inline fun emit(block: () -> Boolean): Boolean {
        val out = locked { if (block()) Vt.takeOutput(handle) else null }
        if (out == null || out.isEmpty()) return false
        onOutput?.invoke(out.decodeToString())
        return true
    }

    private inline fun <T> locked(block: () -> T): T = lock.withLock {
        check(handle != 0L) { "Terminal is closed" }
        block()
    }
}
