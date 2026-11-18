package dev.gnm.nexterm.terminal

class TerminalSnapshot {
    var cols = 0
        private set
    var rows = 0
        private set
    internal var codePoints = IntArray(0)
    var foreground = IntArray(0)
        private set
    var background = IntArray(0)
        private set
    var flags = IntArray(0)
        private set
    internal var extra = IntArray(1024)
    internal val info = IntArray(5)

    val cursorX: Int get() = info[0]
    val cursorY: Int get() = info[1]
    val cursorVisible: Boolean get() = info[2] and 3 == 3

    val defaultBackground: Int get() = info[4]

    internal fun ensure(cols: Int, rows: Int) {
        this.cols = cols
        this.rows = rows
        val n = cols * rows
        if (codePoints.size < n) {
            codePoints = IntArray(n)
            foreground = IntArray(n)
            background = IntArray(n)
            flags = IntArray(n)
        }
    }

    fun codePoint(i: Int): Int {
        val cp = codePoints[i]
        return if (cp >= 0) cp else extra[-cp]
    }

    fun isCluster(i: Int): Boolean = codePoints[i] < 0

    fun appendText(i: Int, sb: StringBuilder) {
        val cp = codePoints[i]
        if (cp >= 0) {
            if (cp != 0) sb.appendCodePoint(cp)
            return
        }
        val off = -cp - 1
        for (k in 1..extra[off]) sb.appendCodePoint(extra[off + k])
    }

    object Cell {
        const val BOLD = 1 shl 0
        const val ITALIC = 1 shl 1
        const val FAINT = 1 shl 2
        const val INVERSE = 1 shl 4
        const val INVISIBLE = 1 shl 5
        const val STRIKETHROUGH = 1 shl 6
        const val UNDERLINE = 1 shl 8
        const val WIDE = 1 shl 9
        const val SPACER = 1 shl 10
        const val SELECTED = 1 shl 11
        const val HAS_BACKGROUND = 1 shl 12
    }
}

internal fun StringBuilder.appendCodePoint(cp: Int) {
    if (cp < 0x10000) {
        append(cp.toChar())
    } else {
        val v = cp - 0x10000
        append((0xD800 + (v ushr 10)).toChar()).append((0xDC00 + (v and 0x3FF)).toChar())
    }
}
