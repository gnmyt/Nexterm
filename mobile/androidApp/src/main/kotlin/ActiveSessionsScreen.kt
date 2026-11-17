package dev.gnm.nexterm.app

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionType
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private enum class SessionSheet { SWITCHER, SNIPPETS, AI, TOOLS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveSessionsScreen(onExit: () -> Unit) {
    val sessions by nx.sessions.sessions.watch()
    val active by nx.sessions.activeSession.watch()
    val aiAvailable by nx.ai.isAvailable.watch()
    val fullscreen by nx.sessions.fullscreen.watch()
    val view = LocalView.current
    DisposableEffect(fullscreen) {
        val bars = WindowInsetsControllerCompat((view.context as Activity).window, view)
        bars.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (fullscreen) bars.hide(WindowInsetsCompat.Type.systemBars()) else bars.show(WindowInsetsCompat.Type.systemBars())
        onDispose { bars.show(WindowInsetsCompat.Type.systemBars()) }
    }
    BackHandler(fullscreen) { nx.sessions.setFullscreen(false) }
    var sheet by remember { mutableStateOf<SessionSheet?>(null) }
    val scope = rememberCoroutineScope()
    val session = active ?: sessions.firstOrNull() ?: return Box(Modifier.fillMaxSize(), Alignment.Center) {
        StateMessage(Icons.Outlined.DesktopAccessDisabled, "No active sessions", null)
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        key(session.sessionId) {
            when (session.type) {
                ConnectionType.TERMINAL -> TerminalSessionView(session)
                ConnectionType.SFTP -> SftpSessionView(session)
                ConnectionType.GUACAMOLE -> GuacamoleSessionView(session, sheet == SessionSheet.TOOLS) { sheet = null }
            }
        }
        var offset by remember { mutableStateOf(Offset.Zero) }
        var pill by remember { mutableStateOf(IntSize.Zero) }
        val maxX = ((constraints.maxWidth - pill.width) / 2f).coerceAtLeast(0f)
        val maxY = (constraints.maxHeight - pill.height * 3f).coerceAtLeast(0f)
        val clamp = { o: Offset -> Offset(o.x.coerceIn(-maxX, maxX), o.y.coerceIn(0f, maxY)) }
        Row(
            Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 4.dp).onSizeChanged { pill = it }
                .offset { clamp(offset).let { IntOffset(it.x.roundToInt(), it.y.roundToInt()) } }
                .pointerInput(maxX, maxY) { detectDragGestures { _, d -> offset = clamp(clamp(offset) + d) } }
                .shadow(6.dp, RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh, RoundedCornerShape(22.dp))
                .height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val cs = MaterialTheme.colorScheme
            Row(Modifier.clickable { sheet = SessionSheet.SWITCHER }.padding(start = 12.dp, end = 6.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (session.isViewOnly) Icons.Outlined.Visibility else iconFor(session.type.iconKey), null, Modifier.size(14.dp), cs.primary)
                Text(session.server.name, Modifier.padding(start = 5.dp).widthIn(max = 80.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (sessions.size > 1) Badge(Modifier.padding(start = 4.dp), cs.primary) { Text("${sessions.size}") }
                Icon(Icons.Outlined.KeyboardArrowUp, null, Modifier.padding(start = 2.dp).size(14.dp), cs.outline)
            }
            if (session.supportsSnippets) PillButton(Icons.Outlined.DataObject) { sheet = SessionSheet.SNIPPETS }
            if (session.hasToolMenu) PillButton(Icons.Outlined.HomeRepairService) { sheet = SessionSheet.TOOLS }
            if (session.supportsAI && aiAvailable) PillButton(Icons.Outlined.AutoAwesome) { sheet = SessionSheet.AI }
            PillButton(if (fullscreen) Icons.Outlined.FullscreenExit else Icons.Outlined.Fullscreen) { nx.sessions.setFullscreen(!fullscreen) }
        }
    }

    when (sheet) {
        SessionSheet.SWITCHER -> ModalBottomSheet({ sheet = null }) {
            SessionSwitcher(sessions, session.sessionId,
                onSelect = { nx.sessions.setActive(it); sheet = null },
                onClose = { id -> scope.launch { nx.sessions.closeSession(id); if (nx.sessions.sessions.value.isEmpty()) sheet = null } },
                onExit = { sheet = null; nx.sessions.setFullscreen(false); onExit() })
        }
        SessionSheet.SNIPPETS -> SnippetsSheet({ sheet = null }) { session.terminal?.send(it) }
        SessionSheet.AI -> AiAssistantSheet(session) { sheet = null }
        SessionSheet.TOOLS, null -> Unit
    }
}

@Composable
private fun PillButton(icon: ImageVector, onClick: () -> Unit) {
    VerticalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    Icon(icon, null, Modifier.clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 7.dp).size(16.dp), MaterialTheme.colorScheme.primary)
}

@Composable
private fun SessionSwitcher(sessions: List<AppSession>, activeId: String, onSelect: (String) -> Unit, onClose: (String) -> Unit, onExit: () -> Unit) {
    SheetHeader(Icons.Outlined.Layers, "Sessions", null) { Text("${sessions.size}") }
    HorizontalDivider()
    LazyColumn(Modifier.heightIn(max = 400.dp)) {
        items(sessions, key = { it.sessionId }) { s ->
            val isActive = s.sessionId == activeId
            ListItem(
                headlineContent = { Text(s.server.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                supportingContent = { Text(if (s.isViewOnly) "${s.type.label} · View only" else s.type.label) },
                leadingContent = { Icon(iconFor(s.type.iconKey), null) },
                trailingContent = { IconButton({ onClose(s.sessionId) }) { Icon(Icons.Outlined.Close, "Close session") } },
                colors = if (isActive) ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer) else transparentListItem,
                modifier = Modifier.clickable { onSelect(s.sessionId) },
            )
        }
    }
    HorizontalDivider()
    SheetItem(Icons.AutoMirrored.Outlined.ExitToApp, "Back to servers", onClick = onExit)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SnippetsSheet(onDismiss: () -> Unit, onRun: (String) -> Unit) {
    val snippets by nx.snippets.snippets.watch()
    val loading by nx.snippets.isLoading.watch()
    val error by nx.snippets.error.watch()
    val scope = rememberCoroutineScope()
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        SheetHeader(Icons.Outlined.DataObject, "Snippets", null) { IconButton(onDismiss) { Icon(Icons.Outlined.Close, "Close") } }
        HorizontalDivider()
        when {
            loading -> Box(Modifier.fillMaxWidth().height(240.dp), Alignment.Center) { CircularProgressIndicator() }
            error != null -> StateMessage(Icons.Outlined.ErrorOutline, "Failed to load snippets", null, isError = true) { scope.launch { nx.snippets.reloadSnippets() } }
            snippets.isEmpty() -> StateMessage(Icons.Outlined.DataObject, "No snippets available", null)
            else -> LazyColumn(Modifier.fillMaxHeight(0.7f)) {
                items(snippets, key = { it.id }) { s ->
                    ListItem(
                        headlineContent = { Text(s.name) },
                        supportingContent = s.description?.let { { Text(it, maxLines = 2, overflow = TextOverflow.Ellipsis) } },
                        leadingContent = { Icon(Icons.Outlined.Terminal, null) },
                        colors = transparentListItem, modifier = Modifier.clickable { onDismiss(); onRun(s.command) },
                    )
                }
            }
        }
    }
}
