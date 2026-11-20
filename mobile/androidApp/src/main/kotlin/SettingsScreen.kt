package dev.gnm.nexterm.app

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.api.AuthorizePayload
import dev.gnm.nexterm.api.QrPayloads
import dev.gnm.nexterm.model.ServerAccount
import dev.gnm.nexterm.model.SessionModel
import dev.gnm.nexterm.state.TerminalSettings
import dev.gnm.nexterm.state.ThemeMode
import dev.gnm.nexterm.state.ThemeSettings
import dev.gnm.nexterm.util.IconKeys
import dev.gnm.nexterm.util.UserAgents
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.terminal.TerminalThemes
import kotlinx.coroutines.launch

sealed interface SettingsPage {
    data object Accounts : SettingsPage
    data object Logins : SettingsPage
    data class Authorize(val payload: AuthorizePayload) : SettingsPage
}

@Composable
fun SettingsScreen(page: SettingsPage?, onPage: (SettingsPage?) -> Unit, openAddServer: () -> Unit) = ListDetail(page != null, { onPage(null) }, { SettingsList(page, onPage) }) { twoPane ->
    val back = if (twoPane) null else { { onPage(null) } }
    when (page) {
        SettingsPage.Accounts -> AccountsScreen(back, openAddServer)
        SettingsPage.Logins -> LoginSessionsScreen(back)
        is SettingsPage.Authorize -> key(page) { AuthorizeScreen(page.payload, back) { onPage(null) } }
        null -> DetailPlaceholder(Icons.Outlined.Settings, "Select a setting")
    }
}

@Composable
private fun SettingsList(page: SettingsPage?, onPage: (SettingsPage) -> Unit) {
    val account by nx.accounts.activeAccount.watch()
    val accounts by nx.accounts.accounts.watch()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val toaster = LocalToaster.current
    var confirmLogout by remember { mutableStateOf(false) }
    val sftp = nx.sftpSettings

    AppScreen("Settings") { padding ->
        Column(Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            account?.let { a ->
                SettingsGroup {
                    ListItem(
                        headlineContent = { Text(a.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                        supportingContent = { Text(a.displayUrl, style = MonoStyle, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                        leadingContent = { LogoTile() }, colors = transparentListItem,
                    )
                }
            }
            SectionHeader("Account")
            SettingsGroup {
                NavTile(Icons.Outlined.Lan, "Connections", "${accounts.size} server(s)", page == SettingsPage.Accounts) { onPage(SettingsPage.Accounts) }
                GroupDivider()
                NavTile(Icons.Outlined.Monitor, "Sessions", "Manage active sessions", page == SettingsPage.Logins) { onPage(SettingsPage.Logins) }
                GroupDivider()
                NavTile(Icons.Outlined.QrCodeScanner, "Scan QR Code", "Authorize a web login", page is SettingsPage.Authorize) {
                    scope.launch {
                        val raw = scanQrCode(context) ?: return@launch
                        QrPayloads.parseAuthorize(raw)?.let { onPage(SettingsPage.Authorize(it)) } ?: toaster.show("Invalid QR code")
                    }
                }
            }
            SectionHeader("Appearance")
            SettingsGroup { AppearanceSection(nx.themeSettings) }
            SectionHeader("Terminal")
            SettingsGroup { TerminalSection(nx.terminalSettings) }
            SettingsGroup(Modifier.padding(top = 8.dp)) { KeyboardToolbarSection(nx.terminalSettings) }
            SectionHeader("File Browser")
            SettingsGroup {
                SwitchTile(Icons.Outlined.VisibilityOff, "Show Hidden Files", "Show files starting with .", sftp.showHiddenFiles.watch().value, sftp::setShowHiddenFiles)
                GroupDivider()
                SwitchTile(Icons.Outlined.DeleteForever, "Confirm Before Delete", null, sftp.confirmBeforeDelete.watch().value, sftp::setConfirmBeforeDelete)
                GroupDivider()
                SwitchTile(Icons.Outlined.DriveFolderUpload, "Sort Folders First", null, sftp.sortFoldersFirst.watch().value, sftp::setSortFoldersFirst)
            }
            if (account != null) SettingsGroup(Modifier.padding(top = 20.dp)) {
                ListItem(
                    headlineContent = { Text("Log Out", color = MaterialTheme.colorScheme.error) }, leadingContent = { LeadingTile(Icons.AutoMirrored.Outlined.Logout, nxc.error) },
                    colors = transparentListItem, modifier = Modifier.clickable { confirmLogout = true },
                )
            }
        }
    }
    if (confirmLogout) ConfirmDialog("Log Out", "Are you sure you want to log out of ${account?.label ?: "this server"}?", "Log Out", destructive = true, onDismiss = { confirmLogout = false }) {
        scope.launch { nx.accounts.logout() }
    }
}

@Composable
private fun AppearanceSection(ts: ThemeSettings) {
    val mode by ts.themeMode.watch()
    val dynamic by ts.useDynamicColor.watch()
    val accent by ts.accentColor.watch()
    ListItem(
        headlineContent = { Text("Theme") }, leadingContent = { LeadingTile(Icons.Outlined.Contrast) }, colors = transparentListItem,
        trailingContent = {
            SingleChoiceSegmentedButtonRow(Modifier.width(168.dp)) {
                listOf(ThemeMode.SYSTEM to Icons.Outlined.BrightnessAuto, ThemeMode.LIGHT to Icons.Outlined.LightMode, ThemeMode.DARK to Icons.Outlined.DarkMode)
                    .forEachIndexed { i, (m, icon) ->
                        SegmentedButton(mode == m, { ts.setThemeMode(m) }, SegmentedButtonDefaults.itemShape(i, 3), icon = {}) { Icon(icon, m.name, Modifier.size(18.dp)) }
                    }
            }
        },
    )
    if (!dynamic || !supportsDynamicColor) {
        GroupDivider()
        ListItem(
            headlineContent = { Text("Accent Color") }, leadingContent = { LeadingTile(Icons.Outlined.FormatColorFill) }, colors = transparentListItem,
            trailingContent = { Text(ThemeSettings.ACCENTS.firstOrNull { it.argb == accent }?.name ?: "Custom") },
        )
        FlowRow(Modifier.padding(start = 68.dp, end = 16.dp, bottom = 14.dp), Arrangement.spacedBy(10.dp), Arrangement.spacedBy(10.dp)) {
            ThemeSettings.ACCENTS.forEach { option ->
                val selected = option.argb == accent
                Box(
                    Modifier.size(40.dp).clip(CircleShape).background(Color(option.argb))
                        .selectable(selected, role = Role.RadioButton) { ts.setAccentColor(option.argb) }.semantics { contentDescription = option.name },
                    Alignment.Center,
                ) { if (selected) Icon(Icons.Outlined.Check, null, Modifier.size(20.dp), Color.White) }
            }
        }
    }
    if (supportsDynamicColor) {
        GroupDivider()
        SwitchTile(Icons.Outlined.Palette, "Dynamic Color", "Use your wallpaper colors instead of the Nexterm theme", dynamic, ts::setUseDynamicColor)
    }
}

@Composable
private fun TerminalSection(ts: TerminalSettings) {
    val fontSize by ts.fontSize.watch()
    val themeId by ts.themeId.watch()
    val cursor by ts.cursorStyle.watch()
    ListItem(
        colors = transparentListItem,
        headlineContent = { Row { Text("Font Size", Modifier.weight(1f)); Text("${fontSize.toInt()} pt", style = MaterialTheme.typography.labelLarge, fontFamily = Mono) } },
        leadingContent = { LeadingTile(Icons.Outlined.FormatSize) },
        supportingContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton({ ts.setFontSize(fontSize - 1) }, enabled = fontSize > TerminalSettings.MIN_FONT_SIZE) { Icon(Icons.Outlined.Remove, "Smaller") }
                Slider(fontSize.toFloat(), { ts.setFontSize(it.toDouble()) }, Modifier.weight(1f),
                    valueRange = TerminalSettings.MIN_FONT_SIZE.toFloat()..TerminalSettings.MAX_FONT_SIZE.toFloat(), steps = 15)
                IconButton({ ts.setFontSize(fontSize + 1) }, enabled = fontSize < TerminalSettings.MAX_FONT_SIZE) { Icon(Icons.Outlined.Add, "Larger") }
            }
        },
    )
    GroupDivider()
    ListItem(headlineContent = { Text("Color Theme") }, leadingContent = { LeadingTile(Icons.Outlined.ColorLens) }, colors = transparentListItem)
    LazyRow(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(TerminalThemes.all, key = { it.id }) { t ->
            val sel = t.id == themeId
            OutlinedCard(
                { ts.setTheme(t.id) }, Modifier.size(80.dp, 64.dp), colors = CardDefaults.outlinedCardColors(Color(t.background)),
                border = BorderStroke(if (sel) 2.dp else 1.dp, if (sel) MaterialTheme.colorScheme.primary else nxc.border),
            ) {
                Column(Modifier.fillMaxSize().padding(6.dp), Arrangement.Center, Alignment.CenterHorizontally) {
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { (1..4).forEach { Badge(Modifier.size(10.dp), Color(t.palette.getOrElse(it) { t.foreground })) } }
                    Text(t.name, Modifier.padding(top = 4.dp), Color(t.foreground), style = MaterialTheme.typography.labelSmall, fontFamily = Mono, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
    GroupDivider()
    ListItem(
        headlineContent = { Text("Cursor") }, leadingContent = { LeadingTile(Icons.Outlined.CropSquare) }, colors = transparentListItem,
        supportingContent = {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                TerminalSettings.CURSOR_STYLES.forEachIndexed { i, c ->
                    SegmentedButton(cursor == c, { ts.setCursorStyle(c) }, SegmentedButtonDefaults.itemShape(i, TerminalSettings.CURSOR_STYLES.size)) {
                        Text(c.name.lowercase().replaceFirstChar(Char::uppercase))
                    }
                }
            }
        },
    )
}

@Composable
private fun KeyboardToolbarSection(ts: TerminalSettings) {
    val order by ts.groupOrder.watch()
    val enabled by ts.groupEnabled.watch()
    order.forEachIndexed { i, g ->
        if (i > 0) GroupDivider()
        ListItem(
            colors = transparentListItem,
            headlineContent = { Text(g.label) }, supportingContent = { Text(g.description) },
            leadingContent = {
                Column {
                    Icon(Icons.Outlined.KeyboardArrowUp, "Move up", Modifier.clickable(i > 0) { ts.moveGroup(i, i - 1) }.alpha(if (i > 0) 1f else 0.38f))
                    Icon(Icons.Outlined.KeyboardArrowDown, "Move down", Modifier.clickable(i < order.lastIndex) { ts.moveGroup(i, i + 1) }.alpha(if (i < order.lastIndex) 1f else 0.38f))
                }
            },
            trailingContent = { Switch(enabled[g] == true, { ts.setGroupEnabled(g, it) }) },
        )
    }
}

@Composable
private fun NavTile(icon: ImageVector, title: String, subtitle: String, selected: Boolean, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(title) }, supportingContent = { Text(subtitle) }, leadingContent = { LeadingTile(icon) },
    trailingContent = { Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
    colors = if (selected) ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer) else transparentListItem,
    modifier = Modifier.clickable(onClick = onClick),
)

@Composable
private fun SwitchTile(icon: ImageVector, title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit) = ListItem(
    headlineContent = { Text(title) }, supportingContent = subtitle?.let { { Text(it) } }, leadingContent = { LeadingTile(icon) },
    trailingContent = { Switch(checked, null) }, colors = transparentListItem, modifier = Modifier.toggleable(checked, role = Role.Switch, onValueChange = onChange),
)

@Composable
fun AccountsScreen(onBack: (() -> Unit)?, onAdd: () -> Unit) {
    val accounts by nx.accounts.accounts.watch()
    val active by nx.accounts.activeAccount.watch()
    val scope = rememberCoroutineScope()
    var rename by remember { mutableStateOf<ServerAccount?>(null) }
    var remove by remember { mutableStateOf<ServerAccount?>(null) }
    AppScreen("Connections", onBack = onBack, actions = { IconButton(onAdd) { Icon(Icons.Outlined.Add, "Add Server") } }) { padding ->
        if (accounts.isEmpty()) Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
            StateMessage(Icons.Outlined.CloudOff, "No connections", "Add a server to get started")
        } else LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(accounts, key = { it.id }) { a ->
                val isActive = a.id == active?.id
                var menu by remember { mutableStateOf(false) }
                SettingsGroup { ListItem(
                    colors = transparentListItem,
                    headlineContent = { Text(a.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    supportingContent = { Text(a.subtitle, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    overlineContent = if (isActive) { { Text("Active", color = nxc.success) } } else null,
                    leadingContent = { RadioButton(isActive, null) },
                    trailingContent = {
                        Box {
                            IconButton({ menu = true }) { Icon(Icons.Outlined.MoreVert, "More") }
                            DropdownMenu(menu, { menu = false }) {
                                if (!isActive) DropdownMenuItem({ Text("Switch to") }, { menu = false; nx.accounts.switchAccount(a.id) })
                                DropdownMenuItem({ Text("Rename") }, { menu = false; rename = a })
                                DropdownMenuItem({ Text("Remove") }, { menu = false; remove = a })
                            }
                        }
                    },
                    modifier = Modifier.selectable(isActive, role = Role.RadioButton) { if (!isActive) nx.accounts.switchAccount(a.id) },
                ) }
            }
        }
    }
    rename?.let { a -> TextInputDialog("Rename Server", "Label", a.label, "Rename", { rename = null }) { nx.accounts.renameAccount(a.id, it) } }
    remove?.let { a ->
        ConfirmDialog("Remove Server", "Remove \"${a.label}\"? This will log you out.", "Remove", true, { remove = null }) { scope.launch { nx.accounts.removeAccount(a.id) } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginSessionsScreen(onBack: (() -> Unit)?) {
    var sessions by remember { mutableStateOf<List<SessionModel>?>(null) }
    var loading by remember { mutableStateOf(true) }
    var revoke by remember { mutableStateOf<SessionModel?>(null) }
    val scope = rememberCoroutineScope()
    val toaster = LocalToaster.current
    val load: () -> Unit = { scope.launch { loading = true; sessions = nx.accounts.listSessions(); loading = false } }
    LaunchedEffect(Unit) { load() }
    AppScreen("Active Sessions", onBack = onBack, actions = { IconButton(load) { Icon(Icons.Outlined.Refresh, "Refresh") } }) { padding ->
        PullToRefreshBox(loading && sessions != null, load, Modifier.padding(padding).fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
                if (sessions == null) item { Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) { CircularProgressIndicator() } }
                else if (sessions!!.isEmpty()) item { StateMessage(Icons.Outlined.Monitor, "No other sessions", "Only this device is active") }
                items(sessions.orEmpty(), key = { it.id }) { s ->
                    SettingsGroup { ListItem(
                        colors = transparentListItem,
                        overlineContent = if (s.current == true) { { Text("This Device") } } else null,
                        headlineContent = { Text(UserAgents.deviceLabel(s.userAgent)) },
                        supportingContent = { Text("${s.ip ?: "Unknown IP"} · ${Formatters.relativeTime(s.lastActivity)}", style = MonoStyle) },
                        leadingContent = { LeadingTile(iconFor(IconKeys.userAgent(s.userAgent))) },
                        trailingContent = { if (s.current != true) IconButton({ revoke = s }) { Icon(Icons.Outlined.Delete, "Revoke", tint = MaterialTheme.colorScheme.error) } },
                    ) }
                }
            }
        }
    }
    revoke?.let { s ->
        ConfirmDialog("Revoke Session", "Are you sure you want to end this session?", "Revoke", onDismiss = { revoke = null }) {
            scope.launch {
                val ok = nx.accounts.revokeSession(s.id)
                toaster.show(if (ok) "Session revoked" else "Failed to revoke session")
                if (ok) load()
            }
        }
    }
}

@Composable
fun AuthorizeScreen(payload: AuthorizePayload, onBack: (() -> Unit)?, onDone: () -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val toaster = LocalToaster.current
    AppScreen("Authorize Login", onBack = onBack) { padding ->
        Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
            SettingsGroup(Modifier.padding(top = 8.dp)) {
                ListItem(
                    headlineContent = { Text("Web Login Request", style = MaterialTheme.typography.titleMedium) }, supportingContent = { Text(payload.server) },
                    leadingContent = { LeadingTile(Icons.Outlined.DesktopWindows) }, colors = transparentListItem,
                )
            }
            SettingsGroup {
                listOf(Triple(Icons.Outlined.Key, "Device Code", payload.code), Triple(Icons.Outlined.Language, "Server", payload.server)).forEachIndexed { i, (icon, label, value) ->
                    if (i > 0) GroupDivider()
                    ListItem(
                        headlineContent = { Text(value, fontFamily = Mono, maxLines = 1, overflow = TextOverflow.Ellipsis) }, overlineContent = { Text(label) },
                        leadingContent = { LeadingTile(icon) }, colors = transparentListItem,
                    )
                }
            }
            error?.let { ErrorBanner(it) }
            Column(Modifier.padding(16.dp), Arrangement.spacedBy(8.dp)) {
                Button({
                    busy = true; error = null
                    scope.launch {
                        try { nx.accounts.authorizeWebLogin(payload.code, payload.server); toaster.show("Login authorized"); onDone() }
                        catch (e: Exception) { error = e.message ?: "Authorization failed"; busy = false }
                    }
                }, Modifier.fillMaxWidth(), enabled = !busy) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Approve")
                }
                OutlinedButton(onDone, Modifier.fillMaxWidth(), enabled = !busy) { Text("Cancel") }
            }
        }
    }
}
