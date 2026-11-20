package dev.gnm.nexterm.app

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.model.markdownAnimations
import com.mikepenz.markdown.model.rememberMarkdownState
import dev.gnm.nexterm.session.AIChatSession
import dev.gnm.nexterm.session.AIChatState
import dev.gnm.nexterm.session.ApprovalMode
import dev.gnm.nexterm.session.ChatMessage
import dev.gnm.nexterm.session.ChatRole
import dev.gnm.nexterm.session.ToolStatus
import dev.gnm.nexterm.state.ServerListController
import dev.gnm.nexterm.util.IconKeys
import dev.gnm.nexterm.util.ServerFilter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssistantScreen(servers: ServerListController) = Scaffold(
    topBar = { TopAppBar({ Text("Assistant") }, actions = { AssistantActions(nx.assistant) }) },
) { padding -> AssistantBody(nx.assistant, servers, Modifier.padding(padding).consumeWindowInsets(padding)) }

@Composable
private fun AssistantActions(chat: AIChatSession) {
    val state by chat.state.watch()
    var menu by remember { mutableStateOf(false) }
    IconButton(chat::newChat, enabled = !state.isEmpty) { Icon(Icons.Outlined.AddComment, "New chat") }
    Box {
        IconButton({ menu = true }) { Icon(iconFor(state.approvalMode.iconKey), "Approval mode: ${state.approvalMode.label}") }
        DropdownMenu(menu, { menu = false }) {
            ApprovalMode.entries.forEach { mode ->
                DropdownMenuItem(
                    text = {
                        Column(Modifier.padding(vertical = 6.dp)) {
                            Text(mode.label)
                            Text(mode.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    },
                    onClick = { menu = false; chat.setApprovalMode(mode) },
                    leadingIcon = { Icon(iconFor(mode.iconKey), null) },
                    trailingIcon = { if (mode == state.approvalMode) Icon(Icons.Outlined.Check, "Selected", tint = MaterialTheme.colorScheme.primary) },
                )
            }
        }
    }
}

@Composable
private fun AssistantBody(chat: AIChatSession, servers: ServerListController, modifier: Modifier = Modifier) {
    val state by chat.state.watch()
    var input by rememberSaveable { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    val list = rememberLazyListState()
    val context = LocalContext.current
    val cs = MaterialTheme.colorScheme
    val canListen = remember { SpeechRecognizer.isRecognitionAvailable(context) }
    val voice = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK) r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { input = it }
    }
    LaunchedEffect(chat) { chat.activate() }
    LaunchedEffect(state.messages.count { it.role == ChatRole.USER }) { if (state.messages.isNotEmpty()) list.scrollToItem(0) }
    fun send() { if (chat.send(input)) input = "" }

    if (state.isUnavailable) return Box(modifier.fillMaxSize(), Alignment.Center) {
        StateMessage(Icons.Outlined.CloudOff, "Assistant unavailable", state.connectionError)
    }
    Column(modifier.fillMaxSize().keyboardPadding()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (state.messages.isEmpty()) {
                Column(Modifier.align(Alignment.Center).verticalScroll(rememberScrollState()).padding(24.dp), Arrangement.spacedBy(12.dp), Alignment.CenterHorizontally) {
                    Logo(64.dp)
                    Text("What should we look at?", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                    if (state.allowedServers.isEmpty()) Text(
                        "The assistant can only act on servers you add. Tap Servers below to choose which ones it may use.",
                        color = cs.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center,
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                        state.suggestions.forEach { text -> SuggestionChip({ if (!chat.send(text)) input = text }, { Text(text) }) }
                    }
                }
            } else LazyColumn(Modifier.fillMaxSize(), list, PaddingValues(16.dp), reverseLayout = true, verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.Top)) {
                if (state.isRunning) item("status") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Text("Thinking...", Modifier.padding(start = 10.dp), color = cs.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    }
                } else if (state.canContinue) item("status") {
                    FilledTonalButton(chat::continueRun, enabled = state.isReady) { ButtonLabel(Icons.Outlined.PlayArrow, "Continue") }
                }
                items(state.messages.asReversed(), key = { it.id }) { Message(it, chat) }
            }
        }
        state.connectionError?.let { ErrorBanner(it, action = "Retry", onAction = chat::retry) }
        state.pendingApproval?.let { Approval(it, chat::confirm) }
        state.agentSessionsLabel?.let {
            Text(it, Modifier.fillMaxWidth().padding(top = 6.dp), cs.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
        }
        ScopeRow(state, chat) { picking = true }
        Row(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp), verticalAlignment = Alignment.Bottom) {
            if (canListen) IconButton({
                voice.launch(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM))
            }, enabled = state.isReady) { Icon(Icons.Outlined.Mic, "Voice input", tint = cs.onSurfaceVariant) }
            OutlinedTextField(
                input, { input = it }, Modifier.weight(1f).heightIn(max = 120.dp), enabled = state.isReady,
                placeholder = { Text(state.inputHint, maxLines = 1, overflow = TextOverflow.Ellipsis) }, maxLines = 4, shape = MaterialTheme.shapes.extraLarge,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions { send() },
            )
            Spacer(Modifier.width(8.dp))
            if (state.isRunning) FilledIconButton(chat::stop, colors = IconButtonDefaults.filledIconButtonColors(cs.error, cs.onError)) { Icon(Icons.Outlined.Stop, "Stop") }
            else FilledIconButton(::send, enabled = chat.canSend(input)) { Icon(Icons.AutoMirrored.Outlined.Send, "Send") }
        }
    }
    if (picking) ServerPicker(state, chat, servers) { picking = false }
}

@Composable
private fun ScopeRow(state: AIChatState, chat: AIChatSession, onPick: () -> Unit) =
    Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 2.dp), Arrangement.spacedBy(8.dp), Alignment.CenterVertically) {
        state.allowedServers.forEach { server ->
            val active = server.entryId == state.activeEntryId
            InputChip(
                active, { chat.focus(server.takeUnless { active }) }, { Text(server.name, maxLines = 1) },
                leadingIcon = { Icon(iconFor(IconKeys.server(server)), null, Modifier.size(InputChipDefaults.IconSize)) },
                trailingIcon = { Icon(Icons.Outlined.Close, "Remove ${server.name}", Modifier.clip(CircleShape).clickable { chat.revoke(server) }.size(InputChipDefaults.IconSize)) },
            )
        }
        AssistChip(onPick, { Text("Servers") }, leadingIcon = { Icon(Icons.Outlined.Add, null, Modifier.size(AssistChipDefaults.IconSize)) })
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerPicker(state: AIChatState, chat: AIChatSession, servers: ServerListController, onDismiss: () -> Unit) {
    val all by servers.allServers.watch()
    var query by remember { mutableStateOf("") }
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        SheetHeader(Icons.Outlined.Dns, "Servers", "Choose what the assistant may use") { TextButton(onDismiss) { Text("Done") } }
        SearchField(query, { query = it }, "Search servers")
        val shown = ServerFilter.assistantCandidates(all, query)
        LazyColumn(Modifier.fillMaxHeight(0.7f).imePadding()) {
            if (shown.isEmpty()) item { StateMessage(Icons.Outlined.SearchOff, if (all.isEmpty()) "No servers" else "No results", null) }
            items(shown, key = { it.id.orEmpty() }) { server ->
                ListItem(
                    headlineContent = { Text(server.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    supportingContent = { Text(server.detail, style = MonoStyle, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    leadingContent = { ServerTile(server) },
                    trailingContent = { Checkbox(state.isAllowed(server), null) },
                    colors = transparentListItem, modifier = Modifier.clickable { chat.toggle(server) },
                )
            }
        }
    }
}

@Composable
private fun Approval(m: ChatMessage, onConfirm: (String, Boolean) -> Unit) = HairlineCard(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp), selected = true) {
    val cs = MaterialTheme.colorScheme
    Row(Modifier.padding(start = 12.dp, top = 12.dp, end = 12.dp), Arrangement.spacedBy(12.dp), Alignment.CenterVertically) {
        LeadingTile(iconFor(m.toolIconKey), nxc.warning, 32.dp)
        Column {
            Text("Allow “${m.toolLabel}”?", style = MaterialTheme.typography.titleSmall)
            if (m.summary.isNotEmpty()) Text(m.summary, style = MonoStyle, color = cs.onSurfaceVariant, maxLines = 4, overflow = TextOverflow.Ellipsis)
        }
    }
    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedButton({ onConfirm(m.callId!!, false) }, Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = cs.error)) { Text("Deny") }
        Button({ onConfirm(m.callId!!, true) }, Modifier.weight(1f)) { Text("Allow") }
    }
}

@Composable
private fun Message(m: ChatMessage, chat: AIChatSession) {
    val cs = MaterialTheme.colorScheme
    when (m.role) {
        ChatRole.USER -> Box(Modifier.fillMaxWidth().padding(start = 40.dp), contentAlignment = Alignment.CenterEnd) {
            SelectionContainer { Text(m.text, Modifier.background(nxc.accentFill, RoundedCornerShape(18.dp)).padding(horizontal = 14.dp, vertical = 10.dp), cs.onSurface) }
        }
        ChatRole.ASSISTANT -> Box(Modifier.padding(end = 24.dp)) { StableMarkdown(m.text) }
        ChatRole.NOTE -> Text(m.text, Modifier.fillMaxWidth(), cs.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
        ChatRole.SYSTEM -> ErrorBanner(m.text, shape = RoundedCornerShape(12.dp))
        ChatRole.TOOL -> ToolCard(m) { chat.QuestionBody(m) }
    }
}

@Composable
private fun StableMarkdown(text: String) =
    Markdown(rememberMarkdownState(text, retainState = true), modifier = Modifier.fillMaxWidth(), animations = markdownAnimations(animateTextSize = { this }))

@Composable
private fun ToolCard(m: ChatMessage, question: @Composable () -> Unit) {
    val cs = MaterialTheme.colorScheme
    var open by rememberSaveable(m.id) { mutableStateOf(false) }
    val hasOutput = m.stdout != null || m.stderr != null || m.fileContent != null || m.directoryEntries.isNotEmpty() || m.images.isNotEmpty()
    val failed = m.isFailed || m.status == ToolStatus.ERROR
    val output = @Composable { text: String, isError: Boolean ->
        SelectionContainer {
            Text(
                text, Modifier.padding(horizontal = 10.dp).padding(bottom = 10.dp).fillMaxWidth().background(nxc.fill, RoundedCornerShape(8.dp)).padding(10.dp),
                style = MonoStyle, color = if (isError) cs.error else cs.onSurface,
            )
        }
    }
    HairlineCard(Modifier.fillMaxWidth()) {
        Row(Modifier.clickable(hasOutput) { open = !open }.padding(10.dp), Arrangement.spacedBy(10.dp), Alignment.CenterVertically) {
            LeadingTile(iconFor(m.toolIconKey), if (failed) nxc.error else cs.primary, 28.dp)
            Column(Modifier.weight(1f)) {
                Text(m.toolLabel, style = MaterialTheme.typography.labelLarge)
                if (m.summary.isNotEmpty()) Text(m.summary, style = MonoStyle, color = cs.onSurfaceVariant, maxLines = if (open) Int.MAX_VALUE else 2, overflow = TextOverflow.Ellipsis)
            }
            when (m.status) {
                ToolStatus.RUNNING -> CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                ToolStatus.AWAITING_CONFIRM -> StatusPill("Needs approval", nxc.warning)
                ToolStatus.DONE -> if (m.isFailed) Text(m.exitCode?.let { "exit $it" } ?: "failed", color = cs.error, style = MonoStyle)
                    else if (!m.isQuestion) Icon(Icons.Outlined.Check, "Done", Modifier.size(16.dp), nxc.success)
                ToolStatus.DENIED -> Icon(Icons.Outlined.Block, "Denied", Modifier.size(16.dp), cs.error)
                ToolStatus.ABORTED -> Icon(Icons.Outlined.Stop, "Stopped", Modifier.size(16.dp), cs.onSurfaceVariant)
                ToolStatus.ERROR -> Icon(Icons.Outlined.Close, "Failed", Modifier.size(16.dp), cs.error)
                else -> Unit
            }
            if (hasOutput) Icon(Icons.Outlined.ExpandMore, if (open) "Hide output" else "Show output", Modifier.size(18.dp).rotate(if (open) 180f else 0f), cs.onSurfaceVariant)
        }
        if (m.isQuestion) question()
        m.note?.let { Text(it, Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp), style = MaterialTheme.typography.bodySmall, color = if (m.status == ToolStatus.ERROR) cs.error else cs.onSurfaceVariant) }
        if (open) {
            m.stdout?.let { output(it, false) }
            m.stderr?.let { output(it, true) }
            m.fileContent?.let { output(it, false) }
            if (m.directoryEntries.isNotEmpty()) FlowRow(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                m.directoryEntries.forEach { Text(it.displayName, style = MonoStyle, color = if (it.isFolder) cs.primary else cs.onSurfaceVariant) }
            }
            m.images.forEach { img ->
                val bitmap = remember(img.data) { runCatching { Base64.decode(img.data, Base64.DEFAULT).let { BitmapFactory.decodeByteArray(it, 0, it.size) } }.getOrNull() }
                bitmap?.let { Image(it.asImageBitmap(), null, Modifier.padding(horizontal = 10.dp).padding(bottom = 10.dp).fillMaxWidth().clip(RoundedCornerShape(8.dp))) }
            }
        }
    }
}

@Composable
private fun AIChatSession.QuestionBody(m: ChatMessage) {
    val cs = MaterialTheme.colorScheme
    var text by remember(m.callId) { mutableStateOf("") }
    var selected by remember(m.callId) { mutableStateOf(emptyList<String>()) }
    val callId = m.callId ?: return
    fun submit() {
        val typed = text.trim()
        if (m.isMultiSelect) answer(callId, if (typed.isEmpty()) selected else selected + typed) else if (typed.isNotEmpty()) answer(callId, typed)
    }
    Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp)) {
        m.question?.let { StableMarkdown(it) }
        if (m.isAwaitingAnswer) {
            if (m.questionOptions.isNotEmpty()) FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                m.questionOptions.forEach { o ->
                    val isSelected = o.label in selected
                    FilterChip(isSelected, {
                        if (!m.isMultiSelect) answer(callId, o.label)
                        else selected = if (isSelected) selected - o.label else selected + o.label
                    }, { Text(o.label) }, leadingIcon = if (isSelected) ({ Icon(Icons.Outlined.Check, null, Modifier.size(16.dp)) }) else null)
                }
            }
            if (m.allowsFreeText || m.isMultiSelect) Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (m.allowsFreeText) OutlinedTextField(
                    text, { text = it }, Modifier.weight(1f), maxLines = 4,
                    placeholder = { Text(if (m.questionOptions.isEmpty()) "Type your answer..." else "Something else...") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions { submit() },
                ) else Spacer(Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                FilledIconButton(::submit, enabled = text.isNotBlank() || (m.isMultiSelect && selected.isNotEmpty())) { Icon(Icons.AutoMirrored.Outlined.Send, "Send answer") }
            }
        }
        m.answer?.let { Text(it, Modifier.padding(top = 8.dp), color = cs.primary, style = MaterialTheme.typography.bodyMedium) }
    }
}
