package dev.gnm.nexterm.util

import io.ktor.http.decodeURLQueryComponent
import io.ktor.http.encodeURLParameter

internal object Uris {
    private val uriRegex = Regex("^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/?#]*)([^?#]*)(?:\\?([^#]*))?")

    data class Parsed(val scheme: String, val host: String, val path: String, val query: Map<String, String>)

    fun parse(raw: String): Parsed? {
        val m = uriRegex.find(raw.trim()) ?: return null
        val query = m.groupValues[4].split('&').filter { it.isNotEmpty() }.associate {
            val i = it.indexOf('=')
            if (i < 0) decode(it) to "" else decode(it.substring(0, i)) to decode(it.substring(i + 1))
        }
        return Parsed(m.groupValues[1].lowercase(), m.groupValues[2].lowercase(), m.groupValues[3], query)
    }

    fun decode(s: String): String = runCatching { s.decodeURLQueryComponent(plusIsSpace = true) }.getOrDefault(s)

    fun decodeComponent(s: String): String = runCatching { s.decodeURLQueryComponent() }.getOrDefault(s)

    fun encode(s: String): String = s.encodeURLParameter()

    fun query(params: Map<String, String>): String =
        params.entries.joinToString("&") { "${encode(it.key)}=${encode(it.value)}" }
}
