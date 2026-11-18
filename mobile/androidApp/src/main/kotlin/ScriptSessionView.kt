package dev.gnm.nexterm.app

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.toClipEntry
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ScriptDialog
import dev.gnm.nexterm.session.ScriptInputKind
import dev.gnm.nexterm.session.ScriptRun
import dev.gnm.nexterm.session.ScriptStepStatus
import kotlinx.coroutines.launch

@Composable
fun ScriptSessionView(session: AppSession) {
    val run = session.script ?: return
    val state by run.state.watch()
    val toaster = LocalToaster.current
    LaunchedEffect(state.notice) { state.notice?.let { toaster.show(it) } }
    TerminalSessionView(session) { ScriptProgress(run) }
    ScriptDialogs(run, state.dialog)
}

@Composable
private fun ScriptProgress(run: ScriptRun) {
    val state by run.state.watch()
    var expanded by remember { mutableStateOf(false) }
    val cs = MaterialTheme.colorScheme
    Surface(color = cs.surfaceContainer) {
        Column {
            ListItem(
                headlineContent = { Text(state.name) },
                supportingContent = { Text("${state.summary} · ${state.currentTitle}", maxLines = 1) },
                leadingContent = {
                    when {
                        state.isFailed -> Icon(Icons.Outlined.ErrorOutline, null, tint = cs.error)
                        state.isCompleted -> Icon(Icons.Outlined.CheckCircle, null, tint = cs.primary)
                        else -> CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                    }
                },
                trailingContent = { Icon(Icons.Outlined.ExpandMore, if (expanded) "Hide steps" else "Show steps", Modifier.rotate(if (expanded) 180f else 0f)) },
                colors = transparentListItem,
                modifier = Modifier.clickable { expanded = !expanded },
            )
            if (state.isRunning) {
                val fraction = state.fraction
                if (fraction >= 0) LinearProgressIndicator({ fraction.toFloat() }, Modifier.fillMaxWidth()) else LinearProgressIndicator(Modifier.fillMaxWidth())
            }
            AnimatedVisibility(expanded) {
                Column(Modifier.heightIn(max = 240.dp).verticalScroll(rememberScrollState()).padding(bottom = 8.dp)) {
                    state.steps.forEach { step ->
                        val (icon, tint) = when (step.status) {
                            ScriptStepStatus.DONE -> Icons.Outlined.CheckCircle to cs.primary
                            ScriptStepStatus.RUNNING -> Icons.Outlined.PlayCircle to cs.tertiary
                            ScriptStepStatus.FAILED -> Icons.Outlined.Cancel to cs.error
                            ScriptStepStatus.SKIPPED -> Icons.Outlined.RemoveCircleOutline to cs.outline
                            ScriptStepStatus.PENDING -> Icons.Outlined.RadioButtonUnchecked to cs.outline
                        }
                        ListItem(
                            headlineContent = { Text(step.title.ifEmpty { "Step ${step.index + 1}" }, style = MaterialTheme.typography.bodyMedium) },
                            leadingContent = { Icon(icon, null, Modifier.size(20.dp), tint) },
                            colors = transparentListItem,
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScriptDialogs(run: ScriptRun, dialog: ScriptDialog?) {
    when (dialog) {
        is ScriptDialog.Input -> ScriptInputDialog(run, dialog)
        is ScriptDialog.Notice -> AlertDialog(
            onDismissRequest = run::dismiss, title = { Text(dialog.title) },
            text = { Text(dialog.message, Modifier.verticalScroll(rememberScrollState())) },
            confirmButton = { TextButton(run::dismiss) { Text("OK") } },
        )
        is ScriptDialog.Summary -> ModalBottomSheet(run::dismiss) {
            ResultHeader(dialog.title, dialog.items.joinToString("\n") { "${it.label}: ${it.value}" }, run::dismiss)
            LazyColumn(Modifier.padding(bottom = 16.dp)) {
                items(dialog.items) { ListItem(headlineContent = { Text(it.value) }, overlineContent = { Text(it.label) }, colors = transparentListItem) }
            }
        }
        is ScriptDialog.Table -> ModalBottomSheet(run::dismiss, sheetState = rememberModalBottomSheetState(true)) {
            ResultHeader(dialog.title, dialog.rows.joinToString("\n") { row -> row.cells.joinToString(", ") { it.value } }, run::dismiss)
            LazyColumn(Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (dialog.rows.isEmpty()) item { StateMessage(Icons.Outlined.TableRows, "No rows", null) }
                items(dialog.rows, key = { it.index }) { row ->
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            row.cells.forEach { cell ->
                                Row {
                                    Text(cell.label, Modifier.weight(0.4f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(cell.value, Modifier.weight(0.6f), style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
        null -> Unit
    }
}

@Composable
private fun ResultHeader(title: String, copyText: String, onClose: () -> Unit) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val toaster = LocalToaster.current
    SheetHeader(Icons.Outlined.Assignment, title, null) {
        Row {
            IconButton({ scope.launch { clipboard.setClipEntry(android.content.ClipData.newPlainText(title, copyText).toClipEntry()); toaster.show("Copied") } }) {
                Icon(Icons.Outlined.ContentCopy, "Copy")
            }
            IconButton(onClose) { Icon(Icons.Outlined.Close, "Close") }
        }
    }
    HorizontalDivider()
}

@Composable
private fun ScriptInputDialog(run: ScriptRun, input: ScriptDialog.Input) {
    var value by remember(input) { mutableStateOf(if (input.kind == ScriptInputKind.TEXT) input.placeholder else "") }
    val secret = input.kind == ScriptInputKind.PASSWORD
    AlertDialog(
        onDismissRequest = {},
        title = { Text("Input Required") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(input.prompt)
                when (input.kind) {
                    ScriptInputKind.SELECT -> Column {
                        input.options.forEach { option ->
                            ListItem(
                                headlineContent = { Text(option) }, leadingContent = { RadioButton(false, null) },
                                colors = transparentListItem, modifier = Modifier.clickable { run.submit(option) },
                            )
                        }
                    }
                    ScriptInputKind.CONFIRM -> Unit
                    else -> OutlinedTextField(
                        value, { value = it }, Modifier.fillMaxWidth(), singleLine = true,
                        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = if (secret) KeyboardType.Password else KeyboardType.Text),
                    )
                }
            }
        },
        dismissButton = { TextButton(run::cancel) { Text("Cancel") } },
        confirmButton = {
            when (input.kind) {
                ScriptInputKind.SELECT -> Unit
                ScriptInputKind.CONFIRM -> Row {
                    TextButton({ run.submit("No") }) { Text("No") }
                    TextButton({ run.submit("Yes") }) { Text("Yes") }
                }
                else -> TextButton({ run.submit(value) }, enabled = if (secret) value.isNotEmpty() else value.isNotBlank()) { Text("Submit") }
            }
        },
    )
}
