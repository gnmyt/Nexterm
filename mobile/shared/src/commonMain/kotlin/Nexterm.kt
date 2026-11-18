package dev.gnm.nexterm

import com.russhwolf.settings.Settings
import dev.gnm.nexterm.session.AIAssistantChannel
import dev.gnm.nexterm.session.AIChatSession
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.AppInfo
import dev.gnm.nexterm.api.DeviceSetupFlow
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.SessionManager
import dev.gnm.nexterm.state.FolderStateStore
import dev.gnm.nexterm.state.SftpSettings
import dev.gnm.nexterm.state.TerminalSettings
import dev.gnm.nexterm.state.ThemeSettings
import dev.gnm.nexterm.state.AIManager
import dev.gnm.nexterm.state.MonitoringController
import dev.gnm.nexterm.state.AccountManager
import dev.gnm.nexterm.state.ServerListController
import dev.gnm.nexterm.state.SnippetManager
import dev.gnm.nexterm.state.ScriptManager
import dev.gnm.nexterm.state.StateStream
import dev.gnm.nexterm.state.ClientIds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.job
import kotlinx.coroutines.launch

class Nexterm private constructor(appVersion: String) {
    private val settings = Settings()
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val accounts = AccountManager(settings, ApiClient.createHttpClient(), AppInfo.userAgent(appVersion), scope)
    private val api = accounts.api
    val snippets = SnippetManager(api)
    val scripts = ScriptManager(api)
    val ai = AIManager(api)
    private val ids = ClientIds(settings)
    val stream = StateStream(api, ids, scope) { account -> accounts.removeAccount(account.id) }

    val themeSettings = ThemeSettings(settings)
    val terminalSettings = TerminalSettings(settings)
    val sftpSettings = SftpSettings(settings)
    val folderState = FolderStateStore(settings)

    val sessions = SessionManager(api, ids, accounts, sftpSettings, terminalSettings, stream, scripts, scope)

    init {
        scope.launch {
            accounts.activeAccount.distinctUntilChanged { a, b -> a?.id == b?.id }.collect { account ->
                if (account != null) {
                    sessions.disconnectAll()
                    stream.start(account)
                    launch { snippets.loadSnippets(true) }
                    launch { scripts.load() }
                    launch { ai.loadSettings() }
                    launch { sessions.restoreSessions() }
                } else {
                    stream.stop()
                    scripts.clear()
                    snippets.clear()
                    ai.clear()
                    sessions.disconnectAll()
                }
            }
        }
    }

    fun newDeviceSetupFlow(): DeviceSetupFlow = DeviceSetupFlow(api, accounts, childScope(), 5_000)

    fun newServerList(): ServerListController = ServerListController(api, folderState, stream, sessions, scripts, childScope())

    fun newMonitoring(): MonitoringController = MonitoringController(api, childScope(), 60_000)

    fun newAIChat(session: AppSession): AIChatSession {
        val chatScope = childScope()
        val channel = AIAssistantChannel(api.forBaseUrl(session.account.baseUrl), session.account.token, session.sessionId, chatScope)
        return AIChatSession(channel, chatScope, session.server.name).also { it.start() }
    }

    fun onResume() {
        if (accounts.isAuthenticated.value) scope.launch { sessions.restoreSessions() }
    }

    fun close() {
        sessions.disconnectAll()
        scope.cancel()
    }

    private fun childScope() = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext.job))

    companion object {
        lateinit var shared: Nexterm
            private set

        fun start(appVersion: String): Nexterm {
            if (!this::shared.isInitialized) shared = Nexterm(appVersion)
            return shared
        }
    }
}
