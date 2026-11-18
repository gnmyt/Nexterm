package dev.gnm.nexterm.state

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.util.Flag
import kotlinx.serialization.Serializable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AIManager internal constructor(private val api: ApiClient) {
    private val _isAvailable = MutableStateFlow(false)
    val isAvailable: StateFlow<Boolean> = _isAvailable.asStateFlow()

    @Throws(CancellationException::class)
    suspend fun loadSettings() {
        _isAvailable.value = safe(false) { api.getAs("/ai", "Failed to load AI settings", Status.serializer()).isConfigured }
    }

    @Serializable
    private class Status(val isConfigured: Flag = false)

    fun clear() {
        _isAvailable.value = false
    }
}
