package dev.gnm.nexterm.terminal

internal expect object Vt {
    fun create(cols: Int, rows: Int, scrollback: Int): Long
    fun free(h: Long)
    fun write(h: Long, data: ByteArray, len: Int): Int
    fun resize(h: Long, cols: Int, rows: Int, cw: Int, ch: Int)
    fun setColors(h: Long, fg: Int, bg: Int, cursor: Int, palette: IntArray)
    fun takeOutput(h: Long): ByteArray?
    fun snapshot(h: Long, cps: IntArray, fg: IntArray, bg: IntArray, flags: IntArray, extra: IntArray, info: IntArray): Boolean
    fun scroll(h: Long, kind: Int, delta: Long)
    fun mode(h: Long, mode: Int, ansi: Boolean): Boolean
    fun key(h: Long, key: Int, mods: Int, utf8: ByteArray?, unshifted: Int): Boolean
    fun mouse(h: Long, action: Int, button: Int, mods: Int, x: Float, y: Float, sw: Int, sh: Int, cw: Int, ch: Int): Boolean
    fun text(h: Long, data: ByteArray)
    fun paste(h: Long, data: ByteArray)
    fun selectWords(h: Long, x1: Int, y1: Int, x2: Int, y2: Int): Boolean
    fun clearSelection(h: Long)
    fun selectionText(h: Long): ByteArray?
}

internal expect class TerminalLock() {
    fun lock()
    fun unlock()
}

internal inline fun <T> TerminalLock.withLock(block: () -> T): T {
    lock()
    try {
        return block()
    } finally {
        unlock()
    }
}
