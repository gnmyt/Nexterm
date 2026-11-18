package dev.gnm.nexterm.app

import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.DynamicFeed
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

@Composable
fun App() {
    val scope = rememberCoroutineScope()
    val toaster = remember { Toaster(SnackbarHostState(), scope) }
    val authenticated by nx.accounts.isAuthenticated.watch()
    CompositionLocalProvider(LocalToaster provides toaster) {
        if (!authenticated) DeviceSetupScreen(isAddingServer = false, onDone = {}) else Box {
            var adding by rememberSaveable { mutableStateOf(false) }
            MainScreen(openAddServer = { adding = true })
            if (adding) {
                BackHandler { adding = false }
                DeviceSetupScreen(isAddingServer = true, onDone = { adding = false }, onBack = { adding = false })
            }
        }
    }
}

private enum class Tab(val label: String, val icon: ImageVector, val selectedIcon: ImageVector) {
    SERVERS("Servers", Icons.Outlined.Dns, Icons.Filled.Dns),
    SESSIONS("Sessions", Icons.Outlined.DynamicFeed, Icons.Outlined.DynamicFeed),
    MONITORING("Monitoring", Icons.Outlined.BarChart, Icons.Filled.BarChart),
    SETTINGS("Settings", Icons.Outlined.Settings, Icons.Filled.Settings),
}

@Composable
private fun MainScreen(openAddServer: () -> Unit) {
    val account by nx.accounts.activeAccount.watch()
    key(account?.id) {
        val sessions by nx.sessions.sessions.watch()
        val fullscreenSession by nx.sessions.fullscreen.watch()
        var tab by rememberSaveable { mutableStateOf(Tab.SERVERS) }
        var settingsPage by remember { mutableStateOf<SettingsPage?>(null) }
        if (sessions.isEmpty() && tab == Tab.SESSIONS) tab = Tab.SERVERS
        val servers = rememberClosing(create = nx::newServerList, close = { it.close() })
        val monitoring = rememberClosing(create = nx::newMonitoring, close = { it.close() })
        LaunchedEffect(servers) { servers.load() }

        BackHandler(tab != Tab.SERVERS) { tab = Tab.SERVERS }
        val tabs = Tab.entries.filter { it != Tab.SESSIONS || sessions.isNotEmpty() }
        val holder = rememberSaveableStateHolder()
        val layout = NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(currentWindowAdaptiveInfo())
        val fullScreen = fullscreenSession || layout == NavigationSuiteType.NavigationBar && (tab == Tab.SESSIONS || (tab == Tab.SETTINGS && settingsPage != null))
        NavigationSuiteScaffold(
            layoutType = if (fullScreen) NavigationSuiteType.None else layout,
            navigationSuiteItems = {
                tabs.forEach { t ->
                    item(
                        selected = t == tab, onClick = { tab = t }, label = { Text(t.label) },
                        icon = {
                            val icon = if (t == tab) t.selectedIcon else t.icon
                            if (t == Tab.SESSIONS) BadgedBox({ Badge { Text("${sessions.size}") } }) { Icon(icon, null) } else Icon(icon, null)
                        },
                    )
                }
            },
        ) {
            Scaffold(contentWindowInsets = WindowInsets(0), snackbarHost = { AppSnackbar() }) { padding ->
                Crossfade(tab, Modifier.padding(padding).consumeWindowInsets(padding).fillMaxSize(), label = "tab") { t ->
                    holder.SaveableStateProvider(t.name) {
                        Box(Modifier.fillMaxSize()) {
                            when (t) {
                                Tab.SERVERS -> if (fullscreenSession) ActiveSessionsScreen(onExit = {}) else ListDetail(false, {}, { twoPane ->
                                    ServersScreen(servers, onSwitchToSessions = { if (nx.sessions.hasActiveSessions) tab = Tab.SESSIONS },
                                        onConnected = { if (!twoPane && nx.sessions.hasActiveSessions) tab = Tab.SESSIONS })
                                }) { ActiveSessionsScreen(onExit = {}) }
                                Tab.SESSIONS -> ActiveSessionsScreen(onExit = { tab = Tab.SERVERS })
                                Tab.MONITORING -> MonitoringScreen(monitoring)
                                Tab.SETTINGS -> SettingsScreen(settingsPage, { settingsPage = it }, openAddServer)
                            }
                        }
                    }
                }
            }
        }
    }
}
