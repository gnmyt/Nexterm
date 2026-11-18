package dev.gnm.nexterm.app

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material3.Icon
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionState
import dev.gnm.nexterm.session.ToolbarKey
import dev.gnm.nexterm.terminal.TerminalController
import dev.gnm.nexterm.terminal.TerminalKey

@Composable
fun TerminalSessionView(session: AppSession, header: @Composable () -> Unit = {}) {
    val terminal = session.terminal ?: return
    val received by terminal.receivedData.watch()
    val error by terminal.error.watch()
    val state by terminal.state.watch()
    var input by remember { mutableStateOf<TerminalInputView?>(null) }
    var focused by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Color.Black).systemBarsPadding().imePadding()) {
        header()
        error?.let { ErrorBanner(it, terminal::clearError) }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (!session.isViewOnly) TerminalInput(terminal.controller, onFocus = { focused = it }, onReady = { input = it })
            TerminalSurface(terminal.controller, onTap = { input?.showKeyboard() }, Modifier.fillMaxSize())
            ConnectionLoader(!received && error == null && state != ConnectionState.DISCONNECTED)
            if (state == ConnectionState.DISCONNECTED) DisconnectedOverlay { nx.sessions.reconnect(session.sessionId) }
        }
        session.viewOnlyMessage?.let { ViewOnlyBanner(it) }
        if (focused && !session.isViewOnly) KeyToolbar(terminal.controller)
    }
}

@Composable
private fun TerminalInput(controller: TerminalController, onFocus: (Boolean) -> Unit, onReady: (TerminalInputView) -> Unit) {
    AndroidView(
        factory = { ctx ->
            TerminalInputView(ctx, onText = controller::input) { e ->
                val chord = e.isCtrlPressed || e.isAltPressed
                val key = hardwareKeys[Key(e.keyCode)] ?: if (chord) e.getUnicodeChar(0).toChar().let(TerminalKey::forChar) else null
                key?.also { controller.sendKey(it, e.isCtrlPressed, e.isAltPressed, e.isShiftPressed) } != null
            }.apply { setOnFocusChangeListener { _, has -> onFocus(has) }; onReady(this) }
        },
        modifier = Modifier.size(1.dp),
    )
}

private val hardwareKeys = mapOf(
    Key.Tab to TerminalKey.TAB, Key.Escape to TerminalKey.ESCAPE, Key.DirectionUp to TerminalKey.ARROW_UP, Key.DirectionDown to TerminalKey.ARROW_DOWN,
    Key.DirectionLeft to TerminalKey.ARROW_LEFT, Key.DirectionRight to TerminalKey.ARROW_RIGHT, Key.MoveHome to TerminalKey.HOME, Key.MoveEnd to TerminalKey.END,
    Key.PageUp to TerminalKey.PAGE_UP, Key.PageDown to TerminalKey.PAGE_DOWN, Key.Insert to TerminalKey.INSERT, Key.Delete to TerminalKey.DELETE,
) + (1..12).associate { Key(android.view.KeyEvent.KEYCODE_F1 + it - 1) to TerminalKey.function(it) }

@Composable
private fun KeyToolbar(controller: TerminalController) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val ts = nx.terminalSettings
    ts.groupOrder.watch().value
    ts.groupEnabled.watch().value
    val ctrl by controller.ctrlActive.watch()
    val alt by controller.altActive.watch()
    Surface(color = MaterialTheme.colorScheme.surfaceContainer, shadowElevation = 8.dp) {
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 4.dp), Arrangement.spacedBy(8.dp), Alignment.CenterVertically) {
            ts.toolbarKeys().forEach { key ->
                val active = (key == ToolbarKey.CTRL && ctrl) || (key == ToolbarKey.ALT && alt)
                val padding = PaddingValues(horizontal = if (key.isCompact) 12.dp else 16.dp)
                if (active) Button({ controller.press(key) }, contentPadding = padding) { Text(key.label) }
                else FilledTonalButton({ controller.press(key) }, contentPadding = padding) { Text(key.label) }
            }
            FilledTonalIconButton({ scope.launch { clipboard.getClipEntry()?.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.text?.let { controller.paste(it.toString()) } } }) {
                Icon(Icons.Outlined.ContentPaste, "Paste")
            }
        }
    }
}
