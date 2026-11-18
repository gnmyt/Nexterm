package dev.gnm.nexterm.terminal

import java.util.concurrent.locks.ReentrantLock

internal actual object Vt {
    init {
        System.loadLibrary("nexterm_vt")
    }

    actual external fun create(cols: Int, rows: Int, scrollback: Int): Long
    actual external fun free(h: Long)
    actual external fun write(h: Long, data: ByteArray, len: Int): Int
    actual external fun resize(h: Long, cols: Int, rows: Int, cw: Int, ch: Int)
    actual external fun setColors(h: Long, fg: Int, bg: Int, cursor: Int, palette: IntArray)
    actual external fun takeOutput(h: Long): ByteArray?
    actual external fun snapshot(h: Long, cps: IntArray, fg: IntArray, bg: IntArray, flags: IntArray, extra: IntArray, info: IntArray): Boolean
    actual external fun scroll(h: Long, kind: Int, delta: Long)
    actual external fun mode(h: Long, mode: Int, ansi: Boolean): Boolean
    actual external fun key(h: Long, key: Int, mods: Int, utf8: ByteArray?, unshifted: Int): Boolean
    actual external fun mouse(h: Long, action: Int, button: Int, mods: Int, x: Float, y: Float, sw: Int, sh: Int, cw: Int, ch: Int): Boolean
    actual external fun text(h: Long, data: ByteArray)
    actual external fun paste(h: Long, data: ByteArray)
    actual external fun selectWords(h: Long, x1: Int, y1: Int, x2: Int, y2: Int): Boolean
    actual external fun clearSelection(h: Long)
    actual external fun selectionText(h: Long): ByteArray?
}

internal actual class TerminalLock {
    private val lock = ReentrantLock()
    actual fun lock() = lock.lock()
    actual fun unlock() = lock.unlock()
}
