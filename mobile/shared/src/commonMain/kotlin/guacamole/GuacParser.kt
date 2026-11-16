package dev.gnm.nexterm.guacamole

class GuacProtocolException(message: String) : Exception(message)

class GuacParser(private val onInstruction: (opcode: String, args: List<String>) -> Unit) {
    private val buffer = StringBuilder()
    private val elements = ArrayList<String>()
    private var pos = 0
    private var elementLength = -1
    private var scanIndex = 0
    private var scanCount = 0

    fun receive(packet: String) {
        buffer.append(packet)
        try {
            parse()
        } finally {
            compact()
        }
    }

    private fun parse() {
        while (true) {
            if (elementLength < 0) {
                val dot = buffer.indexOf(".", pos)
                if (dot < 0) {
                    if (buffer.length - pos > MAX_LENGTH_DIGITS) throw GuacProtocolException("Invalid element length")
                    return
                }
                elementLength = buffer.substring(pos, dot).toIntOrNull()?.takeIf { it >= 0 }
                    ?: throw GuacProtocolException("Invalid element length: ${buffer.substring(pos, dot)}")
                pos = dot + 1
                scanIndex = pos
                scanCount = 0
            }
            while (scanCount < elementLength) {
                if (scanIndex >= buffer.length) return
                val c = buffer[scanIndex]
                if (c.isHighSurrogate()) {
                    if (scanIndex + 1 >= buffer.length) return
                    scanIndex += if (buffer[scanIndex + 1].isLowSurrogate()) 2 else 1
                } else {
                    scanIndex++
                }
                scanCount++
            }
            if (scanIndex >= buffer.length) return
            val element = buffer.substring(pos, scanIndex)
            val terminator = buffer[scanIndex]
            pos = scanIndex + 1
            elementLength = -1
            elements.add(element)
            when (terminator) {
                ';' -> {
                    val opcode = elements.removeAt(0)
                    val args = elements.toList()
                    elements.clear()
                    onInstruction(opcode, args)
                }
                ',' -> Unit
                else -> throw GuacProtocolException("Element terminator was not ';' nor ','")
            }
        }
    }

    private fun compact() {
        if (pos == 0) return
        buffer.deleteRange(0, pos)
        if (elementLength >= 0) scanIndex -= pos
        pos = 0
    }

    companion object {
        private const val MAX_LENGTH_DIGITS = 12

        fun encode(elements: List<Any>): String = buildString {
            elements.forEachIndexed { i, e ->
                if (i > 0) append(',')
                val s = e.toString()
                append(s.codePointLength())
                append('.')
                append(s)
            }
            append(';')
        }
    }
}

internal fun String.codePointLength(): Int {
    var n = 0
    var i = 0
    while (i < length) {
        i += if (this[i].isHighSurrogate() && i + 1 < length && this[i + 1].isLowSurrogate()) 2 else 1
        n++
    }
    return n
}
