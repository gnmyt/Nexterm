package dev.gnm.nexterm.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.Tag
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.api.ConnectStep
import dev.gnm.nexterm.api.ConnectionRules
import dev.gnm.nexterm.api.ServerAction
import dev.gnm.nexterm.api.DirectIdentity
import dev.gnm.nexterm.api.ValidationException
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.state.ServerListController
import dev.gnm.nexterm.util.ColorRole
import dev.gnm.nexterm.util.IconKeys
import dev.gnm.nexterm.util.ServerListRow
import kotlinx.coroutines.launch

private sealed interface ServerSheet {
    data class Menu(val server: Server) : ServerSheet
    data class Quick(val server: Server, val type: ConnectionType) : ServerSheet
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServersScreen(ctrl: ServerListController, onSwitchToSessions: () -> Unit, onConnected: () -> Unit = onSwitchToSessions) {
    val rows by ctrl.rows.watch()
    val loading by ctrl.isLoading.watch()
    val error by ctrl.error.watch()
    val total by ctrl.totalServers.watch()
    val sessions by nx.sessions.sessions.watch()
    val scope = rememberCoroutineScope()
    val toaster = LocalToaster.current
    var sheet by remember { mutableStateOf<ServerSheet?>(null) }
    var askReason by remember { mutableStateOf<ConnectRequest?>(null) }
    var refreshing by remember { mutableStateOf(false) }

    fun create(r: ConnectRequest, reason: String?) = scope.launch {
        try {
            nx.sessions.createSession(r, reason)
            onConnected()
        } catch (e: Exception) {
            toaster.show("Failed to connect: ${e.message}")
        }
    }
    fun start(r: ConnectRequest) { if (r.needsReason) askReason = r else create(r, null) }
    fun act(s: Server, action: ServerAction? = null) {
        when (val step = ctrl.plan(s, action)) {
            is ConnectStep.Message -> toaster.show(step.text)
            is ConnectStep.Wake -> scope.launch { toaster.show(try { ctrl.wake(s) } catch (e: Exception) { e.message ?: "Failed to send magic packet" }) }
            is ConnectStep.QuickConnect -> sheet = ServerSheet.Quick(step.server, step.type)
            is ConnectStep.Connect -> start(step.request)
        }
    }
    val refresh: () -> Unit = {
        scope.launch {
            refreshing = true
            try { ctrl.refresh() } catch (e: Exception) { toaster.show("Failed to refresh: ${e.message}") }
            refreshing = false
        }
    }

    AppScreen(
        "Servers", subtitle = if (!loading && error == null && total > 0) ctrl.onlineSummary() else null,
        actions = {
            if (sessions.isNotEmpty()) IconButton(onSwitchToSessions) {
                BadgedBox({ Badge { Text("${sessions.size}") } }) { Icon(Icons.Outlined.DynamicFeed, "Sessions") }
            }
        },
        header = { SearchAndTags(ctrl) },
    ) { padding ->
        when {
            loading -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            error != null -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                StateMessage(Icons.Outlined.ErrorOutline, "Something went wrong", error, isError = true) { scope.launch { ctrl.load() } }
            }
            else -> PullToRefreshBox(refreshing, refresh, Modifier.padding(padding).fillMaxSize()) {
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp)) {
                    if (rows.isEmpty()) item { StateMessage(Icons.Outlined.CloudOff, ctrl.emptyTitle(), ctrl.emptySubtitle()) }
                    items(rows, key = { it.key }) { row ->
                        when (row) {
                            is ServerListRow.FolderRow -> FolderItem(row) { ctrl.toggleFolder(row.folder.id) }
                            is ServerListRow.ServerRow -> ServerItem(row, { act(row.server) }, { sheet = ServerSheet.Menu(row.server) }) { act(row.server, it) }
                        }
                    }
                }
            }
        }
    }
    when (val s = sheet) {
        is ServerSheet.Menu -> ModalBottomSheet({ sheet = null }) {
            SheetHeader(iconFor(IconKeys.server(s.server)), s.server.name, s.server.displayIp)
            HorizontalDivider()
            SheetItem(Icons.Outlined.Cable, if (ConnectionRules.supportsSftp(s.server)) "Open Terminal" else "Connect") { sheet = null; act(s.server) }
            ConnectionRules.secondaryActions(s.server).forEach { action ->
                SheetItem(action.icon, action.label) { sheet = null; act(s.server, action) }
            }
        }
        is ServerSheet.Quick -> QuickConnectSheet(s.server, { sheet = null }) { identity ->
            sheet = null
            start(ctrl.request(s.server, s.type, identity))
        }
        null -> Unit
    }
    askReason?.let { p -> ConnectionReasonDialog(p.server.name, { askReason = null }) { askReason = null; create(p, it) } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchAndTags(ctrl: ServerListController) {
    val search by ctrl.searchText.watch()
    val tags by ctrl.allTags.watch()
    val selected by ctrl.selectedTags.watch()
    SearchBar(
        inputField = {
            SearchBarDefaults.InputField(
                search, ctrl::setSearchText, {}, expanded = false, onExpandedChange = {}, placeholder = { Text("Search servers...") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                trailingIcon = { if (search.isNotEmpty()) IconButton(ctrl::clearSearch) { Icon(Icons.Outlined.Close, "Clear") } },
            )
        },
        expanded = false, onExpandedChange = {}, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), windowInsets = WindowInsets(0),
    ) {}
    if (tags.isNotEmpty()) LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (selected.isNotEmpty()) item {
            InputChip(true, ctrl::clearTags, { Text("Clear") }, trailingIcon = { Icon(Icons.Outlined.Close, "Clear tags", Modifier.size(InputChipDefaults.IconSize)) })
        }
        items(tags, key = { it.id }) { tag ->
            FilterChip(tag.id in selected, { ctrl.toggleTag(tag.id) }, { Text(tag.name) }, leadingIcon = { Badge(containerColor = tagColor(tag)) })
        }
    }
}

@Composable
private fun tagColor(tag: Tag) = tag.colorArgb?.let { Color(it) } ?: MaterialTheme.colorScheme.primary

@Composable
private fun FolderItem(row: ServerListRow.FolderRow, onToggle: () -> Unit) {
    val rotation by animateFloatAsState(if (row.isExpanded) 180f else 0f, label = "chevron")
    ListItem(
        headlineContent = { Text(row.folder.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = row.subtitle?.let { { Text(it) } },
        leadingContent = { Icon(iconFor(row.iconKey), null, tint = roleColor(row.colorRole)) },
        trailingContent = { if (row.folder.hasEntries) Icon(Icons.Outlined.ExpandMore, null, Modifier.rotate(rotation)) },
        modifier = Modifier.clickable(row.folder.hasEntries, onClick = onToggle).padding(start = (row.depth * 16).dp),
    )
}

private val ServerAction.icon get() = when (this) {
    ServerAction.SFTP -> Icons.Outlined.FolderOpen
    ServerAction.QUICK_CONNECT -> Icons.Outlined.AdsClick
    ServerAction.WAKE_ON_LAN -> Icons.Outlined.Power
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerItem(row: ServerListRow.ServerRow, onClick: () -> Unit, onLongClick: () -> Unit, onAction: (ServerAction) -> Unit) {
    val actions = remember(row.server) { ConnectionRules.secondaryActions(row.server) }
    val endAction = ServerAction.SFTP.takeIf { it in actions }
    val startAction = ServerAction.WAKE_ON_LAN.takeIf { it in actions }
    val state = rememberSwipeToDismissBoxState()
    LaunchedEffect(state.currentValue) {
        when (state.currentValue) {
            SwipeToDismissBoxValue.EndToStart -> endAction?.let(onAction)
            SwipeToDismissBoxValue.StartToEnd -> startAction?.let(onAction)
            SwipeToDismissBoxValue.Settled -> return@LaunchedEffect
        }
        state.reset()
    }
    SwipeToDismissBox(
        state, enableDismissFromStartToEnd = startAction != null, enableDismissFromEndToStart = endAction != null,
        backgroundContent = {
            val toStart = state.dismissDirection == SwipeToDismissBoxValue.EndToStart
            val action = (if (toStart) endAction else startAction).takeIf { state.dismissDirection != SwipeToDismissBoxValue.Settled }
            if (action != null) ListItem(
                headlineContent = { Text(action.label, Modifier.fillMaxWidth(), textAlign = if (toStart) TextAlign.End else TextAlign.Start) },
                leadingContent = if (toStart) null else { { Icon(action.icon, null) } },
                trailingContent = if (toStart) { { Icon(action.icon, null) } } else null,
                colors = with(MaterialTheme.colorScheme) {
                    val (bg, fg) = if (toStart) primaryContainer to onPrimaryContainer else tertiaryContainer to onTertiaryContainer
                    ListItemDefaults.colors(containerColor = bg, headlineColor = fg, leadingIconColor = fg, trailingIconColor = fg)
                },
                modifier = Modifier.fillMaxSize(),
            )
        },
    ) {
        ListItem(
            headlineContent = { Text(row.server.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supportingContent = row.server.subtitle?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
            leadingContent = { Icon(iconFor(row.iconKey), null, tint = roleColor(row.colorRole)) },
            trailingContent = { Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { row.tagDots.forEach { Badge(containerColor = tagColor(it)) } } },
            colors = ListItemDefaults.colors(headlineColor = if (row.colorRole == ColorRole.OUTLINE) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onSurface),
            modifier = Modifier.combinedClickable(onLongClick = onLongClick, onClick = onClick).padding(start = (row.depth * 16).dp),
        )
    }
}

@Composable
private fun ConnectionReasonDialog(serverName: String, onDismiss: () -> Unit, onConnect: (String) -> Unit) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Connection Reason Required") },
        text = {
            Column {
                Text(buildAnnotatedString {
                    append("Please provide a reason for connecting to ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(serverName) }
                    append(":")
                }, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    reason, { reason = it.take(ConnectionRules.CONNECTION_REASON_MAX_LENGTH) }, Modifier.fillMaxWidth().padding(top = 12.dp),
                    placeholder = { Text("Enter your reason for this connection...") }, minLines = 3, maxLines = 3,
                    supportingText = { Text("${reason.length}/${ConnectionRules.CONNECTION_REASON_MAX_LENGTH}") },
                )
            }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
        confirmButton = { Button({ onConnect(reason.trim()) }, enabled = reason.isNotBlank()) { Text("Connect") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickConnectSheet(server: Server, onDismiss: () -> Unit, onConnect: (DirectIdentity) -> Unit) {
    val options = remember(server) { ConnectionRules.allowedAuthTypes(server.protocol) }
    var auth by remember { mutableStateOf(options.first()) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passphrase by remember { mutableStateOf("") }
    var key by remember { mutableStateOf<Pair<String, String>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val pickKey = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        runCatching { context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() } }
            .onSuccess { key = context.queryFile(uri).first to it }
            .onFailure { error = "Failed to read key: ${it.message}" }
    }
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        SheetHeader(Icons.Outlined.AdsClick, "Quick Connect", server.name)
        Column(Modifier.verticalScroll(rememberScrollState()).imePadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (auth.showsUsername) Field(username, { username = it }, "Username", Icons.Outlined.AccountCircle)
            Text("Authentication", style = MaterialTheme.typography.labelLarge)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                options.forEachIndexed { i, opt ->
                    SegmentedButton(opt == auth, { auth = opt }, SegmentedButtonDefaults.itemShape(i, options.size)) { Text(opt.label, maxLines = 1) }
                }
            }
            if (auth.showsPassword) Field(password, { password = it }, "Password", Icons.Outlined.Lock, secret = true)
            if (auth.showsKey) {
                OutlinedButton({ pickKey.launch(arrayOf("*/*")) }, Modifier.fillMaxWidth()) {
                    Icon(if (key != null) Icons.Outlined.CheckCircle else Icons.Outlined.UploadFile, null, Modifier.size(ButtonDefaults.IconSize))
                    Text(key?.first ?: "Select key file", Modifier.padding(start = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Field(passphrase, { passphrase = it }, "Passphrase (optional)", Icons.Outlined.Lock, secret = true)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Button({
                try { onConnect(ConnectionRules.buildDirectIdentity(auth.id, username, password, key?.second, passphrase)) }
                catch (e: ValidationException) { error = e.message }
            }, Modifier.fillMaxWidth()) {
                Icon(Icons.Outlined.Cable, null, Modifier.size(ButtonDefaults.IconSize)); Text("Connect", Modifier.padding(start = 8.dp))
            }
        }
    }
}

@Composable
private fun Field(value: String, onChange: (String) -> Unit, label: String, icon: ImageVector, secret: Boolean = false) =
    OutlinedTextField(
        value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, leadingIcon = { Icon(icon, null) }, singleLine = true,
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = if (secret) androidx.compose.ui.text.input.KeyboardType.Password else androidx.compose.ui.text.input.KeyboardType.Text),
    )
