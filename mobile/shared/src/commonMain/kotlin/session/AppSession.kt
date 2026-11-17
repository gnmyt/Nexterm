package dev.gnm.nexterm.session

import dev.gnm.nexterm.guacamole.GuacamoleSession
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerAccount
import kotlinx.coroutines.flow.StateFlow

enum class ConnectionType(val label: String, val iconKey: String) {
    GUACAMOLE("Remote Desktop", "monitor-small"),
    TERMINAL("Terminal", "console"),
    SFTP("File Browser", "folder-outline"),
}

enum class AgentOrigin(val viewOnlyMessage: String) {
    AI("The AI assistant is working in this session. You can watch, but not type."),
    MCP("An external agent (MCP) is working in this session. You can watch, but not type."),
}

class AppSession internal constructor(
    val sessionId: String,
    val server: Server,
    val type: ConnectionType,
    val account: ServerAccount,
    val terminal: TerminalConnection?,
    val sftp: SftpBrowser?,
    val guacamole: GuacamoleSession?,
    val agent: AgentOrigin? = null,
) {
    val isViewOnly: Boolean get() = agent != null

    val connectionState: StateFlow<ConnectionState>
        get() = terminal?.state ?: sftp?.connectionState ?: guacamole!!.state

    val supportsSnippets: Boolean get() = type == ConnectionType.TERMINAL && !isViewOnly
    val supportsAI: Boolean get() = type == ConnectionType.TERMINAL && !isViewOnly
    val hasToolMenu: Boolean get() = type == ConnectionType.GUACAMOLE

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
