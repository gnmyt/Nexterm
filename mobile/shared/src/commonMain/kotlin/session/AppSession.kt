package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.DirectIdentity
import dev.gnm.nexterm.guacamole.GuacamoleSession
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerAccount
import dev.gnm.nexterm.util.Formatters
import kotlinx.coroutines.flow.StateFlow

enum class ConnectionType(val label: String, val iconKey: String) {
    GUACAMOLE("Remote Desktop", "monitor-small"),
    TERMINAL("Terminal", "console"),
    SFTP("File Browser", "folder-outline"),
    BROWSER("Web Browser", "web"),
    SCRIPT("Script", "script-text-outline"),
}

enum class AgentOrigin(val viewOnlyMessage: String) {
    AI("The AI assistant is working in this session. You can watch, but not type."),
    MCP("An external agent (MCP) is working in this session. You can watch, but not type."),
}

enum class SessionAction(val label: String, val iconKey: String, val isDestructive: Boolean = false) {
    OPEN_FILES("Open File Browser", "folder-outline"),
    OPEN_TERMINAL("Open Terminal Here", "console"),
    DUPLICATE("Duplicate", "content-duplicate"),
    RECONNECT("Reconnect", "refresh"),
    HIBERNATE("Hibernate", "power-sleep"),
    CLOSE("Close Session", "close", isDestructive = true),
}

data class HibernatedSession(val sessionId: String, val server: Server, val type: ConnectionType, val identityId: Int?, val lastActivity: Long?) {
    val subtitle: String get() = "${type.label} · ${Formatters.relativeTime(lastActivity)}"
}

internal class SessionOrigin(
    val identityId: Int?,
    val directIdentity: DirectIdentity?,
    val connectionReason: String?,
    val typeParameter: String?,
    val scriptId: Int?,
    val joinedSessionId: String? = null,
)

class AppSession internal constructor(
    val sessionId: String,
    val server: Server,
    val type: ConnectionType,
    val account: ServerAccount,
    val terminal: TerminalConnection?,
    val sftp: SftpBrowser?,
    val guacamole: GuacamoleSession?,
    val agent: AgentOrigin? = null,
    val script: ScriptRun? = null,
    val browser: BrowserControl? = null,
    val viewOnlyMessage: String? = agent?.viewOnlyMessage,
    internal val origin: SessionOrigin = SessionOrigin(null, null, null, null, null),
    internal var generation: Int = 0,
) {
    internal var lastRecovery = 0L

    val isViewOnly: Boolean get() = viewOnlyMessage != null
    val isJoined: Boolean get() = origin.joinedSessionId != null

    val connectionState: StateFlow<ConnectionState>
        get() = terminal?.state ?: sftp?.connectionState ?: guacamole!!.state

    val supportsSnippets: Boolean get() = type == ConnectionType.TERMINAL && !isViewOnly
    val supportsAI: Boolean get() = type == ConnectionType.TERMINAL && !isViewOnly && !isJoined
    val hasToolMenu: Boolean get() = guacamole != null

    val actions: List<SessionAction>
        get() = buildList {
            val own = !isJoined && agent == null
            if (own && type == ConnectionType.TERMINAL && server.isShell) add(SessionAction.OPEN_FILES)
            if (own && type == ConnectionType.SFTP && server.isShell) add(SessionAction.OPEN_TERMINAL)
            if (own && type != ConnectionType.SCRIPT) add(SessionAction.DUPLICATE)
            add(SessionAction.RECONNECT)
            if (own && type != ConnectionType.SCRIPT) add(SessionAction.HIBERNATE)
            add(SessionAction.CLOSE)
        }

    internal fun disconnect() {
        terminal?.close()
        sftp?.close()
        guacamole?.close()
    }

    internal fun reconnect() {
        terminal?.reconnect()
        sftp?.reconnect()
        guacamole?.reconnect()
    }
}
