package dev.gnm.nexterm.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.session.AppSession

@Composable
fun BrowserSessionView(session: AppSession, toolsOpen: Boolean, onCloseTools: () -> Unit) {
    val browser = session.browser ?: return
    val state by browser.state.watch()
    var address by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    LaunchedEffect(state.address, editing) { if (!editing) address = state.address }
    Column(Modifier.fillMaxSize()) {
        Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
            Column(Modifier.statusBarsPadding().padding(top = 44.dp)) {
                Row(Modifier.padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(browser::goBack, enabled = browser.canControl && state.canGoBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                    IconButton(browser::goForward, enabled = browser.canControl && state.canGoForward) { Icon(Icons.AutoMirrored.Outlined.ArrowForward, "Forward") }
                    IconButton(browser::reloadOrStop, enabled = browser.canControl) {
                        Icon(if (state.isLoading) Icons.Outlined.Close else Icons.Outlined.Refresh, if (state.isLoading) "Stop" else "Reload")
                    }
                    OutlinedTextField(
                        address, { address = it }, Modifier.weight(1f).onFocusChanged { editing = it.isFocused },
                        readOnly = !browser.canControl, singleLine = true, shape = MaterialTheme.shapes.extraLarge,
                        placeholder = { Text("Search or enter address") },
                        leadingIcon = { Icon(Icons.Outlined.Language, null) },
                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { browser.navigate(address); focus.clearFocus() }),
                    )
                }
                if (state.isLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        GuacamoleSessionView(session, toolsOpen, onCloseTools, Modifier.weight(1f).consumeWindowInsets(WindowInsets.statusBars))
    }
}
