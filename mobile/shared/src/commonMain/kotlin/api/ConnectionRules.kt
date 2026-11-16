package dev.gnm.nexterm.api

import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerFolder
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.util.jsonOf
import kotlinx.serialization.json.JsonObject

enum class ServerAction(val label: String) {
    SFTP("SFTP"),
    QUICK_CONNECT("Quick Connect"),
    WAKE_ON_LAN("Wake-On-LAN"),
}

data class DirectIdentity(
    val type: String,
    val username: String?,
    val password: String?,
    val sshKey: String?,
    val passphrase: String?,
) {
    internal fun toJson(): JsonObject = jsonOf(
        "type" to type, "username" to username, "password" to password, "sshKey" to sshKey, "passphrase" to passphrase,
    )
}

class ConnectRequest(val server: Server, val type: ConnectionType, val identity: DirectIdentity?, val needsReason: Boolean)

sealed class ConnectStep {
    class Message(val text: String) : ConnectStep()
    class Wake(val server: Server) : ConnectStep()
    class QuickConnect(val server: Server, val type: ConnectionType) : ConnectStep()
    class Connect(val request: ConnectRequest) : ConnectStep()
}

data class AuthTypeOption(val id: String, val label: String) {
    val showsUsername: Boolean get() = id != "password-only"
    val showsPassword: Boolean get() = id == "password" || id == "password-only" || id == "both"
    val showsKey: Boolean get() = id == "ssh" || id == "both"
}

class ValidationException(message: String) : Exception(message)

object ConnectionRules {
    internal fun plan(server: Server, action: ServerAction?, tree: List<Entry>): ConnectStep {
        val defaultType = if (server.isGuacamole) ConnectionType.GUACAMOLE else ConnectionType.TERMINAL
        fun connect(type: ConnectionType) = ConnectStep.Connect(request(server, type, null, tree))
        fun quickConnect(type: ConnectionType) = when {
            server.isPve -> ConnectStep.Message("Quick Connect is not supported for Proxmox entries")
            server.protocolLower == "telnet" -> connect(type)
            else -> ConnectStep.QuickConnect(server, type)
        }
        return when {
            action == ServerAction.WAKE_ON_LAN -> ConnectStep.Wake(server)
            action == ServerAction.QUICK_CONNECT -> quickConnect(defaultType)
            server.isStopped -> ConnectStep.Message("${server.name} is ${if (server.isPve) "not running" else "offline"}")
            action == ServerAction.SFTP -> if (server.hasIdentities) connect(ConnectionType.SFTP) else quickConnect(ConnectionType.SFTP)
            !server.isPve && !server.hasIdentities -> quickConnect(defaultType)
            server.isGuacamole || server.type == "pve-qemu" -> connect(ConnectionType.GUACAMOLE)
            else -> connect(ConnectionType.TERMINAL)
        }
    }

    internal fun request(server: Server, type: ConnectionType, identity: DirectIdentity?, tree: List<Entry>) =
        ConnectRequest(server, type, identity, server.entryId?.let { findOrganization(it, tree, null)?.requireConnectionReason } == true)

    fun supportsSftp(server: Server) = server.protocolLower == "ssh" && !server.isPve

    fun secondaryActions(server: Server): List<ServerAction> = buildList {
        if (supportsSftp(server)) add(ServerAction.SFTP)
        if (server.isServer && !server.isPve) add(ServerAction.QUICK_CONNECT)
        if (server.canWakeOnLan) add(ServerAction.WAKE_ON_LAN)
    }

    fun allowedAuthTypes(protocol: String?): List<AuthTypeOption> = when (protocol?.lowercase()) {
        "rdp", "vnc" -> listOf("password-only", "password")
        else -> listOf("password", "ssh", "both")
    }.map { AuthTypeOption(it, authLabels[it] ?: it) }

    private val authLabels = mapOf("password-only" to "No Username", "password" to "Password", "ssh" to "SSH Key", "both" to "Key+Pass")

    @Throws(ValidationException::class)
    fun buildDirectIdentity(authType: String, username: String, password: String, sshKey: String?, passphrase: String): DirectIdentity {
        val opt = AuthTypeOption(authType, "")
        if (opt.showsUsername && username.trim().isEmpty()) throw ValidationException("Username is required")
        if (opt.showsPassword && password.isEmpty()) throw ValidationException("Password is required")
        if (opt.showsKey && sshKey.isNullOrEmpty()) throw ValidationException("SSH key is required")
        val pass = passphrase.takeIf { it.isNotEmpty() }
        return when (authType) {
            "password", "password-only" -> DirectIdentity(authType, username.trim().takeIf { opt.showsUsername }, password, null, null)
            "both" -> DirectIdentity(authType, username.trim(), password, sshKey, pass)
            else -> DirectIdentity(authType, username.trim(), null, sshKey, pass)
        }
    }

    private fun findOrganization(serverId: Int, items: List<Entry>, currentOrg: ServerFolder?): ServerFolder? {
        for (item in items) when (item) {
            is Server -> if (item.entryId == serverId) return currentOrg
            is ServerFolder -> {
                val org = if (item.isOrganization) item else currentOrg
                findOrganization(serverId, item.allServers + item.allFolders, org)?.let { return it }
            }
        }
        return null
    }

    const val CONNECTION_REASON_MAX_LENGTH = 500
}
