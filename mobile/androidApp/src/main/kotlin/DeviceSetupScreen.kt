package dev.gnm.nexterm.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Lan
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.toClipEntry
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.gnm.nexterm.api.DeviceSetupStep
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceSetupScreen(isAddingServer: Boolean, onDone: () -> Unit, onBack: () -> Unit = {}) {
    val flow = rememberClosing(create = nx::newDeviceSetupFlow, close = { it.close() })
    val state by flow.state.watch()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val toaster = LocalToaster.current
    val clipboard = LocalClipboard.current
    var url by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.step) {
        if (state.step == DeviceSetupStep.DONE) { toaster.show("Successfully authenticated!"); onDone() }
    }
    fun openBrowser() { flow.openInBrowser()?.let { if (!context.openUrl(it)) toaster.show("Could not open browser") } }

    Scaffold(
        topBar = { if (isAddingServer) TopAppBar({ Text("Add Server") }, navigationIcon = {
            IconButton(onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } }) },
        snackbarHost = { AppSnackbar() },
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().wrapContentWidth().widthIn(max = 560.dp).imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        ) {
            Logo(88.dp, Modifier.align(Alignment.CenterHorizontally))
            Text("Nexterm", Modifier.fillMaxWidth().padding(bottom = 24.dp), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            val tall = Modifier.fillMaxWidth().heightIn(min = 48.dp)
            when (state.step) {
                DeviceSetupStep.SERVER_URL, DeviceSetupStep.DONE -> {
                    Hint("Scan the QR code from your Nexterm web interface, or enter the server URL.")
                    val connect = { scope.launch { flow.connect(url) }; Unit }
                    Button({
                        scope.launch { scanQrCode(context)?.let { if (!flow.handleScannedQr(it)) toaster.show("Invalid QR code") } }
                    }, tall, enabled = !state.isLoading) { ButtonLabel(Icons.Outlined.QrCodeScanner, "Scan QR code") }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        HorizontalDivider(Modifier.weight(1f), color = nxc.borderStrong)
                        Text("or", Modifier.padding(horizontal = 12.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider(Modifier.weight(1f), color = nxc.borderStrong)
                    }
                    OutlinedTextField(
                        url, { url = it; flow.clearError() }, Modifier.fillMaxWidth(), enabled = !state.isLoading, textStyle = LocalTextStyle.current.copy(fontFamily = Mono),
                        label = { Text("Server URL") }, placeholder = { Text("nexterm.example.com", fontFamily = Mono) },
                        leadingIcon = { Icon(Icons.Outlined.Lan, null) }, isError = state.error != null,
                        supportingText = state.error?.let { { Text(it) } }, singleLine = true,
                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions { connect() },
                    )
                    FilledTonalButton(connect, tall, enabled = !state.isLoading) {
                        if (state.isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Connect")
                    }
                    TextButton({ scope.launch { flow.startDemo() } }, Modifier.align(Alignment.CenterHorizontally).padding(top = 16.dp), enabled = !state.isLoading) {
                        Text("Try the demo", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                DeviceSetupStep.AUTH_CHOICE -> {
                    Hint("Choose how to authenticate with the server.")
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    AuthOption(Icons.Outlined.Pin, "Enter Code", "Display a code to enter on the web interface", flow::showCode)
                    AuthOption(Icons.AutoMirrored.Outlined.OpenInNew, "Open in Browser", "Open your browser to authorize", ::openBrowser)
                    OutlinedButton(flow::back, tall) { Text("Back") }
                }
                DeviceSetupStep.CODE -> {
                    Hint("Enter this code on your Nexterm web interface.")
                    HairlineCard { Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 20.dp), Arrangement.Center, Alignment.CenterVertically) {
                        Text(state.deviceCode ?: "----", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace, letterSpacing = 4.sp, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(16.dp))
                        IconButton({
                            val code = state.deviceCode ?: return@IconButton
                            scope.launch { clipboard.setClipEntry(android.content.ClipData.newPlainText("code", code).toClipEntry()) }
                            toaster.show("Code copied to clipboard")
                        }) { Icon(Icons.Outlined.ContentCopy, "Copy code") }
                    } }
                    Waiting("Waiting for authorization...")
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedButton(flow::back, Modifier.weight(1f)) { Text("Back") }
                        Button(::openBrowser, Modifier.weight(1f)) {
                            Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, Modifier.size(ButtonDefaults.IconSize)); Text("Open Browser", Modifier.padding(start = 8.dp))
                        }
                    }
                }
                DeviceSetupStep.QR_WAITING -> {
                    Waiting("Connecting to server...")
                    OutlinedButton(flow::back, tall) { Text("Cancel") }
                }
            }
        }
    }
}

@Composable
private fun AuthOption(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, onClick: () -> Unit) = HairlineCard(onClick = onClick) {
    ListItem(headlineContent = { Text(title) }, supportingContent = { Text(subtitle) }, leadingContent = { LeadingTile(icon) }, colors = transparentListItem)
}

@Composable
private fun Hint(text: String) = Text(text, Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)

@Composable
private fun Waiting(label: String) = Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
    LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 16.dp))
}
