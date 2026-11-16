package dev.gnm.nexterm.app

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.m3.Markdown
import dev.gnm.nexterm.session.ChatMessage
import dev.gnm.nexterm.session.ChatRole
import dev.gnm.nexterm.session.ToolStatus
import dev.gnm.nexterm.session.AppSession

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiAssistantSheet(session: AppSession, onDismiss: () -> Unit) {
    val chat = rememberClosing(session, { nx.newAIChat(session) }, { it.close() })
    val state by chat.state.watch()
    var input by remember { mutableStateOf("") }
    val list = rememberLazyListState()
    val context = LocalContext.current
    val cs = MaterialTheme.colorScheme
    val canListen = remember { SpeechRecognizer.isRecognitionAvailable(context) }
    val voice = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK) r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { input = it }
    }
    val itemCount = state.messages.size + (if (state.isRunning) 1 else 0) + (if (state.connectionError != null) 1 else 0)
    LaunchedEffect(itemCount, state.messages.lastOrNull()?.text?.length) { if (itemCount > 0) list.animateScrollToItem(itemCount - 1) }
    fun send() { if (chat.send(input)) input = "" }

    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(true)) {
        SheetHeader(Icons.Outlined.SmartToy, "AI Assistant", chat.serverName) { IconButton(onDismiss) { Icon(Icons.Outlined.Close, "Close") } }
        HorizontalDivider()
        Box(Modifier.fillMaxHeight(0.8f).fillMaxWidth()) {
            if (state.isEmpty) Column(Modifier.align(Alignment.Center).padding(horizontal = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.SmartToy, null, Modifier.size(48.dp), cs.outline)
                Text("Ask the assistant to inspect or change this server. It can run commands and read or edit files directly over the connection.",
                    Modifier.padding(top = 16.dp), color = cs.outline, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium)
            } else LazyColumn(Modifier.fillMaxSize(), list, PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(state.messages, key = { it.id }) { Message(it) { id, allow -> chat.confirm(id, allow) } }
                if (state.isRunning) item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Text("Thinking...", Modifier.padding(start = 10.dp), color = cs.outline, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                state.connectionError?.let { item { ErrorBanner(it) } }
            }
        }
        HorizontalDivider()
        Row(Modifier.padding(12.dp).imePadding(), verticalAlignment = Alignment.Bottom) {
            if (canListen) IconButton({
                voice.launch(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM))
            }, enabled = state.isReady) { Icon(Icons.Outlined.Mic, "Voice input", tint = cs.outline) }
            OutlinedTextField(
                input, { input = it }, Modifier.weight(1f).heightIn(max = 120.dp), enabled = state.isReady,
                placeholder = { Text(state.inputHint) }, maxLines = 4, shape = MaterialTheme.shapes.extraLarge,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions { send() },
            )
            Spacer(Modifier.width(8.dp))
            if (state.isRunning) FilledIconButton(chat::stop, colors = IconButtonDefaults.filledIconButtonColors(cs.error, cs.onError)) { Icon(Icons.Outlined.Stop, "Stop") }
            else FilledIconButton(::send, enabled = chat.canSend(input)) { Icon(Icons.AutoMirrored.Outlined.Send, "Send") }
        }
    }
}

@Composable
private fun Message(m: ChatMessage, onConfirm: (String, Boolean) -> Unit) {
    val cs = MaterialTheme.colorScheme
    when (m.role) {
        ChatRole.USER -> Box(Modifier.fillMaxWidth().padding(start = 40.dp), contentAlignment = Alignment.CenterEnd) {
            SelectionContainer {
                Surface(shape = MaterialTheme.shapes.large, color = cs.primary) { Text(m.text, Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) }
            }
        }
        ChatRole.ASSISTANT -> Box(Modifier.padding(end = 24.dp)) { Markdown(m.text) }
        ChatRole.SYSTEM -> ErrorBanner(m.text)
        ChatRole.TOOL -> ToolCard(m, onConfirm)
    }
}

@Composable
private fun ToolCard(m: ChatMessage, onConfirm: (String, Boolean) -> Unit) {
    val cs = MaterialTheme.colorScheme
    val output = @Composable { text: String, isError: Boolean ->
        SelectionContainer {
            Surface(Modifier.padding(horizontal = 12.dp).padding(bottom = 10.dp).fillMaxWidth(), MaterialTheme.shapes.small) {
                Text(text, Modifier.padding(10.dp), style = MonoStyle, color = if (isError) cs.error else cs.onSurface)
            }
        }
    }
    OutlinedCard(border = BorderStroke(1.dp, if (m.isFailed) cs.error else cs.outlineVariant)) {
        Column {
            Row(Modifier.padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(iconFor(m.toolIconKey), null, Modifier.size(16.dp), cs.onSurfaceVariant)
                Text(m.toolLabel, Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.labelLarge)
                when (m.status) {
                    ToolStatus.RUNNING -> CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                    ToolStatus.DONE -> if (m.isFailed) Text("exit ${m.exitCode}", color = cs.error, style = MaterialTheme.typography.labelMedium)
                        else Icon(Icons.Outlined.Check, null, Modifier.size(16.dp), Color(0xFF4CAF50))
                    ToolStatus.DENIED -> Icon(Icons.Outlined.Block, null, Modifier.size(16.dp), cs.error)
                    ToolStatus.ABORTED -> Icon(Icons.Outlined.Stop, null, Modifier.size(16.dp), cs.outline)
                    ToolStatus.ERROR -> Icon(Icons.Outlined.Close, null, Modifier.size(16.dp), cs.error)
                    else -> Unit
                }
            }
            if (m.summary.isNotEmpty()) Text(m.summary, Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp), style = MonoStyle, color = cs.onSurfaceVariant)
            if (m.isAwaitingConfirmation) Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)) {
                Text("Allow this action?", style = MaterialTheme.typography.bodyMedium)
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton({ onConfirm(m.callId!!, false) }, Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = cs.error)) {
                        Icon(Icons.Outlined.Block, null, Modifier.size(16.dp)); Text("Deny", Modifier.padding(start = 6.dp))
                    }
                    Button({ onConfirm(m.callId!!, true) }, Modifier.weight(1f)) { Icon(Icons.Outlined.Check, null, Modifier.size(16.dp)); Text("Allow", Modifier.padding(start = 6.dp)) }
                }
            }
            m.note?.let { Text(it, Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp), style = MaterialTheme.typography.bodySmall, color = if (m.status == ToolStatus.ERROR) cs.error else cs.outline) }
            m.stdout?.let { output(it, false) }
            m.stderr?.let { output(it, true) }
            m.fileContent?.let { output(it, false) }
            if (m.directoryEntries.isNotEmpty()) FlowRow(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                m.directoryEntries.forEach { Text(it.displayName, style = MonoStyle, color = if (it.isFolder) cs.primary else cs.onSurfaceVariant) }
            }
        }
    }
}
