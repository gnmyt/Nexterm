package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal class Pref<T>(private val settings: Settings, private val key: String, initial: T, private val write: Settings.(String, T) -> Unit) {
    private val state = MutableStateFlow(initial)
    val flow = state.asStateFlow()

    fun set(value: T) {
        state.value = value
        settings.write(key, value)
    }
}

internal fun Settings.bool(key: String, default: Boolean) = Pref(this, key, getBoolean(key, default)) { k, v -> putBoolean(k, v) }

internal fun Settings.string(key: String, default: String) = Pref(this, key, getStringOrNull(key) ?: default) { k, v -> putString(k, v) }
