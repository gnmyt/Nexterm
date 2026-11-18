package dev.gnm.nexterm.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionState
import dev.gnm.nexterm.guacamole.GuacKeysym
import dev.gnm.nexterm.guacamole.GuacMouseMode
import dev.gnm.nexterm.guacamole.GuacamoleCanvas
import dev.gnm.nexterm.guacamole.GuacamoleViewport

@Composable
fun GuacamoleSessionView(session: AppSession, toolsOpen: Boolean, onCloseTools: () -> Unit, modifier: Modifier = Modifier) {
    val viewport = session.guacamole?.viewport?.watch()?.value ?: return
    val hasFrame by viewport.state.hasFrame.watch()
    val error by viewport.state.client.error.watch()
    val connection by session.connectionState.watch()
    val keyboard = viewport.state.keyboard
    var text by remember { mutableStateOf("") }
    var imeFocused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val ime = LocalSoftwareKeyboardController.current

    Box(modifier.fillMaxSize().background(Color.Black).systemBarsPadding().imePadding()) {
        GuacamoleCanvas(viewport, Modifier.fillMaxSize())
        if (!session.isViewOnly) BasicTextField(
            text, { text = it; keyboard.onTextFieldChanged(it) },
            Modifier.size(1.dp).alpha(0f).focusRequester(focus).onFocusChanged { imeFocused = it.isFocused },
            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions { keyboard.sendKeyPress(GuacKeysym.ENTER); text = ""; keyboard.resetTextField() },
        )
        ConnectionLoader(!hasFrame && error == null && connection != ConnectionState.DISCONNECTED)
        error?.let { Box(Modifier.align(Alignment.TopCenter)) { ErrorBanner("Error: $it", viewport.state.client::clearError) } }
        session.viewOnlyMessage?.let { ViewOnlyBanner(it, Modifier.align(Alignment.BottomCenter)) }
        if (connection == ConnectionState.DISCONNECTED) DisconnectedOverlay { nx.sessions.reconnect(session.sessionId) }
    }
    if (toolsOpen) GuacToolSheet(viewport, session.isViewOnly, onCloseTools) {
        if (imeFocused) focusManager.clearFocus() else { focus.requestFocus(); ime?.show() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GuacToolSheet(viewport: GuacamoleViewport, viewOnly: Boolean, onDismiss: () -> Unit, onToggleKeyboard: () -> Unit) {
    val kb = viewport.state.keyboard
    val ctrl by kb.ctrl.watch()
    val alt by kb.alt.watch()
    val shift by kb.shift.watch()
    val direct = viewport.mouseMode == GuacMouseMode.DIRECT
    if (viewOnly) return ModalBottomSheet(onDismiss) {
        Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            ToolAction(Icons.Outlined.FitScreen, "Fit to Screen") { onDismiss(); viewport.fit() }
        }
    }
    ModalBottomSheet(onDismiss) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ToolAction(if (direct) Icons.Outlined.TouchApp else Icons.Outlined.Mouse, if (direct) "Touch" else "Mouse") {
                    viewport.mouseMode = if (direct) GuacMouseMode.VIRTUAL_MOUSE else GuacMouseMode.DIRECT
                }
                ToolAction(Icons.Outlined.Keyboard, "Keys") { onDismiss(); onToggleKeyboard() }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ToolAction(Icons.Outlined.FitScreen, "Fit to Screen") { onDismiss(); viewport.fit() }
                ToolAction(Icons.Outlined.SettingsPower, "Ctrl+Alt+Del") { onDismiss(); kb.sendCtrlAltDel() }
            }
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(Triple("Ctrl", ctrl, kb::toggleCtrl), Triple("Alt", alt, kb::toggleAlt), Triple("Shift", shift, kb::toggleShift)).forEach { (label, on, toggle) ->
                    FilterChip(on, { toggle() }, { Text(label, Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }, Modifier.weight(1f))
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GuacKeysym.toolbar.forEach { SuggestionChip({ kb.sendKeyPress(it.keysym) }, { Text(it.label) }) }
            }
        }
    }
}

@Composable
private fun RowScope.ToolAction(icon: ImageVector, label: String, onClick: () -> Unit) = FilledTonalButton(onClick, Modifier.weight(1f)) {
    Icon(icon, null, Modifier.size(ButtonDefaults.IconSize)); Text(label, Modifier.padding(start = 8.dp))
}
