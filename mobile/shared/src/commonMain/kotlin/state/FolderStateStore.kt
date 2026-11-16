package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class FolderStateStore(private val settings: Settings) {
    private val _expanded = MutableStateFlow(loadExpanded())

    val expandedIds: StateFlow<Set<String>> = _expanded.asStateFlow()

    fun isFolderExpanded(folderId: String?): Boolean = folderId != null && settings.getBoolean(PREFIX + folderId, false)

    fun setFolderExpanded(folderId: String?, expanded: Boolean) {
        if (folderId == null) return
        settings.putBoolean(PREFIX + folderId, expanded)
        _expanded.value = if (expanded) _expanded.value + folderId else _expanded.value - folderId
    }

    fun toggle(folderId: String?) = setFolderExpanded(folderId, !isFolderExpanded(folderId))

    private fun loadExpanded(): Set<String> =
        settings.keys.filter { it.startsWith(PREFIX) && settings.getBoolean(it, false) }.map { it.removePrefix(PREFIX) }.toSet()

    companion object {
        const val PREFIX = "folder_expanded_"
    }
}
