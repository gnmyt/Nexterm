package dev.gnm.nexterm.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.toClipEntry
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.terminal.TerminalCanvas
import dev.gnm.nexterm.terminal.TerminalController
import kotlinx.coroutines.launch

@Composable
fun TerminalSurface(controller: TerminalController, onTap: () -> Unit, modifier: Modifier = Modifier) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    Box(modifier) {
        TerminalCanvas(controller, Modifier.matchParentSize(), onTap = onTap)
        if (controller.hasSelection) ExtendedFloatingActionButton(
            onClick = {
                controller.copySelection()?.let { scope.launch { clipboard.setClipEntry(android.content.ClipData.newPlainText("terminal", it).toClipEntry()) } }
            },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            icon = { Icon(Icons.Outlined.ContentCopy, null) }, text = { Text("Copy") },
        )
    }
}
