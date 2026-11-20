package dev.gnm.nexterm.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FitScreen
import androidx.compose.material.icons.outlined.Mouse
import androidx.compose.material.icons.outlined.TouchApp
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionState
import dev.gnm.nexterm.guacamole.GuacKeysym
import dev.gnm.nexterm.guacamole.GuacMouseMode
import dev.gnm.nexterm.guacamole.GuacamoleCanvas
import dev.gnm.nexterm.guacamole.GuacamoleViewport

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GuacamoleSessionView(session: AppSession, modifier: Modifier = Modifier) {
    val viewport = session.guacamole?.viewport?.watch()?.value ?: return
    val hasFrame by viewport.state.hasFrame.watch()
    val error by viewport.state.client.error.watch()
    val connection by session.connectionState.watch()
    val keyboard = viewport.state.keyboard
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val ime = LocalSoftwareKeyboardController.current
    val keyboardShown = WindowInsets.isImeVisible

    Column(modifier.fillMaxSize().background(if (session.isViewOnly) nxc.terminal else MaterialTheme.colorScheme.surface).navigationBarsPadding().keyboardPadding()) {
        if (connection != ConnectionState.DISCONNECTED) error?.let { ErrorBanner(it, viewport.state.client::clearError) }
        Box(Modifier.weight(1f).fillMaxWidth().background(nxc.terminal)) {
            GuacamoleCanvas(viewport, Modifier.fillMaxSize())
            if (!session.isViewOnly) BasicTextField(
                text, { text = it; keyboard.onTextFieldChanged(it) }, Modifier.size(1.dp).alpha(0f).focusRequester(focus),
                keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions { keyboard.sendKeyPress(GuacKeysym.ENTER); text = ""; keyboard.resetTextField() },
            )
            ConnectionLoader(!hasFrame && error == null && connection != ConnectionState.DISCONNECTED)
            if (connection == ConnectionState.DISCONNECTED) ConnectionFailed(session.sessionId, error, viewport.state.client::clearError)
        }
        if (!session.isViewOnly && connection != ConnectionState.DISCONNECTED) GuacKeyBar(viewport, keyboardShown) {
            if (keyboardShown) { ime?.hide(); focusManager.clearFocus() } else { focus.requestFocus(); ime?.show() }
        }
    }
}

@Composable
private fun GuacKeyBar(viewport: GuacamoleViewport, keyboardShown: Boolean, onToggleKeyboard: () -> Unit) {
    val kb = viewport.state.keyboard
    val ctrl by kb.ctrl.watch()
    val alt by kb.alt.watch()
    val shift by kb.shift.watch()
    val direct = viewport.mouseMode == GuacMouseMode.DIRECT
    KeyBar(keyboardShown, onToggleKeyboard, trailing = { KeyCap(icon = Icons.Outlined.FitScreen, description = "Fit to screen", onPress = viewport::fit) }) {
        KeyCap(icon = if (direct) Icons.Outlined.TouchApp else Icons.Outlined.Mouse, description = if (direct) "Touch mode" else "Mouse mode") {
            viewport.mouseMode = if (direct) GuacMouseMode.VIRTUAL_MOUSE else GuacMouseMode.DIRECT
        }
        KeyCap("Ctrl", active = ctrl) { kb.toggleCtrl() }
        KeyCap("Alt", active = alt) { kb.toggleAlt() }
        KeyCap("Shift", active = shift) { kb.toggleShift() }
        GuacKeysym.toolbar.forEach { key -> KeyCap(key.label, repeat = key.keysym in repeatingKeysyms) { kb.sendKeyPress(key.keysym) } }
        KeyCap("Ctrl+Alt+Del") { kb.sendCtrlAltDel() }
    }
}

private val repeatingKeysyms = setOf(GuacKeysym.UP, GuacKeysym.DOWN, GuacKeysym.LEFT, GuacKeysym.RIGHT, GuacKeysym.BACKSPACE, GuacKeysym.DELETE)
