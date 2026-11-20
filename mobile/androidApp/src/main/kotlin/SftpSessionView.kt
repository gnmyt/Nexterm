package dev.gnm.nexterm.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.SftpEntry
import dev.gnm.nexterm.session.AppSession
import dev.gnm.nexterm.session.ConnectionState
import dev.gnm.nexterm.session.SftpBrowser
import dev.gnm.nexterm.session.UploadSource
import dev.gnm.nexterm.util.IconKeys
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream

private sealed interface SftpDialog {
    data object NewFolder : SftpDialog
    data class Rename(val entry: SftpEntry) : SftpDialog
    data class Delete(val entries: List<SftpEntry>) : SftpDialog
    data class Actions(val entry: SftpEntry) : SftpDialog
    data object Add : SftpDialog
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SftpSessionView(session: AppSession) {
    val browser = session.sftp ?: return
    val entries by browser.entries.watch()
    val loading by browser.isLoading.watch()
    val connected by browser.isConnected.watch()
    val connection by browser.connectionState.watch()
    val error by browser.error.watch()
    val selected by browser.selected.watch()
    val transfer by browser.transfer.watch()
    val context = LocalContext.current
    val toaster = LocalToaster.current
    val scope = rememberCoroutineScope()
    var dialog by remember { mutableStateOf<SftpDialog?>(null) }
    val cs = MaterialTheme.colorScheme

    fun delete(list: List<SftpEntry>) = if (browser.needsDeleteConfirmation()) dialog = SftpDialog.Delete(list) else browser.delete(list)
    fun download(list: List<SftpEntry>, share: Boolean) = scope.launch {
        val files = list.filter { !it.isDir }.mapNotNull { e ->
            runCatching {
                val file = File(context.cacheDir, "sftp/${e.name}").apply { parentFile?.mkdirs() }
                file.outputStream().use { out -> browser.downloadTo(e) { out.write(it) } }
                file
            }.onFailure { toaster.show("Download failed: ${it.message}") }.getOrNull()
        }
        when {
            list.none { !it.isDir } -> toaster.show("No files selected for download")
            share || files.size > 1 -> context.shareFiles(files)
            files.size == 1 -> toaster.show("Downloaded ${files[0].name}", "Open") { context.openFile(files[0]) }
        }
    }
    val upload = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isEmpty()) return@rememberLauncherForActivityResult
        scope.launch {
            val streams = mutableListOf<InputStream>()
            try {
                val sources = withContext(Dispatchers.IO) {
                    uris.mapNotNull { uri ->
                        val (name, size) = context.queryFile(uri)
                        val input = context.contentResolver.openInputStream(uri)?.also(streams::add) ?: return@mapNotNull null
                        if (size < 0) UploadSource.fromBytes(name, input.readBytes())
                        else UploadSource(name, size) { max -> ByteArray(max).let { b -> input.read(b).takeIf { it > 0 }?.let(b::copyOf) } }
                    }
                }
                toaster.show(browser.upload(sources).message)
            } finally {
                streams.forEach { runCatching { it.close() } }
            }
        }
    }

    Box(Modifier.fillMaxSize().background(cs.background).navigationBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            if (selected.isEmpty()) PathBar(browser, connected) else Row(Modifier.fillMaxWidth().height(48.dp).background(cs.secondaryContainer), verticalAlignment = Alignment.CenterVertically) {
                IconButton(browser::clearSelection) { Icon(Icons.Outlined.Close, "Cancel") }
                Text("${selected.size} selected", Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                IconButton({ download(browser.selectedEntries(), share = true); browser.clearSelection() }) { Icon(Icons.Outlined.Download, "Download") }
                IconButton({ dialog = SftpDialog.Rename(browser.selectedEntries().first()) }, enabled = selected.size == 1) { Icon(Icons.Outlined.Edit, "Rename") }
                IconButton({ delete(browser.selectedEntries()) }) { Icon(Icons.Outlined.Delete, "Delete", tint = cs.error) }
            }
            HorizontalDivider(color = nxc.border)
            if (connection != ConnectionState.DISCONNECTED) error?.let { ErrorBanner(it, browser::clearError) }
            transfer?.let { t ->
                if (t.fraction >= 0) LinearProgressIndicator({ t.fraction.toFloat() }, Modifier.fillMaxWidth()) else LinearProgressIndicator(Modifier.fillMaxWidth())
            }
            Box(Modifier.weight(1f)) {
                when {
                    !connected && loading -> ConnectionLoader(true)
                    loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                    entries.isEmpty() -> StateMessage(Icons.Outlined.FolderOpen, "Empty directory", null)
                    else -> PullToRefreshBox(false, browser::refresh) {
                        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 12.dp, bottom = 88.dp)) {
                            itemsIndexed(entries, key = { _, e -> e.name }) { i, e ->
                                EntryRow(e, i == 0, i == entries.lastIndex, selected.isNotEmpty(), e.name in selected, { browser.tap(e) }, { browser.longPress(e) }) { dialog = SftpDialog.Actions(e) }
                            }
                        }
                    }
                }
                if (connection == ConnectionState.DISCONNECTED) ConnectionFailed(session.sessionId, error, browser::clearError)
            }
        }
        if (selected.isEmpty() && connected && connection != ConnectionState.DISCONNECTED) FloatingActionButton({ dialog = SftpDialog.Add }, Modifier.align(Alignment.BottomEnd).padding(16.dp)) { Icon(Icons.Outlined.Add, "Add") }
    }

    val dismiss = { dialog = null }
    when (val d = dialog) {
        SftpDialog.NewFolder -> TextInputDialog("New Folder", "Folder name", confirm = "Create", onDismiss = dismiss, onConfirm = browser::createFolder)
        is SftpDialog.Rename -> TextInputDialog("Rename", "New name", d.entry.name, "Rename", dismiss) { browser.rename(d.entry, it) }
        is SftpDialog.Delete -> ConfirmDialog("Delete", browser.deleteConfirmationMessage(d.entries), "Delete", true, dismiss) { browser.delete(d.entries) }
        is SftpDialog.Actions -> ModalBottomSheet(dismiss) {
            SheetHeader(iconFor(IconKeys.file(d.entry)), d.entry.name, d.entry.formattedSize)
            HorizontalDivider()
            if (!d.entry.isDir) {
                SheetItem(Icons.Outlined.Download, "Download") { dismiss(); download(listOf(d.entry), share = false) }
                SheetItem(Icons.Outlined.Share, "Share") { dismiss(); download(listOf(d.entry), share = true) }
            }
            SheetItem(Icons.Outlined.Edit, "Rename") { dialog = SftpDialog.Rename(d.entry) }
            SheetItem(Icons.Outlined.Delete, "Delete", cs.error) { dismiss(); delete(listOf(d.entry)) }
        }
        SftpDialog.Add -> ModalBottomSheet(dismiss) {
            SheetItem(Icons.Outlined.CreateNewFolder, "New Folder") { dialog = SftpDialog.NewFolder }
            SheetItem(Icons.Outlined.Upload, "Upload File") { dismiss(); upload.launch(arrayOf("*/*")) }
        }
        null -> Unit
    }
}

@Composable
private fun PathBar(browser: SftpBrowser, connected: Boolean) {
    val crumbs by browser.breadcrumbs.watch()
    val canBack by browser.canGoBack.watch()
    val canUp by browser.canGoUp.watch()
    Row(Modifier.height(48.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(browser::goBack, enabled = canBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
        IconButton(browser::goUp, enabled = canUp) { Icon(Icons.Outlined.ArrowUpward, "Up") }
        LazyRow(Modifier.weight(1f), reverseLayout = true, verticalAlignment = Alignment.CenterVertically) {
            itemsIndexed(crumbs.reversed()) { i, c ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (i < crumbs.lastIndex) Icon(Icons.Outlined.ChevronRight, null, Modifier.size(16.dp), MaterialTheme.colorScheme.outline)
                    TextButton({ browser.navigateTo(c.path) }, enabled = !c.isCurrent, contentPadding = PaddingValues(horizontal = 4.dp),
                        colors = ButtonDefaults.textButtonColors(disabledContentColor = MaterialTheme.colorScheme.primary)) { Text(c.label, fontFamily = Mono) }
                }
            }
        }
        if (connected) IconButton(browser::refresh) { Icon(Icons.Outlined.Refresh, "Refresh") }
    }
}

@Composable
private fun EntryRow(e: SftpEntry, first: Boolean, last: Boolean, selectionMode: Boolean, isSelected: Boolean, onClick: () -> Unit, onLongClick: () -> Unit, onMore: () -> Unit) = ListItem(
    headlineContent = { Text(e.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    supportingContent = { Text(e.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant) },
    leadingContent = {
        if (selectionMode) Box(Modifier.size(36.dp), Alignment.Center) { Checkbox(isSelected, null) }
        else LeadingTile(iconFor(IconKeys.file(e)), roleColor(IconKeys.fileColor(e)))
    },
    trailingContent = { if (!selectionMode) IconButton(onMore) { Icon(Icons.Outlined.MoreVert, "Actions") } },
    colors = ListItemDefaults.colors(containerColor = if (isSelected) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent),
    modifier = Modifier.groupRow(first, last, MaterialTheme.colorScheme.surfaceContainer).combinedClickable(onLongClick = onLongClick, onClick = onClick),
)
