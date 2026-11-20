package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class FavoritesStore(private val settings: Settings) {
    private var accountId: String? = null
    private val _ids = MutableStateFlow<List<String>>(emptyList())

    val ids: StateFlow<List<String>> = _ids.asStateFlow()

    internal fun use(accountId: String?) {
        this.accountId = accountId
        _ids.value = accountId?.let { settings.getStringOrNull(PREFIX + it) }?.split(',')?.filter { it.isNotEmpty() }.orEmpty()
    }

    fun toggle(serverId: String?) {
        val account = accountId ?: return
        if (serverId == null) return
        _ids.value = if (serverId in _ids.value) _ids.value - serverId else _ids.value + serverId
        settings.putString(PREFIX + account, _ids.value.joinToString(","))
    }

    private companion object {
        const val PREFIX = "favorites_"
    }
}
