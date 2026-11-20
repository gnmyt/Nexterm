package dev.gnm.nexterm.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.InfoRow
import dev.gnm.nexterm.model.MonitoringFilter
import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.model.MonitoringState
import dev.gnm.nexterm.state.MonitoringController
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.IconKeys
import dev.gnm.nexterm.util.UsageLevel
import kotlinx.coroutines.launch

@Composable
fun usageColor(percent: Double) = when (Formatters.usageLevel(percent)) {
    UsageLevel.CRITICAL -> nxc.error
    UsageLevel.WARNING -> nxc.warning
    UsageLevel.NORMAL -> MaterialTheme.colorScheme.primary
}

@Composable
fun stateColor(state: MonitoringState) = when (state) {
    MonitoringState.ONLINE -> nxc.success
    MonitoringState.OFFLINE -> nxc.error
    MonitoringState.ERROR -> nxc.warning
    MonitoringState.PENDING, MonitoringState.UNKNOWN -> nxc.subtext
}

fun stateIcon(state: MonitoringState): ImageVector = when (state) {
    MonitoringState.OFFLINE -> Icons.Outlined.CloudOff
    MonitoringState.ERROR -> Icons.Outlined.ErrorOutline
    MonitoringState.PENDING -> Icons.Outlined.Schedule
    else -> Icons.Outlined.HelpOutline
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonitoringScreen(ctrl: MonitoringController) {
    val selected by ctrl.selected.watch()
    val servers by ctrl.servers.watch()
    val visible by ctrl.visibleServers.watch()
    val loading by ctrl.isLoading.watch()
    val error by ctrl.error.watch()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }
    DisposableEffect(ctrl) {
        ctrl.start()
        onDispose { ctrl.stop() }
    }
    ListDetail(selected != null, ctrl::clearSelection, {
        AppScreen(
            "Monitoring", if (servers.isNotEmpty()) remember(servers) { ctrl.reportingSummary() } else null,
            header = { if (servers.isNotEmpty()) Filters(ctrl, servers) },
        ) { padding ->
            when {
                loading && servers.isEmpty() -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                error != null && servers.isEmpty() -> Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                    StateMessage(Icons.Outlined.ErrorOutline, "Failed to load monitoring data", error, isError = true) { scope.launch { ctrl.load(false) } }
                }
                else -> PullToRefreshBox(refreshing, { scope.launch { refreshing = true; ctrl.load(true); refreshing = false } }, Modifier.padding(padding).fillMaxSize()) {
                    LazyVerticalGrid(
                        GridCells.Adaptive(300.dp), Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (servers.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                            StateMessage(Icons.Outlined.BarChart, "No monitoring data", "Enable monitoring from the web dashboard")
                        } else if (visible.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                            StateMessage(Icons.Outlined.Search, "No matching servers", "No monitored server matches your search.")
                        }
                        items(visible, key = { it.id }) { server -> ServerCard(server, server.id == selected?.id) { scope.launch { ctrl.select(server) } } }
                    }
                }
            }
        }
    }) { twoPane ->
        selected?.let { server -> key(server.id) { MonitoringDetails(ctrl, server, if (twoPane) null else { { ctrl.clearSelection() } }) } }
            ?: DetailPlaceholder(Icons.Outlined.BarChart, "Select a server")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Filters(ctrl: MonitoringController, servers: List<MonitoringServer>) {
    val query by ctrl.query.watch()
    val filter by ctrl.filter.watch()
    SearchBar(
        inputField = {
            SearchBarDefaults.InputField(
                query, ctrl::setQuery, {}, expanded = false, onExpandedChange = {}, placeholder = { Text("Search servers...") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                trailingIcon = { if (query.isNotEmpty()) IconButton({ ctrl.setQuery("") }) { Icon(Icons.Outlined.Close, "Clear") } },
            )
        },
        expanded = false, onExpandedChange = {}, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).focusOnTapOnly(), windowInsets = WindowInsets(0),
        colors = SearchBarDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {}
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(MonitoringFilter.entries) { item -> FilterChip(item == filter, { ctrl.setFilter(item) }, { Text(remember(servers, item) { ctrl.filterLabel(item) }) }) }
    }
}

@Composable
private fun ServerCard(server: MonitoringServer, selected: Boolean, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    HairlineCard(onClick = onClick, selected = selected) {
        Column(Modifier.padding(16.dp), Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LeadingTile(iconFor(IconKeys.monitoringServer(server)), if (!server.isOnline) cs.onSurfaceVariant else if (server.isPve) nxc.proxmox else cs.primary)
                Column(Modifier.weight(1f)) {
                    Text(server.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(server.address, style = MonoStyle, color = cs.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                StatusPill(server.state.label, stateColor(server.state))
            }
            if (server.isOnline) {
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    UsageMetric("CPU", server.cpuUsage, server.cpuHistory, Modifier.weight(1f))
                    UsageMetric("Memory", server.memoryUsage, server.memoryHistory, Modifier.weight(1f))
                }
                HorizontalDivider(color = nxc.border)
                FactRow(server.facts)
            } else IssueBlock(server)
        }
    }
}

@Composable
private fun UsageMetric(label: String, value: Double?, history: List<Double>, modifier: Modifier) = Column(modifier, Arrangement.spacedBy(6.dp)) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(Formatters.wholePercent(value), style = MaterialTheme.typography.titleLarge, fontFamily = Mono)
    }
    Sparkline(history, usageColor(value ?: 0.0), Modifier.fillMaxWidth().height(36.dp))
}

@Composable
fun Sparkline(values: List<Double>, color: Color, modifier: Modifier, max: Double = 100.0) = Canvas(modifier) {
    if (values.size < 2) return@Canvas
    val top = maxOf(max, values.max()).coerceAtLeast(1.0)
    val inset = 2.dp.toPx()
    val line = Path()
    values.forEachIndexed { i, value ->
        val x = size.width * i / (values.size - 1)
        val y = size.height - inset - (value.coerceAtLeast(0.0) / top).toFloat() * (size.height - inset * 2)
        if (i == 0) line.moveTo(x, y) else line.lineTo(x, y)
    }
    val area = Path().apply { addPath(line); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
    drawPath(area, Brush.verticalGradient(listOf(color.copy(alpha = 0.28f), Color.Transparent)))
    drawPath(line, color, style = Stroke(1.75.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
}

@Composable
fun FactRow(facts: List<InfoRow>) = Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    facts.forEach { fact ->
        Column(Modifier.weight(1f)) {
            Text(fact.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(fact.value, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun IssueBlock(server: MonitoringServer) = Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    LeadingTile(stateIcon(server.state), stateColor(server.state))
    Column(Modifier.weight(1f), Arrangement.spacedBy(2.dp)) {
        Text(server.state.title, style = MaterialTheme.typography.titleSmall)
        Text(server.issueMessage, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
        server.issueMeta?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
fun TagLabel(text: String, accent: Boolean = false) = Text(
    text, Modifier.clip(RoundedCornerShape(6.dp)).background(if (accent) nxc.accentFill else nxc.fill).padding(horizontal = 6.dp, vertical = 2.dp),
    if (accent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, maxLines = 1,
)

@Composable
fun Meter(percent: Double, modifier: Modifier = Modifier, height: Dp = 6.dp, color: Color = usageColor(percent)) = LinearProgressIndicator(
    { Formatters.fraction(percent).toFloat() }, modifier.fillMaxWidth().height(height), color = color,
    trackColor = nxc.fill, strokeCap = StrokeCap.Round, gapSize = 0.dp, drawStopIndicator = {},
)
