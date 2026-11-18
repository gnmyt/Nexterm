package dev.gnm.nexterm.api

import dev.gnm.nexterm.model.Entry
import dev.gnm.nexterm.model.Identity
import dev.gnm.nexterm.model.LiveSession
import dev.gnm.nexterm.model.Script
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerFolder
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.session.HibernatedSession
import dev.gnm.nexterm.util.jsonOf
import kotlinx.serialization.json.JsonObject

enum class ServerAction(val iconKey: String, val isDestructive: Boolean = false) {
    JOIN("broadcast"),
    RESUME("restore"),
    CONNECT("lan-connect"),
    SFTP("folder-outline"),
    BROWSER("web"),
    SCRIPT("script-text-outline"),
    QUICK_CONNECT("cursor-default-click"),
    WAKE_ON_LAN("power"),
    START("play"),
    SHUTDOWN("power"),
    STOP("stop", isDestructive = true),
}

enum class PowerOperation(val path: String, val done: String) {
    START("start", "Starting"),
    SHUTDOWN("shutdown", "Shutting down"),
    STOP("stop", "Stopping"),
}

sealed class ServerIntent {
    data class Connect(val server: Server, val type: ConnectionType?, val identityId: Int?) : ServerIntent()
    data class QuickConnect(val server: Server) : ServerIntent()
    data class RunScript(val server: Server, val identityId: Int?) : ServerIntent()
    data class Wake(val server: Server) : ServerIntent()
    data class Power(val server: Server, val operation: PowerOperation) : ServerIntent()
    data class Resume(val sessionId: String) : ServerIntent()
    data class Join(val session: LiveSession) : ServerIntent()
}

data class ServerMenuOption(val label: String, val intent: ServerIntent)

data class ServerMenuItem(val action: ServerAction, val label: String, val intent: ServerIntent, val options: List<ServerMenuOption> = emptyList()) {
    val hasOptions: Boolean get() = options.isNotEmpty()
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

class ConnectRequest internal constructor(
    val server: Server,
    val type: ConnectionType,
    val identityId: Int?,
    val identity: DirectIdentity?,
    val needsReason: Boolean,
    val script: Script? = null,
)

sealed class ConnectStep {
    class Message(val text: String) : ConnectStep()
    class QuickConnect(val server: Server, val type: ConnectionType) : ConnectStep()
    class Connect(val request: ConnectRequest) : ConnectStep()
    class PickScript(val server: Server, val identityId: Int?) : ConnectStep()
    class Execute(val intent: ServerIntent) : ConnectStep()
}

class ActionResult(val message: String?, val openedSession: Boolean)

data class AuthTypeOption(val id: String, val label: String) {
    val showsUsername: Boolean get() = id != "password-only"
    val showsPassword: Boolean get() = id == "password" || id == "password-only" || id == "both"
    val showsKey: Boolean get() = id == "ssh" || id == "both"
}

class ValidationException(message: String) : Exception(message)

internal class ServerContext(
    val tree: List<Entry>,
    val identities: List<Identity>,
    val hibernated: List<HibernatedSession>,
    val live: List<LiveSession>,
    val hasScripts: Boolean,
)

object ConnectionRules {
    fun defaultType(server: Server): ConnectionType = when {
        server.isFileTransfer -> ConnectionType.SFTP
        server.isGuacamole -> ConnectionType.GUACAMOLE
        else -> ConnectionType.TERMINAL
    }

    fun supportsSftp(server: Server) = server.isShell

    internal fun plan(intent: ServerIntent, context: ServerContext): ConnectStep = when (intent) {
        is ServerIntent.Wake, is ServerIntent.Power, is ServerIntent.Resume, is ServerIntent.Join -> ConnectStep.Execute(intent)
        is ServerIntent.QuickConnect -> quickConnect(intent.server, defaultType(intent.server), context)
        is ServerIntent.RunScript -> intent.server.offlineMessage()?.let(ConnectStep::Message)
            ?: ConnectStep.PickScript(intent.server, intent.identityId ?: intent.server.identities.firstOrNull())
        is ServerIntent.Connect -> planConnect(intent, context)
    }

    private fun planConnect(intent: ServerIntent.Connect, context: ServerContext): ConnectStep {
        val server = intent.server
        val type = intent.type ?: defaultType(server)
        val identityId = intent.identityId ?: server.identities.firstOrNull()
        val paused = context.hibernated.firstOrNull { intent.type == null && it.server.id == server.id && (intent.identityId == null || it.identityId == intent.identityId) }
        return when {
            paused != null -> ConnectStep.Execute(ServerIntent.Resume(paused.sessionId))
            server.offlineMessage() != null -> ConnectStep.Message(server.offlineMessage()!!)
            !server.isPve && !server.isCredentialless && !server.hasIdentities -> quickConnect(server, type, context)
            else -> ConnectStep.Connect(request(server, type, identityId, null, null, context.tree))
        }
    }

    private fun quickConnect(server: Server, type: ConnectionType, context: ServerContext): ConnectStep = when {
        server.isPve -> ConnectStep.Message("Quick Connect is not supported for Proxmox entries")
        server.isCredentialless -> ConnectStep.Connect(request(server, type, null, null, null, context.tree))
        else -> ConnectStep.QuickConnect(server, type)
    }

    private fun Server.offlineMessage(): String? = if (isStopped) "$name is ${if (isPve) "not running" else "offline"}" else null

    internal fun request(server: Server, type: ConnectionType, identityId: Int?, identity: DirectIdentity?, script: Script?, tree: List<Entry>) =
        ConnectRequest(
            server, type, identityId.takeIf { identity == null }, identity,
            server.entryId?.let { findOrganization(it, tree, null)?.requireConnectionReason } == true, script,
        )

    internal fun menu(server: Server, context: ServerContext): List<ServerMenuItem> = buildList {
        val names = context.identities.associate { it.id to it.name }
        fun perIdentity(type: ConnectionType?, intent: (Int?) -> ServerIntent = { ServerIntent.Connect(server, type, it) }) =
            server.identities.takeIf { it.size > 1 }.orEmpty().map { ServerMenuOption(names[it] ?: "Identity $it", intent(it)) }

        val live = context.live.filter { it.entryId == server.entryId }
        if (live.size == 1) add(ServerMenuItem(ServerAction.JOIN, "Join Session of ${live[0].ownerName}", ServerIntent.Join(live[0])))
        else if (live.isNotEmpty()) add(ServerMenuItem(ServerAction.JOIN, "Join Session", ServerIntent.Join(live[0]), live.map { ServerMenuOption(it.ownerName, ServerIntent.Join(it)) }))

        val paused = context.hibernated.filter { it.server.id == server.id }
        if (paused.isNotEmpty()) add(ServerMenuItem(
            ServerAction.RESUME, "Resume Session", ServerIntent.Resume(paused[0].sessionId),
            paused.takeIf { it.size > 1 }.orEmpty().map { ServerMenuOption(it.subtitle, ServerIntent.Resume(it.sessionId)) },
        ))

        if (!server.isPve || server.isRunning) {
            val label = when {
                server.isFileTransfer -> "Open File Browser"
                supportsSftp(server) -> "Open Terminal"
                else -> "Connect"
            }
            add(ServerMenuItem(ServerAction.CONNECT, label, ServerIntent.Connect(server, null, null), perIdentity(defaultType(server))))
        }
        if (supportsSftp(server)) add(ServerMenuItem(ServerAction.SFTP, "File Browser", ServerIntent.Connect(server, ConnectionType.SFTP, null), perIdentity(ConnectionType.SFTP)))
        if (server.isShell && server.hasIdentities) {
            add(ServerMenuItem(ServerAction.BROWSER, "Web Browser", ServerIntent.Connect(server, ConnectionType.BROWSER, null), perIdentity(ConnectionType.BROWSER)))
            if (context.hasScripts) add(ServerMenuItem(ServerAction.SCRIPT, "Run Script", ServerIntent.RunScript(server, null), perIdentity(null) { ServerIntent.RunScript(server, it) }))
        }
        if (server.isServer && !server.isCredentialless) add(ServerMenuItem(ServerAction.QUICK_CONNECT, "Quick Connect", ServerIntent.QuickConnect(server)))
        if (server.canWakeOnLan) add(ServerMenuItem(ServerAction.WAKE_ON_LAN, "Wake-On-LAN", ServerIntent.Wake(server)))
        if (server.isPve && server.status == "stopped") add(ServerMenuItem(ServerAction.START, "Start", ServerIntent.Power(server, PowerOperation.START)))
        if (server.isPve && server.isRunning && server.status != null && server.type != "pve-shell") {
            add(ServerMenuItem(ServerAction.SHUTDOWN, "Shut Down", ServerIntent.Power(server, PowerOperation.SHUTDOWN)))
            add(ServerMenuItem(ServerAction.STOP, "Stop", ServerIntent.Power(server, PowerOperation.STOP)))
        }
    }

    fun allowedAuthTypes(protocol: String?): List<AuthTypeOption> = when (protocol?.lowercase()) {
        "rdp", "vnc" -> listOf("password-only", "password")
        "ftp", "ftps" -> listOf("password")
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
