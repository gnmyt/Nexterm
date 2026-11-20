package dev.gnm.nexterm.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.lazy.itemsIndexed
import dev.gnm.nexterm.api.AuthorizePayload
import dev.gnm.nexterm.api.QrPayloads
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.api.ConnectRequest
import dev.gnm.nexterm.api.ConnectStep
import dev.gnm.nexterm.api.ConnectionRules
import dev.gnm.nexterm.api.ServerAction
import dev.gnm.nexterm.api.ServerIntent
import dev.gnm.nexterm.api.ServerMenuItem
import dev.gnm.nexterm.model.Script
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import dev.gnm.nexterm.api.DirectIdentity
import dev.gnm.nexterm.api.ValidationException
import dev.gnm.nexterm.session.ConnectionType
import dev.gnm.nexterm.state.ServerListController
import dev.gnm.nexterm.util.ServerListRow
import kotlinx.coroutines.launch

private sealed interface ServerSheet {
    data class Menu(val server: Server) : ServerSheet
    data class Options(val server: Server, val item: ServerMenuItem) : ServerSheet
    data class Quick(val server: Server, val type: ConnectionType) : ServerSheet
    data class Scripts(val server: Server, val identityId: Int?) : ServerSheet
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServersScreen(ctrl: ServerListController, openAddServer: () -> Unit, onAuthorize: (AuthorizePayload) -> Unit, onConnected: () -> Unit) {
    val rows by ctrl.rows.watch()
    val recent by ctrl.recent.watch()
    val favorites by ctrl.favorites.watch()
    val favoriteIds by ctrl.favoriteIds.watch()
    val loading by ctrl.isLoading.watch()
    val error by ctrl.error.watch()
    val total by ctrl.totalServers.watch()
    val paused by nx.sessions.hibernated.watch()
    val account by nx.accounts.activeAccount.watch()
    val accounts by nx.accounts.accounts.watch()
    ctrl.menuRevision.watch().value
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val toaster = LocalToaster.current
    val cs = MaterialTheme.colorScheme
    var sheet by remember { mutableStateOf<ServerSheet?>(null) }
    var askReason by remember { mutableStateOf<ConnectRequest?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var accountMenu by remember { mutableStateOf(false) }

    fun create(r: ConnectRequest, reason: String?) = scope.launch {
        busy = true
        try {
            nx.sessions.createSession(r, reason)
            onConnected()
        } catch (e: Exception) {
            toaster.show("Failed to connect: ${e.message}")
        }
        busy = false
    }
    fun start(r: ConnectRequest) { if (r.needsReason) askReason = r else create(r, null) }
    fun act(intent: ServerIntent) {
        when (val step = ctrl.plan(intent)) {
            is ConnectStep.Message -> toaster.show(step.text)
            is ConnectStep.QuickConnect -> sheet = ServerSheet.Quick(step.server, step.type)
            is ConnectStep.Connect -> start(step.request)
            is ConnectStep.PickScript -> sheet = ServerSheet.Scripts(step.server, step.identityId)
            is ConnectStep.Execute -> scope.launch {
                busy = true
                try {
                    val result = ctrl.execute(step.intent)
                    result.message?.let { toaster.show(it) }
                    if (result.openedSession) onConnected()
                } catch (e: Exception) {
                    toaster.show(e.message ?: "Something went wrong")
                }
                busy = false
            }
        }
    }
    val refresh: () -> Unit = {
        scope.launch {
            refreshing = true
            try { ctrl.refresh() } catch (e: Exception) { toaster.show("Failed to refresh: ${e.message}") }
            refreshing = false
        }
    }
    val pausedIds = paused.map { it.server.id }.toSet()
    val listState = rememberLazyListState()
    val pinned = rows.isNotEmpty() && (favorites.isNotEmpty() || recent.isNotEmpty())
    val lead = if (!pinned) 0 else 1 + (if (favorites.isEmpty()) 0 else favorites.size + 1) + (if (recent.isEmpty()) 0 else recent.size + 1)
    LaunchedEffect(lead) {
        if (lead > 0 && listState.firstVisibleItemIndex <= lead) listState.scrollToItem(0)
    }

    AppScreen(
        account?.label ?: "Servers", subtitle = if (!loading && error == null && total > 0) ctrl.onlineSummary() else null,
        titleContent = {
            Row(Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClickLabel = "Switch account") { accountMenu = true }, verticalAlignment = Alignment.CenterVertically) {
                Text(account?.label ?: "Servers", Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Icon(Icons.Outlined.ArrowDropDown, null)
            }
        },
        anchor = {
            Box {
                DropdownMenu(accountMenu, { accountMenu = false }, offset = DpOffset(16.dp, 0.dp)) {
                    accounts.forEach { a ->
                        DropdownMenuItem(
                            { Column { Text(a.label, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(a.subtitle, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant, maxLines = 1) } },
                            { accountMenu = false; if (a.id != account?.id) nx.accounts.switchAccount(a.id) },
                            leadingIcon = { if (a.id == account?.id) Icon(Icons.Outlined.Check, "Active", tint = cs.primary) else Spacer(Modifier.size(24.dp)) },
                        )
                    }
                    HorizontalDivider(color = nxc.border)
                    DropdownMenuItem({ Text("Add server") }, { accountMenu = false; openAddServer() }, leadingIcon = { Icon(Icons.Outlined.Add, null) })
                    DropdownMenuItem({ Text("Authorize web login") }, {
                        accountMenu = false
                        scope.launch {
                            val raw = scanQrCode(context) ?: return@launch
                            QrPayloads.parseAuthorize(raw)?.let(onAuthorize) ?: toaster.show("Invalid QR code")
                        }
                    }, leadingIcon = { Icon(Icons.Outlined.QrCodeScanner, null) })
                }
            }
        },
        header = {
            SearchAndFilters(ctrl)
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth()) else Spacer(Modifier.height(4.dp))
        },
    ) { padding ->
        when {
            loading -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            error != null -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                StateMessage(Icons.Outlined.ErrorOutline, "Something went wrong", error, isError = true) { scope.launch { ctrl.load() } }
            }
            else -> PullToRefreshBox(refreshing, refresh, Modifier.padding(padding).fillMaxSize()) {
                LazyColumn(Modifier.fillMaxSize(), listState, contentPadding = PaddingValues(bottom = 16.dp)) {
                    if (rows.isEmpty()) item { StateMessage(Icons.Outlined.CloudOff, ctrl.emptyTitle(), ctrl.emptySubtitle()) }
                    val section = { title: String, prefix: String, servers: List<Server> ->
                        item(key = "$prefix-header") { SectionHeader(title) }
                        itemsIndexed(servers, key = { _, s -> "$prefix:${s.id}" }) { i, server ->
                            ServerItem(ServerListRow.ServerRow(server, 0), i == 0, i == servers.lastIndex, server.id in pausedIds, server.id in favoriteIds,
                                { act(ctrl.primaryIntent(server)) }, { sheet = ServerSheet.Menu(server) }, ::act)
                        }
                    }
                    if (pinned) {
                        if (favorites.isNotEmpty()) section("Favourites", "favorite", favorites)
                        if (recent.isNotEmpty()) section("Recent", "recent", recent)
                        item(key = "all-header") { SectionHeader("All Servers") }
                    }
                    itemsIndexed(rows, key = { _, row -> row.key }) { i, row ->
                        when (row) {
                            is ServerListRow.FolderRow -> FolderItem(row, i == 0, i == rows.lastIndex) { ctrl.toggleFolder(row.folder.id) }
                            is ServerListRow.ServerRow -> ServerItem(row, i == 0, i == rows.lastIndex, row.server.id in pausedIds, row.server.id in favoriteIds,
                                { act(ctrl.primaryIntent(row.server)) }, { sheet = ServerSheet.Menu(row.server) }, ::act)
                        }
                    }
                }
            }
        }
    }

    when (val s = sheet) {
        is ServerSheet.Menu -> ModalBottomSheet({ sheet = null }) {
            val favorite = s.server.id in favoriteIds
            ListItem(
                headlineContent = { Text(s.server.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                supportingContent = { Text(s.server.detail, style = MonoStyle, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                leadingContent = { ServerTile(s.server) }, colors = transparentListItem,
            )
            HorizontalDivider(color = nxc.border)
            Column(Modifier.verticalScroll(rememberScrollState())) {
                SheetItem(if (favorite) Icons.Outlined.Star else Icons.Outlined.StarOutline, if (favorite) "Remove from Favourites" else "Add to Favourites") {
                    sheet = null; ctrl.toggleFavorite(s.server)
                }
                ctrl.menu(s.server).forEach { item ->
                    ListItem(
                        headlineContent = { Text(item.label, color = if (item.action.isDestructive) MaterialTheme.colorScheme.error else Color.Unspecified) },
                        leadingContent = { Icon(iconFor(item.action.iconKey), null, tint = if (item.action.isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) },
                        trailingContent = if (item.hasOptions) { { Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, "More options") } } else null,
                        colors = transparentListItem,
                        modifier = Modifier.clickable {
                            if (item.hasOptions) sheet = ServerSheet.Options(s.server, item) else { sheet = null; act(item.intent) }
                        },
                    )
                }
            }
        }
        is ServerSheet.Options -> ModalBottomSheet({ sheet = null }) {
            ListItem(
                headlineContent = { Text(s.item.label, style = MaterialTheme.typography.titleMedium) },
                supportingContent = { Text(s.server.name) },
                leadingContent = { IconButton({ sheet = ServerSheet.Menu(s.server) }) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } },
                colors = transparentListItem,
            )
            HorizontalDivider(color = nxc.border)
            Column(Modifier.verticalScroll(rememberScrollState())) {
                s.item.options.forEach { option ->
                    SheetItem(optionIcon(s.item), option.label) { sheet = null; act(option.intent) }
                }
            }
        }
        is ServerSheet.Quick -> QuickConnectSheet(s.server, { sheet = null }) { identity ->
            sheet = null
            start(ctrl.request(s.server, s.type, identity))
        }
        is ServerSheet.Scripts -> ScriptPickerSheet(ctrl, s.server, { sheet = null }) { script ->
            sheet = null
            start(ctrl.scriptRequest(s.server, s.identityId, script))
        }
        null -> Unit
    }
    askReason?.let { p -> ConnectionReasonDialog(p.server.name, { askReason = null }) { askReason = null; create(p, it) } }
}

private fun optionIcon(item: ServerMenuItem) = when (item.action) {
    ServerAction.JOIN -> Icons.Outlined.Person
    ServerAction.RESUME -> Icons.Outlined.History
    else -> Icons.Outlined.Key
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScriptPickerSheet(ctrl: ServerListController, server: Server, onDismiss: () -> Unit, onRun: (Script) -> Unit) {
    var scripts by remember { mutableStateOf<List<Script>?>(null) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(server.id) { scripts = ctrl.scriptsFor(server) }
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        SheetHeader(iconFor("script-text-outline"), "Run Script", server.name)
        OutlinedTextField(
            query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Search scripts") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true,
        )
        val list = scripts
        when {
            list == null -> Box(Modifier.fillMaxWidth().height(200.dp), Alignment.Center) { CircularProgressIndicator() }
            list.isEmpty() -> StateMessage(iconFor("script-text-outline"), "No scripts available", "No scripts match this server's operating system")
            else -> LazyColumn(Modifier.fillMaxHeight(0.7f)) {
                val shown = list.filter { it.matches(query) }
                if (shown.isEmpty()) item { StateMessage(Icons.Outlined.SearchOff, "No results", null) }
                items(shown, key = { "${it.sourceId}-${it.id}" }) { script ->
                    ListItem(
                        headlineContent = { Text(script.name) },
                        supportingContent = script.description?.let { { Text(it, maxLines = 2, overflow = TextOverflow.Ellipsis) } },
                        leadingContent = { LeadingTile(iconFor("script-text-outline")) },
                        trailingContent = if (script.isFromSource) { { Icon(Icons.Outlined.CloudDownload, "From a source", Modifier.size(18.dp), MaterialTheme.colorScheme.onSurfaceVariant) } } else null,
                        colors = transparentListItem, modifier = Modifier.clickable { onRun(script) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchAndFilters(ctrl: ServerListController) {
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
        expanded = false, onExpandedChange = {}, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).focusOnTapOnly(), windowInsets = WindowInsets(0),
        colors = SearchBarDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {}
    if (tags.isNotEmpty()) LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (selected.isNotEmpty()) item {
            InputChip(true, ctrl::clearTags, { Text("Clear") }, trailingIcon = { Icon(Icons.Outlined.Close, "Clear tags", Modifier.size(InputChipDefaults.IconSize)) })
        }
        items(tags, key = { it.id }) { tag ->
            FilterChip(tag.id in selected, { ctrl.toggleTag(tag.id) }, { Text(tag.name) }, leadingIcon = { Box(Modifier.size(8.dp).background(tagColor(tag), CircleShape)) })
        }
    }
}

private fun Modifier.entryRow(depth: Int) = heightIn(min = 56.dp).padding(start = (14 + depth * 16).dp, end = 14.dp, top = 8.dp, bottom = 8.dp)

@Composable
private fun FolderItem(row: ServerListRow.FolderRow, first: Boolean, last: Boolean, onToggle: () -> Unit) {
    val rotation by animateFloatAsState(if (row.isExpanded) 180f else 0f, label = "chevron")
    Row(
        Modifier.groupRow(first, last, MaterialTheme.colorScheme.surfaceContainer).clickable(row.folder.hasEntries, onClick = onToggle)
            .entryRow(row.depth),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LeadingTile(iconFor(row.iconKey), roleColor(row.colorRole), 32.dp)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(row.folder.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            row.subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (row.folder.hasEntries) Icon(Icons.Outlined.ExpandMore, if (row.isExpanded) "Collapse" else "Expand", Modifier.rotate(rotation), MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerItem(
    row: ServerListRow.ServerRow, first: Boolean, last: Boolean, hasPaused: Boolean, favorite: Boolean,
    onClick: () -> Unit, onLongClick: () -> Unit, onAction: (ServerIntent) -> Unit,
) {
    val server = row.server
    val cs = MaterialTheme.colorScheme
    val endAction = remember(server) { ServerIntent.Connect(server, ConnectionType.SFTP, null).takeIf { ConnectionRules.supportsSftp(server) } }
    val startAction = remember(server) { ServerIntent.Wake(server).takeIf { server.canWakeOnLan } }
    val fire by rememberUpdatedState { value: SwipeToDismissBoxValue ->
        when (value) {
            SwipeToDismissBoxValue.EndToStart -> endAction?.let(onAction)
            SwipeToDismissBoxValue.StartToEnd -> startAction?.let(onAction)
            SwipeToDismissBoxValue.Settled -> Unit
        }
    }
    val state = rememberSwipeToDismissBoxState()
    val rowScope = rememberCoroutineScope()
    LaunchedEffect(state.currentValue) {
        val value = state.currentValue
        if (value == SwipeToDismissBoxValue.Settled) return@LaunchedEffect
        rowScope.launch { state.snapTo(SwipeToDismissBoxValue.Settled) }
        fire(value)
    }
    SwipeToDismissBox(
        state, modifier = Modifier.groupRow(first, last, cs.surfaceContainer),
        enableDismissFromStartToEnd = startAction != null, enableDismissFromEndToStart = endAction != null,
        backgroundContent = {
            val toStart = state.dismissDirection == SwipeToDismissBoxValue.EndToStart
            val (label, icon) = if (toStart) "File Browser" to Icons.Outlined.FolderOpen else "Wake-On-LAN" to Icons.Outlined.Power
            val tint = if (toStart) cs.primary else nxc.warning
            if (state.dismissDirection != SwipeToDismissBoxValue.Settled) Row(
                Modifier.fillMaxSize().background(tint.copy(alpha = 0.18f)).padding(horizontal = 20.dp),
                Arrangement.spacedBy(10.dp, if (toStart) Alignment.End else Alignment.Start), Alignment.CenterVertically,
            ) {
                if (!toStart) Icon(icon, null, tint = tint)
                Text(label, color = tint, style = MaterialTheme.typography.labelLarge)
                if (toStart) Icon(icon, null, tint = tint)
            }
        },
    ) {
        Row(
            Modifier.background(cs.surfaceContainer).combinedClickable(onLongClick = onLongClick, onLongClickLabel = "More actions", onClick = onClick)
                .entryRow(row.depth),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ServerTile(server)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(server.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    color = if (server.isStopped) cs.onSurfaceVariant else cs.onSurface)
                Text(server.detail, style = MonoStyle, color = cs.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (hasPaused) Icon(Icons.Outlined.Bedtime, "Hibernated session", Modifier.size(16.dp), cs.onSurfaceVariant)
                if (favorite) Icon(Icons.Outlined.Star, "Favourite", Modifier.size(16.dp), nxc.warning)
                TagDots(row.tagDots)
            }
        }
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
