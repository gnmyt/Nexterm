package dev.gnm.nexterm.util

import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerFolder
import dev.gnm.nexterm.model.Tag

sealed class ServerListRow {
    abstract val key: String
    abstract val depth: Int

    data class FolderRow(val folder: ServerFolder, override val depth: Int, val isExpanded: Boolean) : ServerListRow() {
        override val key: String get() = "folder:${folder.id}:${folder.name}"
        val iconKey: String get() = IconKeys.folder(folder, isExpanded)
        val colorRole: ColorRole get() = IconKeys.folderColor(folder)
        val subtitle: String? get() = folder.serverCount.takeIf { it > 0 }?.let { "$it server${if (it == 1) "" else "s"}" }
    }

    data class ServerRow(val server: Server, override val depth: Int) : ServerListRow() {
        override val key: String get() = "server:${server.id}:${server.name}"
        val iconKey: String get() = IconKeys.server(server)
        val colorRole: ColorRole get() = IconKeys.serverColor(server)
        val tagDots: List<Tag> get() = server.tags.take(3)
    }
}

object ServerFilter {
    fun filter(entries: List<Entry>, query: String, selectedTags: Set<Int>): List<Entry> {
        if (query.isEmpty() && selectedTags.isEmpty()) return entries
        val q = query.lowercase()
        return entries.mapNotNull {
            when (it) {
                is ServerFolder -> filterFolder(it, q, selectedTags)
                is Server -> it.takeIf { s -> matches(s, q, selectedTags) }
            }
        }
    }

    private fun matches(s: Server, q: String, tags: Set<Int>): Boolean {
        val tagOk = tags.isEmpty() || s.tags.any { it.id in tags }
        return tagOk && (q.isEmpty() || s.name.lowercase().contains(q) || s.ip.lowercase().contains(q))
    }

    private fun filterFolder(folder: ServerFolder, q: String, tags: Set<Int>): ServerFolder? {
        val servers = folder.allServers.filter { matches(it, q, tags) }
        val folders = folder.allFolders.mapNotNull { filterFolder(it, q, tags) }
        return if (folder.name.lowercase().contains(q) || servers.isNotEmpty() || folders.isNotEmpty())
            folder.copy(entries = servers + folders) else null
    }

    fun collectTags(entries: List<Entry>): List<Tag> {
        val map = linkedMapOf<Int, Tag>()
        fun walk(list: List<Entry>) {
            for (e in list) when (e) {
                is Server -> e.tags.forEach { map[it.id] = it }
                is ServerFolder -> {
                    e.allServers.forEach { s -> s.tags.forEach { map[it.id] = it } }
                    walk(e.allFolders)
                }
            }
        }
        walk(entries)
        return map.values.sortedBy { it.name }
    }

    fun countServers(entries: List<Entry>): Int = entries.sumOf {
        when (it) {
            is Server -> 1
            is ServerFolder -> it.serverCount
        }
    }

    fun countOnline(entries: List<Entry>): Int = entries.sumOf {
        when (it) {
            is Server -> if (it.isRunning) 1 else 0
            is ServerFolder -> it.allServers.count(Server::isRunning) + countOnline(it.allFolders)
        }
    }

    fun flatten(entries: List<Entry>, expandedIds: Set<String>): List<ServerListRow> {
        val rows = mutableListOf<ServerListRow>()
        fun add(e: Entry, depth: Int) {
            when (e) {
                is Server -> rows += ServerListRow.ServerRow(e, depth)
                is ServerFolder -> {
                    val open = e.id != null && e.id in expandedIds
                    rows += ServerListRow.FolderRow(e, depth, open)
                    if (open) {
                        e.allServers.forEach { add(it, depth + 1) }
                        e.allFolders.forEach { add(it, depth + 1) }
                    }
                }
            }
        }
        entries.forEach { add(it, 0) }
        return rows
    }
}
