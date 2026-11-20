package dev.gnm.nexterm.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionState
import dev.gnm.nexterm.session.ToolbarKey
import dev.gnm.nexterm.terminal.TerminalController
import dev.gnm.nexterm.terminal.TerminalKey
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TerminalSessionView(session: AppSession, header: @Composable () -> Unit = {}) {
    val terminal = session.terminal ?: return
    val received by terminal.receivedData.watch()
    val error by terminal.error.watch()
    val state by terminal.state.watch()
    var input by remember { mutableStateOf<TerminalInputView?>(null) }
    val keyboardShown = WindowInsets.isImeVisible
    val background = Color(terminal.controller.theme.background)

    Column(Modifier.fillMaxSize().background(if (session.isViewOnly) background else MaterialTheme.colorScheme.surface).navigationBarsPadding().keyboardPadding()) {
        header()
        if (state != ConnectionState.DISCONNECTED) error?.let { ErrorBanner(it, terminal::clearError) }
        Box(Modifier.weight(1f).fillMaxWidth().background(background)) {
            if (!session.isViewOnly) TerminalInput(terminal.controller) { input = it }
            TerminalSurface(terminal.controller, onTap = { input?.showKeyboard() }, Modifier.fillMaxSize())
            ConnectionLoader(!received && error == null && state != ConnectionState.DISCONNECTED)
            if (state == ConnectionState.DISCONNECTED) ConnectionFailed(session.sessionId, error, terminal::clearError)
        }
        if (!session.isViewOnly && state != ConnectionState.DISCONNECTED) TerminalKeyBar(terminal.controller, keyboardShown) { if (keyboardShown) input?.hideKeyboard() else input?.showKeyboard() }
    }
}

@Composable
private fun TerminalInput(controller: TerminalController, onReady: (TerminalInputView) -> Unit) {
    AndroidView(
        factory = { ctx ->
            TerminalInputView(ctx, onText = controller::input) { e ->
                val chord = e.isCtrlPressed || e.isAltPressed
                val key = hardwareKeys[Key(e.keyCode)] ?: if (chord) e.getUnicodeChar(0).toChar().let(TerminalKey::forChar) else null
                key?.also { controller.sendKey(it, e.isCtrlPressed, e.isAltPressed, e.isShiftPressed) } != null
            }.also(onReady)
        },
        modifier = Modifier.size(1.dp),
    )
}

private val hardwareKeys = mapOf(
    Key.Tab to TerminalKey.TAB, Key.Escape to TerminalKey.ESCAPE, Key.DirectionUp to TerminalKey.ARROW_UP, Key.DirectionDown to TerminalKey.ARROW_DOWN,
    Key.DirectionLeft to TerminalKey.ARROW_LEFT, Key.DirectionRight to TerminalKey.ARROW_RIGHT, Key.MoveHome to TerminalKey.HOME, Key.MoveEnd to TerminalKey.END,
    Key.PageUp to TerminalKey.PAGE_UP, Key.PageDown to TerminalKey.PAGE_DOWN, Key.Insert to TerminalKey.INSERT, Key.Delete to TerminalKey.DELETE,
) + (1..12).associate { Key(android.view.KeyEvent.KEYCODE_F1 + it - 1) to TerminalKey.function(it) }

private val repeatingKeys = setOf(ToolbarKey.UP, ToolbarKey.DOWN, ToolbarKey.LEFT, ToolbarKey.RIGHT)

@Composable
private fun TerminalKeyBar(controller: TerminalController, keyboardShown: Boolean, onToggleKeyboard: () -> Unit) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val ts = nx.terminalSettings
    ts.groupOrder.watch().value
    ts.groupEnabled.watch().value
    val ctrl by controller.ctrlActive.watch()
    val alt by controller.altActive.watch()
    KeyBar(keyboardShown, onToggleKeyboard, trailing = {
        KeyCap(icon = Icons.Outlined.ContentPaste, description = "Paste") { scope.launch { clipboard.text()?.let(controller::paste) } }
    }) {
        ts.toolbarKeys().forEach { key ->
            KeyCap(key.label, active = if (key.isToggle) (key == ToolbarKey.CTRL && ctrl) || (key == ToolbarKey.ALT && alt) else null, repeat = key in repeatingKeys) { controller.press(key) }
        }
    }
}
