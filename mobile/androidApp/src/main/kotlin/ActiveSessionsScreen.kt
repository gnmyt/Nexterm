package dev.gnm.nexterm.app

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.session.HibernatedSession
import dev.gnm.nexterm.state.TerminalSettings
import kotlinx.coroutines.launch

private enum class SessionSheet { SWITCHER, ACTIONS }

private enum class ActionPage { MENU, SNIPPETS, GENERATE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveSessionsScreen(overlay: Boolean, onMinimise: (() -> Unit)?) {
    val sessions by nx.sessions.sessions.watch()
    val active by nx.sessions.activeSession.watch()
    val aiAvailable by nx.ai.isAvailable.watch()
    val fullscreen by nx.sessions.fullscreen.watch()
    val paused by nx.sessions.hibernated.watch()
    val trust by nx.sessions.trustChallenges.watch()
    val toaster = LocalToaster.current
    val view = LocalView.current
    DisposableEffect(fullscreen) {
        val bars = WindowInsetsControllerCompat((view.context as Activity).window, view)
        bars.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (fullscreen) bars.hide(WindowInsetsCompat.Type.systemBars()) else bars.show(WindowInsetsCompat.Type.systemBars())
        onDispose { bars.show(WindowInsetsCompat.Type.systemBars()) }
    }
    BackHandler(fullscreen) { nx.sessions.setFullscreen(false) }
    var sheet by remember { mutableStateOf<SessionSheet?>(null) }
    val session = active ?: sessions.firstOrNull() ?: return Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), Alignment.Center) {
        LogoMessage("No open session", "Pick a server to connect. Open sessions stay here while you browse.")
    }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxSize()) {
            if (!fullscreen) SessionTopBar(session, sessions, onMinimise, { sheet = SessionSheet.SWITCHER }, { sheet = SessionSheet.ACTIONS })
            Box(Modifier.weight(1f).fillMaxWidth()) {
                key(session.sessionId) {
                    when (session.type) {
                        ConnectionType.TERMINAL -> TerminalSessionView(session)
                        ConnectionType.SFTP -> SftpSessionView(session)
                        ConnectionType.GUACAMOLE -> GuacamoleSessionView(session)
                        ConnectionType.BROWSER -> BrowserSessionView(session)
                        ConnectionType.SCRIPT -> ScriptSessionView(session)
                    }
                }
                trust[session.sessionId]?.let { TrustPrompt(session.sessionId, it) }
                if (fullscreen) FilledIconButton(
                    { nx.sessions.setFullscreen(false) }, Modifier.align(Alignment.TopEnd).windowInsetsPadding(WindowInsets.displayCutout).padding(8.dp).size(36.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(Color.Black.copy(alpha = 0.45f), Color.White),
                ) { Icon(Icons.Outlined.FullscreenExit, "Exit full screen", Modifier.size(20.dp)) }
            }
        }
        if (overlay) AppSnackbar(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().keyboardPadding().padding(bottom = 56.dp))
    }

    when (sheet) {
        SessionSheet.SWITCHER -> ModalBottomSheet({ sheet = null }) {
            SessionSwitcher(sessions, paused, session.sessionId,
                onSelect = { nx.sessions.setActive(it); sheet = null },
                onResume = { id ->
                    sheet = null
                    nx.scope.launch { try { nx.sessions.resume(id) } catch (e: Exception) { toaster.show(e.message ?: "Failed to resume session") } }
                },
                onClose = { id -> nx.scope.launch { nx.sessions.closeSession(id) }; if (sessions.size <= 1) sheet = null },
                onExit = onMinimise?.let { { sheet = null; nx.sessions.setFullscreen(false); it() } })
        }
        SessionSheet.ACTIONS -> QuickActionsSheet(session, fullscreen, aiAvailable) { sheet = null }
        null -> Unit
    }
}

@Composable
private fun SessionTopBar(session: AppSession, sessions: List<AppSession>, onMinimise: (() -> Unit)?, onSwitch: () -> Unit, onActions: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val toaster = LocalToaster.current
    Surface(color = cs.surface, contentColor = cs.onSurface) { Column(Modifier.statusBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(48.dp)) {
            if (onMinimise != null) IconButton(onMinimise, Modifier.align(Alignment.CenterStart)) { Icon(Icons.Outlined.KeyboardArrowDown, "Minimise") }
            Box(Modifier.align(Alignment.Center).padding(horizontal = 100.dp).fillMaxHeight().clip(CircleShape).clickable(onClickLabel = "Switch session", onClick = onSwitch), Alignment.Center) {
                Row(
                    Modifier.height(32.dp).background(nxc.fill, CircleShape).border(1.dp, nxc.border, CircleShape).padding(horizontal = 12.dp),
                    Arrangement.spacedBy(7.dp), Alignment.CenterVertically,
                ) {
                    Icon(iconFor(session.type.iconKey), null, Modifier.size(15.dp), cs.onSurfaceVariant)
                    Text(session.server.name, Modifier.weight(1f, fill = false), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (sessions.size > 1) Text("${sessions.indexOf(session) + 1}/${sessions.size}", color = cs.onSurfaceVariant, fontFamily = Mono, fontSize = 11.sp)
                }
            }
            Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
                session.viewOnlyMessage?.let { message ->
                    IconButton({ toaster.show(message) }) {
                        Box(Modifier.size(30.dp).background(nxc.warning.copy(alpha = 0.18f), CircleShape), Alignment.Center) { Icon(Icons.Outlined.Visibility, "View only", Modifier.size(16.dp), nxc.warning) }
                    }
                }
                IconButton(onActions) { Icon(Icons.Outlined.MoreVert, "Session actions") }
            }
        }
        HorizontalDivider(color = nxc.border)
    } }
}

@Composable
fun SessionDock(onOpen: () -> Unit) {
    val sessions by nx.sessions.sessions.watch()
    val active by nx.sessions.activeSession.watch()
    val session = active ?: sessions.firstOrNull() ?: return
    HairlineCard(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp), onClick = onOpen, outlined = false) {
        Row(Modifier.heightIn(min = 52.dp).padding(start = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            LeadingTile(iconFor(session.type.iconKey), size = 32.dp)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(session.server.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(session.type.label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
            if (sessions.size > 1) Text(
                "+${sessions.size - 1}", Modifier.padding(end = 10.dp).background(nxc.fill, CircleShape).padding(horizontal = 8.dp, vertical = 2.dp),
                MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = Mono, fontSize = 12.sp,
            )
            IconButton({ nx.scope.launch { nx.sessions.closeSession(session.sessionId) } }) { Icon(Icons.Outlined.Close, "Close session") }
        }
    }
}

@Composable
private fun SessionSwitcher(
    sessions: List<AppSession>, paused: List<HibernatedSession>, activeId: String,
    onSelect: (String) -> Unit, onResume: (String) -> Unit, onClose: (String) -> Unit, onExit: (() -> Unit)?,
) {
    SheetHeader(Icons.Outlined.Layers, "Sessions", "${sessions.size} open")
    HorizontalDivider(color = nxc.border)
    LazyColumn(Modifier.heightIn(max = 400.dp)) {
        items(sessions, key = { it.sessionId }) { s ->
            ListItem(
                headlineContent = { Text(s.server.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                supportingContent = { Text(s.typeLabel) },
                leadingContent = { LeadingTile(if (s.isViewOnly) Icons.Outlined.Visibility else iconFor(s.type.iconKey)) },
                trailingContent = { IconButton({ onClose(s.sessionId) }) { Icon(Icons.Outlined.Close, "Close session") } },
                colors = if (s.sessionId == activeId) ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer) else transparentListItem,
                modifier = Modifier.clickable { onSelect(s.sessionId) },
            )
        }
    }
    if (paused.isNotEmpty()) {
        SectionHeader("Hibernated")
        paused.forEach { p ->
            ListItem(
                headlineContent = { Text(p.server.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                supportingContent = { Text(p.subtitle) },
                leadingContent = { LeadingTile(Icons.Outlined.Bedtime, MaterialTheme.colorScheme.onSurfaceVariant) },
                trailingContent = { TextButton({ onResume(p.sessionId) }) { Text("Resume") } },
                colors = transparentListItem,
            )
        }
    }
    if (onExit != null) {
        HorizontalDivider(color = nxc.border)
        SheetItem(Icons.AutoMirrored.Outlined.ExitToApp, "All servers", onClick = onExit)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickActionsSheet(session: AppSession, fullscreen: Boolean, aiAvailable: Boolean, onDismiss: () -> Unit) {
    var page by remember { mutableStateOf(ActionPage.MENU) }
    val toaster = LocalToaster.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val cs = MaterialTheme.colorScheme
    val terminal = session.terminal
    val viewport = session.guacamole?.viewport?.watch()?.value
    val ai = aiAvailable && session.supportsAI
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        when (page) {
            ActionPage.SNIPPETS -> Snippets({ page = ActionPage.MENU }) { onDismiss(); terminal?.send(it) }
            ActionPage.GENERATE -> GenerateCommand(session, { page = ActionPage.MENU }) { onDismiss(); terminal?.send(it) }
            ActionPage.MENU -> Column(Modifier.verticalScroll(rememberScrollState())) {
                SheetHeader(iconFor(session.type.iconKey), session.server.name, session.type.label)
                HorizontalDivider(color = nxc.border)
                val more = @Composable { Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = cs.onSurfaceVariant) }
                if (session.supportsSnippets) SheetItem(Icons.Outlined.DataObject, "Snippets", trailing = more) { page = ActionPage.SNIPPETS }
                if (ai) SheetItem(Icons.Outlined.Terminal, "Generate Command", trailing = more) { page = ActionPage.GENERATE }
                if (!session.isViewOnly && (terminal != null || viewport != null)) SheetItem(Icons.Outlined.ContentPaste, "Paste") {
                    onDismiss()
                    scope.launch { clipboard.text()?.let { text -> terminal?.controller?.paste(text) ?: viewport?.state?.keyboard?.sendText(text) } }
                }
                if (terminal != null) {
                    val size by nx.terminalSettings.fontSize.watch()
                    ListItem(
                        headlineContent = { Text("Text Size") }, leadingContent = { Icon(Icons.Outlined.FormatSize, null, tint = cs.onSurfaceVariant) }, colors = transparentListItem,
                        trailingContent = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton({ nx.terminalSettings.setFontSize(size - 1) }, enabled = size > TerminalSettings.MIN_FONT_SIZE) { Icon(Icons.Outlined.Remove, "Smaller") }
                                Text("${size.toInt()}", Modifier.widthIn(min = 28.dp), cs.onSurface, fontFamily = Mono, fontSize = 15.sp, textAlign = TextAlign.Center)
                                IconButton({ nx.terminalSettings.setFontSize(size + 1) }, enabled = size < TerminalSettings.MAX_FONT_SIZE) { Icon(Icons.Outlined.Add, "Larger") }
                            }
                        },
                    )
                }
                if (viewport != null) SheetItem(Icons.Outlined.FitScreen, "Fit to Screen") { onDismiss(); viewport.fit() }
                SheetItem(if (fullscreen) Icons.Outlined.FullscreenExit else Icons.Outlined.Fullscreen, if (fullscreen) "Exit Full Screen" else "Full Screen") {
                    onDismiss(); nx.sessions.setFullscreen(!fullscreen)
                }
                HorizontalDivider(color = nxc.border)
                session.actions.sortedBy { it.isDestructive }.forEach { action ->
                    SheetItem(iconFor(action.iconKey), action.label, if (action.isDestructive) cs.error else cs.onSurfaceVariant) {
                        onDismiss()
                        nx.scope.launch {
                            try { nx.sessions.perform(session, action)?.let(toaster::show) } catch (e: Exception) { toaster.show(e.message ?: "Something went wrong") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PageHeader(title: String, subtitle: String?, onBack: () -> Unit) {
    ListItem(
        headlineContent = { Text(title, style = MaterialTheme.typography.titleMedium) }, supportingContent = subtitle?.let { { Text(it) } },
        leadingContent = { IconButton(onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } }, colors = transparentListItem,
    )
    HorizontalDivider(color = nxc.border)
}

@Composable
private fun Snippets(onBack: () -> Unit, onRun: (String) -> Unit) {
    val snippets by nx.snippets.snippets.watch()
    val loading by nx.snippets.isLoading.watch()
    val error by nx.snippets.error.watch()
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    BackHandler(onBack = onBack)
    PageHeader("Snippets", null, onBack)
    when {
        loading -> Box(Modifier.fillMaxWidth().height(240.dp), Alignment.Center) { CircularProgressIndicator() }
        error != null -> StateMessage(Icons.Outlined.ErrorOutline, "Failed to load snippets", null, isError = true) { scope.launch { nx.snippets.reloadSnippets() } }
        snippets.isEmpty() -> StateMessage(Icons.Outlined.DataObject, "No snippets available", "Create snippets in the web dashboard")
        else -> {
            SearchField(query, { query = it }, "Search snippets")
            val shown = snippets.filter { it.matches(query) }
            LazyColumn(Modifier.fillMaxHeight(0.7f).imePadding()) {
                if (shown.isEmpty()) item { StateMessage(Icons.Outlined.SearchOff, "No results", null) }
                items(shown, key = { it.id }) { s ->
                    ListItem(
                        headlineContent = { Text(s.name) },
                        supportingContent = { Text(s.description ?: s.command, maxLines = 2, overflow = TextOverflow.Ellipsis, fontFamily = if (s.description == null) Mono else null) },
                        leadingContent = { LeadingTile(Icons.Outlined.Terminal) },
                        colors = transparentListItem, modifier = Modifier.clickable { onRun(s.command) },
                    )
                }
            }
        }
    }
}

@Composable
private fun GenerateCommand(session: AppSession, onBack: () -> Unit, onPick: (String) -> Unit) {
    val suggester = remember(session) { nx.ai.commandSuggester(session.sessionId) }
    val state by suggester.state.watch()
    var prompt by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val cs = MaterialTheme.colorScheme
    fun generate(fresh: Boolean) {
        scope.launch { suggester.generate(prompt, fresh) }
    }
    BackHandler(onBack = onBack)
    PageHeader("Generate Command", session.server.name, onBack)
    Column(Modifier.verticalScroll(rememberScrollState()).imePadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            prompt, { prompt = it }, Modifier.fillMaxWidth(), enabled = !state.isBusy, maxLines = 3, shape = RoundedCornerShape(16.dp),
            placeholder = { Text("Describe what you want to do") },
            trailingIcon = { IconButton({ generate(true) }, enabled = prompt.isNotBlank() && !state.isBusy) { Icon(Icons.AutoMirrored.Outlined.Send, "Generate") } },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions { generate(true) },
        )
        if (state.isBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = cs.error, style = MaterialTheme.typography.bodySmall) }
        state.commands.forEach { command ->
            HairlineCard(Modifier.fillMaxWidth(), onClick = { onPick(command) }) {
                Row(Modifier.heightIn(min = 48.dp).padding(horizontal = 14.dp, vertical = 10.dp), Arrangement.spacedBy(10.dp), Alignment.CenterVertically) {
                    Text("$", color = cs.primary, style = MonoStyle)
                    Text(command, Modifier.weight(1f), style = MonoStyle)
                    Icon(Icons.Outlined.KeyboardTab, "Type into terminal", Modifier.size(18.dp), cs.onSurfaceVariant)
                }
            }
        }
        if (state.commands.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Tap a command to type it. Nothing runs until you press Enter.", Modifier.weight(1f), cs.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            TextButton({ generate(false) }, enabled = !state.isBusy) { Text("Try others") }
        }
    }
}
