package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import dev.gnm.nexterm.util.Formatters
import kotlin.random.Random

internal class ClientIds(settings: Settings) {
    val tabId = "app_${Formatters.nowMillis()}_${randomString()}"
    val browserId: String = settings.getStringOrNull(KEY) ?: "device_${Formatters.nowMillis()}_${randomString()}".also { settings.putString(KEY, it) }

    private companion object {
        const val KEY = "nexterm_device_id"
        const val CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
        fun randomString() = (1..9).map { CHARS[Random.nextInt(CHARS.length)] }.joinToString("")
    }
}
