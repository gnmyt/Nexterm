package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Flag
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.arr
import dev.gnm.nexterm.util.stringOnly
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

sealed class Entry {
    abstract val id: String?
    abstract val name: String
    abstract val type: String
}

@Serializable
data class Tag(val id: Int = 0, val name: String = "", val color: String = "") {
    val colorArgb: Long? get() = Formatters.parseHexColor(color)
}

@Serializable
data class Server(
    override val id: String? = null,
    override val name: String = "Unknown Server",
    val ip: String = "N/A",
    val icon: String? = null,
    val protocol: String? = null,
    override val type: String = "server",
    val identities: List<Int> = emptyList(),
    val online: Flag? = null,
    val status: String? = null,
    val tags: List<Tag> = emptyList(),
    val wakeOnLanEnabled: Flag = false,
    val macAddress: String? = null,
) : Entry() {
    val entryId: Int? get() = id?.toIntOrNull()
    val isPve: Boolean get() = type.startsWith("pve-")
    val isServer: Boolean get() = type == "server"
    val canWakeOnLan: Boolean get() = wakeOnLanEnabled && !macAddress?.trim().isNullOrEmpty()
    val isRunning: Boolean get() = if (status != null) status == "running" || status == "online" else online != false
    val isStopped: Boolean get() = if (status != null) status == "stopped" || status == "offline" else online == false
    val hasIdentities: Boolean get() = identities.isNotEmpty()
    val protocolLower: String? get() = protocol?.lowercase()
    val isGuacamole: Boolean get() = protocolLower == "rdp" || protocolLower == "vnc"
    val displayIp: String? get() = ip.takeIf { it.isNotEmpty() && it != "N/A" }
    val subtitle: String?
        get() = if (isPve && status != null) displayIp?.let { "$status · $it" } ?: status else displayIp
}

@Serializable
data class ServerFolder(
    override val id: String? = null,
    override val name: String = "",
    override val type: String = "folder",
    val requireConnectionReason: Flag = false,
    @Transient val entries: List<Entry> = emptyList(),
    val folderType: String? = null,
) : Entry() {
    val allServers: List<Server> get() = entries.filterIsInstance<Server>().filter { it.isServer } + entries.filterIsInstance<Server>().filter { it.isPve }
    val allFolders: List<ServerFolder> get() = entries.filterIsInstance<ServerFolder>().filter { it.type == "folder" } + entries.filterIsInstance<ServerFolder>().filter { it.isOrganization }
    val isPveNode: Boolean get() = folderType == "pve-node"
    val isOrganization: Boolean get() = type == "organization"
    val hasEntries: Boolean get() = entries.isNotEmpty()
    val serverCount: Int get() = allServers.size + allFolders.sumOf { it.serverCount }
}

object EntryParser {
    private val serverTypes = setOf("server", "pve-shell", "pve-lxc", "pve-qemu")

    fun parseList(json: JsonArray): List<Entry> = json.mapNotNull { item ->
        val o = item as? JsonObject ?: return@mapNotNull null
        val type = o.stringOnly("type")
        when {
            type == "organization" || type == "folder" -> parseList(o.arr("entries") ?: JsonArray(emptyList())).takeIf { it.isNotEmpty() }
                ?.let { NextermJson.decodeFromJsonElement(ServerFolder.serializer(), o).copy(entries = it) }
            type in serverTypes -> NextermJson.decodeFromJsonElement(Server.serializer(), o)
            else -> null
        }
    }
}
