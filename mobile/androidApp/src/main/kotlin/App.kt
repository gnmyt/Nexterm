package dev.gnm.nexterm.app

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Settings
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
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.clearAndSetSemantics

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
    MONITORING("Monitoring", Icons.Outlined.BarChart, Icons.Filled.BarChart),
    ASSISTANT("Assistant", Icons.Outlined.AutoAwesome, Icons.Filled.AutoAwesome),
    SETTINGS("Settings", Icons.Outlined.Settings, Icons.Filled.Settings),
}

@Composable
private fun MainScreen(openAddServer: () -> Unit) {
    val account by nx.accounts.activeAccount.watch()
    key(account?.id) {
        val sessions by nx.sessions.sessions.watch()
        val fullscreen by nx.sessions.fullscreen.watch()
        val aiAvailable by nx.ai.isAvailable.watch()
        var tab by rememberSaveable { mutableStateOf(Tab.SERVERS) }
        var settingsPage by remember { mutableStateOf<SettingsPage?>(null) }
        var layerOpen by rememberSaveable { mutableStateOf(false) }
        if (tab == Tab.ASSISTANT && !aiAvailable) tab = Tab.SERVERS
        val servers = rememberClosing(create = nx::newServerList, close = { it.close() })
        val monitoring = rememberClosing(create = nx::newMonitoring, close = { it.close() })
        LaunchedEffect(servers) { servers.load() }

        val twoPane = isTwoPane()
        val layer = sessions.isNotEmpty() && (fullscreen || !twoPane && layerOpen)
        val focus = LocalFocusManager.current
        val keyboard = LocalSoftwareKeyboardController.current
        LaunchedEffect(sessions.isEmpty()) { if (sessions.isEmpty()) layerOpen = false }
        LaunchedEffect(layer) { focus.clearFocus(); keyboard?.hide() }

        BackHandler(tab != Tab.SERVERS) { tab = Tab.SERVERS }
        val tabs = Tab.entries.filter { it != Tab.ASSISTANT || aiAvailable }
        val holder = rememberSaveableStateHolder()
        val layout = NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(currentWindowAdaptiveInfo())
        val hideNavigation = layout == NavigationSuiteType.NavigationBar && tab == Tab.SETTINGS && settingsPage != null
        Box(Modifier.fillMaxSize()) {
            NavigationSuiteScaffold(
                modifier = if (layer) Modifier.clearAndSetSemantics {} else Modifier,
                layoutType = if (hideNavigation) NavigationSuiteType.None else layout,
                navigationSuiteItems = {
                    tabs.forEach { t ->
                        item(selected = t == tab, onClick = { tab = t }, label = { Text(t.label) }, icon = { Icon(if (t == tab) t.selectedIcon else t.icon, null) })
                    }
                },
            ) {
                Scaffold(
                    contentWindowInsets = WindowInsets(0), snackbarHost = { if (!layer) AppSnackbar() },
                    bottomBar = { if (!twoPane && !layer && sessions.isNotEmpty()) SessionDock { layerOpen = true } },
                ) { padding ->
                    Crossfade(tab, Modifier.padding(padding).consumeWindowInsets(padding).fillMaxSize(), label = "tab") { t ->
                        holder.SaveableStateProvider(t.name) {
                            Box(Modifier.fillMaxSize()) {
                                when (t) {
                                    Tab.SERVERS -> {
                                        val list = @Composable {
                                            ServersScreen(servers, openAddServer, onAuthorize = { settingsPage = SettingsPage.Authorize(it); tab = Tab.SETTINGS }, onConnected = { layerOpen = true })
                                        }
                                        if (!twoPane) list() else if (!fullscreen) ListDetail(false, {}, { list() }) { ActiveSessionsScreen(overlay = false, onMinimise = null) }
                                    }
                                    Tab.MONITORING -> MonitoringScreen(monitoring)
                                    Tab.ASSISTANT -> AssistantScreen(servers)
                                    Tab.SETTINGS -> SettingsScreen(settingsPage, { settingsPage = it }, openAddServer)
                                }
                            }
                        }
                    }
                }
            }
            AnimatedVisibility(layer, enter = slideInVertically { it / 6 } + fadeIn(), exit = slideOutVertically { it / 6 } + fadeOut()) {
                BackHandler(!twoPane) { layerOpen = false }
                ActiveSessionsScreen(overlay = true, onMinimise = if (twoPane) null else { { layerOpen = false } })
            }
        }
    }
}
