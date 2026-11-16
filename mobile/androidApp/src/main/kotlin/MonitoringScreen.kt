package dev.gnm.nexterm.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.InfoRow
import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.state.MonitoringController
import dev.gnm.nexterm.util.IconKeys
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.UsageLevel
import kotlinx.coroutines.launch

private val Green = Color(0xFF4CAF50)
private val Orange = Color(0xFFFF9800)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonitoringScreen(ctrl: MonitoringController) {
    val selected by ctrl.selected.watch()
    val servers by ctrl.servers.watch()
    val loading by ctrl.isLoading.watch()
    val error by ctrl.error.watch()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }
    DisposableEffect(ctrl) {
        ctrl.start()
        onDispose { ctrl.stop() }
    }
    val refresh: (suspend () -> Unit) -> Unit = { block -> scope.launch { refreshing = true; block(); refreshing = false } }
    ListDetail(selected != null, ctrl::clearSelection, {
        AppScreen("Monitoring", if (!loading && error == null && servers.isNotEmpty()) ctrl.reportingSummary() else null) { padding ->
            when {
                loading -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                error != null -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                    StateMessage(Icons.Outlined.ErrorOutline, "Something went wrong", error, isError = true) { scope.launch { ctrl.load(false) } }
                }
                else -> PullToRefreshBox(refreshing, { refresh { ctrl.load(true) } }, Modifier.padding(padding).fillMaxSize()) {
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp)) {
                        if (servers.isEmpty()) item { StateMessage(Icons.Outlined.BarChart, "No monitoring data", "Enable monitoring from the web dashboard") }
                        items(servers, key = { it.id }) { s -> ServerItem(s, s.id == selected?.id) { scope.launch { ctrl.select(s) } } }
                    }
                }
            }
        }
    }) { twoPane ->
        selected?.let { sel -> key(sel.id) { Details(ctrl, sel, refreshing, if (twoPane) null else { { ctrl.clearSelection() } }) { refresh { ctrl.select(sel) } } } }
            ?: DetailPlaceholder(Icons.Outlined.BarChart, "Select a server")
    }
}

@Composable
private fun usageColor(v: Double, base: Color) = when (Formatters.usageLevel(v)) {
    UsageLevel.CRITICAL -> MaterialTheme.colorScheme.error
    UsageLevel.WARNING -> Orange
    UsageLevel.NORMAL -> base
}

@Composable
private fun ServerItem(s: MonitoringServer, selected: Boolean, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    ListItem(
        headlineContent = { Text(s.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = {
            Column {
                s.ip?.let { Text(it) }
                if (s.hasData) Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    listOf("CPU" to (s.cpuUsage ?: 0.0), "MEM" to (s.memoryUsage ?: 0.0)).forEach { (label, v) -> Column(Modifier.weight(1f)) { UsageBar(label, v, cs.primary) } }
                } else s.errorMessage?.let { Text(it, Modifier.padding(top = 4.dp), cs.error, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
        },
        leadingContent = { Icon(iconFor(IconKeys.monitoringServer(s)), null, tint = if (s.hasError) cs.outline else if (s.isPve) cs.tertiary else cs.primary) },
        colors = if (selected) ListItemDefaults.colors(containerColor = cs.secondaryContainer) else ListItemDefaults.colors(),
        modifier = Modifier.clickable(onClick = onClick),
    )
}

@Composable
private fun UsageBar(label: String, v: Double, base: Color) {
    val color = usageColor(v, base)
    Row {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium)
        Text(Formatters.percent(v), style = MaterialTheme.typography.labelMedium, color = color)
    }
    LinearProgressIndicator({ Formatters.fraction(v).toFloat() }, Modifier.padding(top = 4.dp).fillMaxWidth(), color = color)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Details(ctrl: MonitoringController, s: MonitoringServer, refreshing: Boolean, onBack: (() -> Unit)?, onRefresh: () -> Unit) {
    val details by ctrl.details.watch()
    val loadingDetails by ctrl.isLoadingDetails.watch()
    val cs = MaterialTheme.colorScheme
    AppScreen(s.name, s.ip, onBack = onBack) { padding ->
        if (loadingDetails && details == null) Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        else PullToRefreshBox(refreshing, onRefresh, Modifier.padding(padding).fillMaxSize()) {
            val latest = details?.latest
            val nodes = latest?.osInfo?.nodes.orEmpty()
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
                item { SectionHeader(ctrl.infoTitle()) }
                items(ctrl.infoRows()) { InfoLine(it) }
                item {
                    SectionHeader("Performance")
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), Arrangement.spacedBy(4.dp)) {
                        UsageBar("CPU Usage", latest?.cpuUsage ?: 0.0, cs.primary)
                        Spacer(Modifier.height(8.dp))
                        UsageBar("Memory Usage", latest?.memoryUsage ?: 0.0, Green)
                    }
                }
                items(ctrl.performanceRows()) { InfoLine(it) }
                if (s.isPve && nodes.isNotEmpty()) item { SectionHeader("Nodes") }
                if (s.isPve) items(nodes) { n ->
                    ListItem(
                        headlineContent = { Text(n.name) },
                        leadingContent = { Icon(Icons.Outlined.Lan, null, tint = if (n.isOnline) cs.primary else cs.error) },
                        trailingContent = { Text(n.status, color = if (n.isOnline) Green else cs.error, style = MaterialTheme.typography.labelMedium) },
                        supportingContent = if (n.isOnline) { {
                            Column(Modifier.padding(top = 8.dp), Arrangement.spacedBy(4.dp)) {
                                UsageBar("CPU", n.cpuUsage ?: 0.0, cs.primary)
                                UsageBar("Memory", n.memoryUsage ?: 0.0, Green)
                                UsageBar("Storage", n.diskUsage ?: 0.0, Orange)
                            }
                        } } else null,
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoLine(row: InfoRow) = ListItem(headlineContent = { Text(row.label) }, trailingContent = { Text(row.value, style = MaterialTheme.typography.bodyMedium) })
