package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Flag
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.NextermJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlin.time.Instant

@Serializable
data class Identity(val id: Int = 0, val name: String = "", val username: String? = null, val type: String? = null)

@Serializable
data class Script(
    val id: Int = 0,
    val name: String = "",
    val description: String? = null,
    val organizationId: Int? = null,
    val sourceId: Int? = null,
    private val osFilter: JsonElement? = null,
) {
    val isFromSource: Boolean get() = sourceId != null
    internal val isHidden: Boolean get() = name == "???" && description == "What happened?"

    internal val systems: List<String>
        get() = runCatching {
            val raw = osFilter
            val list = if (raw is JsonPrimitive && raw.isString) NextermJson.parseToJsonElement(raw.content) else raw
            (list as? JsonArray)?.let { NextermJson.decodeFromJsonElement(ListSerializer(String.serializer()), it) }
        }.getOrNull().orEmpty()

    fun matches(query: String): Boolean {
        val q = query.trim().lowercase()
        return q.isEmpty() || name.lowercase().contains(q) || description?.lowercase()?.contains(q) == true
    }

    internal fun runsOn(osName: String?, isPve: Boolean): Boolean {
        val filter = systems
        val hasPve = PVE in filter
        return when {
            filter.isEmpty() -> true
            isPve -> hasPve
            filter.size == 1 && hasPve -> false
            osName == null -> true
            else -> osName in filter
        }
    }

    internal companion object {
        const val PVE = "Proxmox VE"

        private val systemNames = listOf(
            "ubuntu" to "Ubuntu", "debian" to "Debian", "alpine" to "Alpine Linux", "fedora" to "Fedora", "centos" to "CentOS",
            "red hat" to "Red Hat", "rhel" to "Red Hat", "rocky" to "Rocky Linux", "alma" to "AlmaLinux", "opensuse" to "openSUSE",
            "suse" to "openSUSE", "arch" to "Arch Linux", "manjaro" to "Manjaro", "gentoo" to "Gentoo", "nixos" to "NixOS", "proxmox" to PVE,
        )

        fun normalizeSystem(osName: String?): String? {
            val lower = osName?.lowercase() ?: return null
            return systemNames.firstOrNull { lower.contains(it.first) }?.second
        }
    }
}

@Serializable
internal class RecentConnection(val entryId: Int = 0)

@Serializable
data class LiveSession(
    val id: String = "",
    val entryId: Int = 0,
    val entryName: String? = null,
    val organizationName: String? = null,
    val type: String? = null,
    val renderer: String? = null,
    val protocol: String? = null,
    val icon: String? = null,
    val writable: Flag = false,
    private val owner: Owner? = null,
) {
    @Serializable
    data class Owner(val username: String? = null, val firstName: String? = null, val lastName: String? = null)

    val ownerName: String
        get() = listOfNotNull(owner?.firstName, owner?.lastName).joinToString(" ").trim().ifEmpty { owner?.username ?: "another user" }
}

internal fun parseTimestamp(iso: String?): Long? = iso?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() }

internal fun relativeTimestamp(iso: String?): String = Formatters.relativeTime(parseTimestamp(iso))
