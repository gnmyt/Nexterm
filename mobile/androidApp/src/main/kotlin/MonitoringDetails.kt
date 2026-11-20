package dev.gnm.nexterm.app

import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.gnm.nexterm.model.ChartSeries
import dev.gnm.nexterm.model.DiskRow
import dev.gnm.nexterm.model.FilesystemRow
import dev.gnm.nexterm.model.HealthStatus
import dev.gnm.nexterm.model.InfoRow
import dev.gnm.nexterm.model.InterfaceRow
import dev.gnm.nexterm.model.MemoryOverview
import dev.gnm.nexterm.model.MonitoringDetails
import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.model.MonitoringSnapshot
import dev.gnm.nexterm.model.NetworkOverview
import dev.gnm.nexterm.model.ProcessEntry
import dev.gnm.nexterm.model.ProcessSort
import dev.gnm.nexterm.model.PveNode
import dev.gnm.nexterm.model.StorageOverview
import dev.gnm.nexterm.model.TimeRange
import dev.gnm.nexterm.state.MonitoringController
import dev.gnm.nexterm.util.Formatters
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private enum class DetailTab(val label: String) { OVERVIEW("Overview"), STORAGE("Storage"), NETWORK("Network"), PROCESSES("Processes"), NODES("Nodes") }

private val TimeFormat = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonitoringDetails(ctrl: MonitoringController, server: MonitoringServer, onBack: (() -> Unit)?) {
    val details by ctrl.details.watch()
    val failed by ctrl.detailsFailed.watch()
    val range by ctrl.timeRange.watch()
    val scope = rememberCoroutineScope()
    val tabs = if (server.isPve) listOf(DetailTab.OVERVIEW, DetailTab.NODES) else listOf(DetailTab.OVERVIEW, DetailTab.STORAGE, DetailTab.NETWORK, DetailTab.PROCESSES)
    var tab by rememberSaveable { mutableStateOf(DetailTab.OVERVIEW) }
    var refreshing by remember { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var sort by rememberSaveable { mutableStateOf(ProcessSort.CPU) }
    var showVirtual by rememberSaveable { mutableStateOf(false) }

    AppScreen(
        server.name, server.address, onBack = onBack,
        actions = { StatusPill(server.state.label, stateColor(server.state), Modifier.padding(end = 12.dp)) },
        header = {
            PrimaryTabRow(tabs.indexOf(tab)) {
                tabs.forEach { item -> Tab(item == tab, { tab = item }, text = { Text(item.label, maxLines = 1) }) }
            }
        },
    ) { padding ->
        PullToRefreshBox(refreshing, { scope.launch { refreshing = true; ctrl.refreshDetails(); refreshing = false } }, Modifier.padding(padding).fillMaxSize()) {
            val latest = details?.latest
            LazyColumn(Modifier.fillMaxSize(), remember(tab) { LazyListState() }, PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!server.isOnline) item { Panel { IssueBlock(server) } }
                when {
                    details == null || latest == null -> item {
                        if (failed) StateMessage(Icons.Outlined.ErrorOutline, "Failed to load monitoring data", "Check your connection and try again.", isError = true) { scope.launch { ctrl.refreshDetails() } }
                        else Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) { CircularProgressIndicator() }
                    }
                    tab == DetailTab.NODES -> nodes(latest.osInfo?.nodes.orEmpty())
                    tab == DetailTab.STORAGE -> storage(latest.storage)
                    tab == DetailTab.NETWORK -> network(latest.networking, showVirtual) { showVirtual = !showVirtual }
                    tab == DetailTab.PROCESSES -> processes(latest, query, { query = it }, sort) { sort = it }
                    else -> overview(server, details!!, latest, range) { scope.launch { ctrl.setTimeRange(it) } }
                }
            }
        }
    }
}

@Composable
private fun Panel(modifier: Modifier = Modifier, spacing: Int = 12, content: @Composable ColumnScope.() -> Unit) =
    HairlineCard(modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), Arrangement.spacedBy(spacing.dp), content = content) }

@Composable
private fun Heading(title: String, count: Int? = null, trailing: @Composable () -> Unit = {}) =
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), Arrangement.spacedBy(8.dp), Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        count?.let { TagLabel("$it") }
        Spacer(Modifier.weight(1f))
        trailing()
    }

@Composable
private fun Muted(text: String, modifier: Modifier = Modifier, mono: Boolean = false) = Text(
    text, modifier, MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall,
    fontFamily = if (mono) Mono else null, maxLines = 1, overflow = TextOverflow.Ellipsis,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FactFlow(facts: List<InfoRow>, large: Boolean = false) = FlowRow(
    Modifier.fillMaxWidth(), Arrangement.spacedBy(24.dp), Arrangement.spacedBy(12.dp), maxItemsInEachRow = if (large) 2 else Int.MAX_VALUE,
) {
    facts.forEach { fact ->
        Column(if (large) Modifier.weight(1f) else Modifier) {
            Text(fact.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                fact.value, style = if (large) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleSmall, fontFamily = if (large) Mono else null,
                color = if (fact.alert) nxc.warning else Color.Unspecified, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            fact.detail?.let { Muted(it) }
        }
    }
}

@Composable
private fun InfoList(rows: List<InfoRow>) = Column {
    rows.forEachIndexed { i, row ->
        if (i > 0) HorizontalDivider(color = nxc.border)
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), Arrangement.spacedBy(16.dp)) {
            Text(row.label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(row.value, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, textAlign = androidx.compose.ui.text.style.TextAlign.End)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
private fun LazyListScope.overview(server: MonitoringServer, details: MonitoringDetails, latest: MonitoringSnapshot, range: TimeRange, onRange: (TimeRange) -> Unit) {
    item { Panel { FactFlow(if (server.isPve) latest.clusterFacts else latest.overviewFacts, large = true) } }
    latest.memoryOverview?.let { memory -> item { Memory(memory) } }
    item {
        Heading("Performance") {
            SingleChoiceSegmentedButtonRow {
                TimeRange.entries.forEachIndexed { i, item ->
                    SegmentedButton(item == range, { onRange(item) }, SegmentedButtonDefaults.itemShape(i, TimeRange.entries.size), icon = {}) { Text(item.label) }
                }
            }
        }
    }
    items(details.charts(server.isPve), key = { it.title }) { series -> ChartPanel(series) }
    item { Heading(if (server.isPve) "Cluster Information" else "System Information") }
    item { Panel(spacing = 0) { InfoList(if (server.isPve) latest.clusterInfo else latest.systemInfo) } }
}

@Composable
private fun memoryColor(shade: Int, percent: Double) = when (shade) {
    0 -> usageColor(percent)
    1 -> usageColor(percent).copy(alpha = 0.36f)
    else -> nxc.fill
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Memory(memory: MemoryOverview) = Panel {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Memory", style = MaterialTheme.typography.titleSmall)
        Muted(memory.usedText, Modifier.weight(1f))
        Text(Formatters.wholePercent(memory.percent), style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
    }
    Row(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape)) {
        memory.segments.filter { it.weight > 0 }.forEach {
            Box(Modifier.weight(it.weight.toFloat()).fillMaxHeight().background(memoryColor(it.shade, memory.percent)))
        }
    }
    FlowRow(Modifier.fillMaxWidth(), Arrangement.spacedBy(16.dp), Arrangement.spacedBy(6.dp)) {
        memory.segments.forEach { segment ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).background(memoryColor(segment.shade, memory.percent), RoundedCornerShape(3.dp)))
                Muted(segment.label)
                Text(segment.sizeText, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun ChartPanel(series: ChartSeries) = Panel {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(series.title, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
        series.latest?.let { Text(it, style = MaterialTheme.typography.titleMedium, fontFamily = Mono) }
    }
    if (series.points.size < 2) Box(Modifier.fillMaxWidth().height(140.dp), Alignment.Center) { Muted("No data available for the selected time range") }
    else LineChart(series, Modifier.fillMaxWidth().height(160.dp))
}

@Composable
private fun LineChart(series: ChartSeries, modifier: Modifier) {
    val cs = MaterialTheme.colorScheme
    val measurer = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelSmall.merge(TextStyle(color = cs.onSurfaceVariant))
    Canvas(modifier) {
        val points = series.points
        val top = series.top
        val left = 36.dp.toPx()
        val bottom = size.height - 20.dp.toPx()
        val width = size.width - left
        val steps = 4
        for (step in 0..steps) {
            val y = bottom - bottom * step / steps + 1
            drawLine(cs.outlineVariant, Offset(left, y), Offset(size.width, y), 1f)
            val label = measurer.measure("${Formatters.number(top * step / steps)}${series.unit}", labelStyle)
            drawText(label, topLeft = Offset(left - label.size.width - 6.dp.toPx(), (y - label.size.height / 2).coerceAtLeast(0f)))
        }
        val start = points.first().time
        val span = (points.last().time - start).coerceAtLeast(1)
        val line = Path()
        points.forEachIndexed { i, point ->
            val x = left + width * (point.time - start) / span
            val y = bottom - (point.value.coerceIn(0.0, top) / top).toFloat() * (bottom - 4.dp.toPx())
            if (i == 0) line.moveTo(x, y) else line.lineTo(x, y)
        }
        val area = Path().apply { addPath(line); lineTo(size.width, bottom); lineTo(left, bottom); close() }
        drawPath(area, Brush.verticalGradient(listOf(cs.primary.copy(alpha = 0.3f), Color.Transparent), endY = bottom))
        drawPath(line, cs.primary, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        listOf(0f, 0.5f, 1f).forEach { fraction ->
            val label = measurer.measure(TimeFormat.format(Instant.ofEpochMilli(start + (span * fraction).toLong())), labelStyle)
            drawText(label, topLeft = Offset((left + width * fraction - label.size.width * fraction).coerceAtLeast(left), bottom + 6.dp.toPx()))
        }
    }
}

private fun LazyListScope.nodes(nodes: List<PveNode>) {
    if (nodes.isEmpty()) item { StateMessage(Icons.Outlined.Lan, "No nodes available", null) }
    items(nodes, key = { it.name }) { node ->
        Panel {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(node.name, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                StatusPill(if (node.isOnline) "Online" else "Offline", if (node.isOnline) nxc.success else MaterialTheme.colorScheme.error)
            }
            if (node.isOnline) {
                node.usage.forEach { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(row.label, style = MaterialTheme.typography.titleSmall)
                            row.detail?.let { Muted(it, Modifier.weight(1f)) } ?: Spacer(Modifier.weight(1f))
                            Text(Formatters.wholePercent(row.percent), style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
                        }
                        Meter(row.percent)
                    }
                }
                HorizontalDivider(color = nxc.border)
                FactFlow(node.info)
            } else Muted("This node is currently offline")
        }
    }
}

private fun LazyListScope.storage(storage: StorageOverview?) {
    if (storage == null) return item { StateMessage(Icons.Outlined.Storage, "No disk usage data available", null) }
    storage.failing?.let { message ->
        item {
            Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.errorContainer, contentColor = MaterialTheme.colorScheme.onErrorContainer) {
                Row(Modifier.fillMaxWidth().padding(16.dp), Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = nxc.error)
                    Column { Text("Disk failure predicted", style = MaterialTheme.typography.titleSmall); Text(message, style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
    }
    storage.percent?.let { percent ->
        item {
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(Formatters.wholePercent(percent), style = MaterialTheme.typography.displaySmall, fontFamily = Mono)
                    Column { Text(storage.usedText, style = MaterialTheme.typography.titleSmall); Muted(storage.freeText) }
                }
                Meter(percent, height = 8.dp)
            }
        }
    }
    item { Heading("Filesystems", storage.filesystems.size) }
    if (storage.filesystems.isEmpty()) item { Panel { Muted("No mounted partitions") } }
    else item { Panel(spacing = 0) { storage.filesystems.forEachIndexed { i, row -> if (i > 0) HorizontalDivider(Modifier.padding(vertical = 14.dp), color = nxc.border); Filesystem(row) } } }
    item { Heading("Disks", storage.disks.size) }
    items(storage.disks, key = { it.name }) { disk -> Disk(disk) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Filesystem(row: FilesystemRow) = Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    FlowRow(Modifier.fillMaxWidth(), Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(row.mountPoint, style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
        row.tags.forEach { TagLabel(it) }
        Spacer(Modifier.weight(1f))
        Text(Formatters.wholePercent(row.percent), style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
    }
    Meter(row.percent)
    Row { Muted(row.usedText, Modifier.weight(1f)); Muted(row.freeText) }
    Muted(row.source, mono = true)
    row.inodesPercent?.let { percent ->
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Muted("Inodes")
            Meter(percent, Modifier.width(72.dp), height = 4.dp)
            Muted(row.inodesText.orEmpty())
        }
    }
}

@Composable
private fun segmentColor(shade: Int) = when (shade) {
    0 -> MaterialTheme.colorScheme.primary
    1 -> MaterialTheme.colorScheme.primary.copy(alpha = 0.62f)
    2 -> MaterialTheme.colorScheme.primary.copy(alpha = 0.36f)
    else -> nxc.fill
}

@Composable
private fun healthColor(status: HealthStatus) = when (status) {
    HealthStatus.PASSED -> nxc.success
    HealthStatus.WARNING -> nxc.warning
    HealthStatus.FAILED -> nxc.error
    HealthStatus.DENIED -> nxc.subtext
}

@Composable
private fun Disk(disk: DiskRow) = Panel {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(disk.name, style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
        disk.kind?.let { TagLabel(it) }
        Spacer(Modifier.weight(1f))
        Text(disk.sizeText, style = MaterialTheme.typography.titleSmall, fontFamily = Mono)
    }
    if (disk.model != null || disk.health != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Muted(disk.model.orEmpty(), Modifier.weight(1f))
        disk.health?.let { StatusPill(it.label, healthColor(it)) }
    }
    Row(Modifier.fillMaxWidth().height(12.dp), Arrangement.spacedBy(2.dp)) {
        disk.segments.forEach { Box(Modifier.weight(it.weight.toFloat().coerceAtLeast(0.0001f)).widthIn(min = 6.dp).fillMaxHeight().background(segmentColor(it.shade), RoundedCornerShape(3.dp))) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        disk.segments.forEach { segment ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(10.dp).background(segmentColor(segment.shade), RoundedCornerShape(3.dp)))
                Text(segment.name, style = MaterialTheme.typography.bodySmall, fontFamily = if (segment.isFree) null else Mono)
                Muted(segment.usage, Modifier.weight(1f), mono = true)
                Muted(segment.sizeText)
            }
        }
    }
    if (disk.facts.isNotEmpty()) {
        HorizontalDivider(color = nxc.border)
        FactFlow(disk.facts)
    }
}

private fun LazyListScope.network(network: NetworkOverview?, showVirtual: Boolean, onToggleVirtual: () -> Unit) {
    if (network == null) return item { StateMessage(Icons.Outlined.Lan, "No network interface data available", null) }
    network.summary?.let { summary ->
        item {
            Panel {
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    listOf(Triple(Icons.Outlined.ArrowDownward, "Download", summary.download), Triple(Icons.Outlined.ArrowUpward, "Upload", summary.upload)).forEach { (icon, label, value) ->
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(icon, null, Modifier.size(14.dp), MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(value, style = MaterialTheme.typography.headlineSmall, fontFamily = Mono, maxLines = 1)
                        }
                    }
                }
                HorizontalDivider(color = nxc.border)
                FactFlow(summary.facts)
            }
        }
    }
    if (network.interfaces.isNotEmpty()) {
        item { Heading("Interfaces", network.interfaces.size) }
        item { Panel(spacing = 0) { network.interfaces.forEachIndexed { i, row -> if (i > 0) HorizontalDivider(Modifier.padding(vertical = 14.dp), color = nxc.border); Interface(row) } } }
    }
    if (network.virtualInterfaces.isNotEmpty()) {
        item {
            val rotation by animateFloatAsState(if (showVirtual) 180f else 0f, label = "chevron")
            Box(Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onToggleVirtual)) {
                Heading("Virtual interfaces", network.virtualInterfaces.size) { Icon(Icons.Outlined.ExpandMore, if (showVirtual) "Collapse" else "Expand", Modifier.rotate(rotation)) }
            }
        }
        if (showVirtual) item { Panel(spacing = 0) { network.virtualInterfaces.forEachIndexed { i, row -> if (i > 0) HorizontalDivider(Modifier.padding(vertical = 10.dp), color = nxc.border); CompactInterface(row) } } }
    }
}

@Composable
private fun Rate(download: Boolean, value: String, total: String? = null, modifier: Modifier = Modifier) =
    Row(modifier, Arrangement.spacedBy(4.dp), Alignment.CenterVertically) {
        Icon(if (download) Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward, if (download) "Download" else "Upload", Modifier.size(14.dp), MaterialTheme.colorScheme.onSurfaceVariant)
        Column {
            Text(value, style = MaterialTheme.typography.bodyMedium, fontFamily = Mono, maxLines = 1)
            total?.let { Muted(it) }
        }
    }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Interface(row: InterfaceRow) = Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    val context = LocalContext.current
    val toaster = LocalToaster.current
    FlowRow(Modifier.fillMaxWidth(), Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(row.name, style = MaterialTheme.typography.titleSmall, fontFamily = Mono, color = if (row.isUp) Color.Unspecified else MaterialTheme.colorScheme.onSurfaceVariant)
        if (row.isDefault) TagLabel("Default route", accent = true)
        row.kind?.let { TagLabel(it) }
        Spacer(Modifier.weight(1f))
        row.stateLabel?.let { StatusPill(it, if (row.isUp) nxc.success else nxc.subtext) }
    }
    if (row.addresses.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        row.addresses.forEach { address ->
            val cs = MaterialTheme.colorScheme
            Row(
                Modifier.clip(RoundedCornerShape(6.dp)).background(if (address.muted) nxc.fill else nxc.accentFill)
                    .clickable {
                        context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("address", address.value))
                        toaster.show("Copied ${address.value}")
                    }.padding(horizontal = 8.dp, vertical = 4.dp),
                Arrangement.spacedBy(6.dp), Alignment.CenterVertically,
            ) {
                val color = if (address.muted) cs.onSurfaceVariant else cs.primary
                Text(address.text, Modifier.weight(1f, fill = false), color, style = MaterialTheme.typography.labelMedium, fontFamily = Mono, maxLines = 1, overflow = TextOverflow.MiddleEllipsis)
                Icon(Icons.Outlined.ContentCopy, "Copy", Modifier.size(12.dp), color)
            }
        }
    }
    Row {
        Rate(true, row.download, row.downloadTotal, Modifier.weight(1f))
        Rate(false, row.upload, row.uploadTotal, Modifier.weight(1f))
    }
    if (row.meta.isNotEmpty()) Muted(row.meta.joinToString(" · "))
    row.problems.forEach { Text(it.value, style = MaterialTheme.typography.bodySmall, color = if (it.alert) nxc.warning else MaterialTheme.colorScheme.onSurfaceVariant) }
}

@Composable
private fun CompactInterface(row: InterfaceRow) = Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Box(Modifier.size(8.dp).background(if (row.isUp) nxc.success else nxc.subtext, CircleShape))
    Column(Modifier.weight(1f)) {
        Text(row.name, style = MaterialTheme.typography.bodyMedium, fontFamily = Mono, maxLines = 1, overflow = TextOverflow.Ellipsis)
        row.primaryAddress?.let { Muted(it, mono = true) }
    }
    Rate(true, row.download)
    Rate(false, row.upload)
}

@OptIn(ExperimentalMaterial3Api::class)
private fun LazyListScope.processes(latest: MonitoringSnapshot, query: String, onQuery: (String) -> Unit, sort: ProcessSort, onSort: (ProcessSort) -> Unit) {
    if (!latest.hasProcesses) return item { StateMessage(Icons.Outlined.Terminal, "No process data available", "Process data will appear after the next monitoring cycle.") }
    val processes = latest.processes(query, sort)
    item {
        OutlinedTextField(
            query, onQuery, Modifier.fillMaxWidth().focusOnTapOnly(), placeholder = { Text("Search processes...") }, singleLine = true, shape = RoundedCornerShape(28.dp),
            leadingIcon = { Icon(Icons.Outlined.Search, null) },
            trailingIcon = { if (query.isNotEmpty()) IconButton({ onQuery("") }) { Icon(Icons.Outlined.Close, "Clear") } },
        )
    }
    item {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Muted("Showing ${processes.size} of ${latest.processCount} processes", Modifier.weight(1f))
            SingleChoiceSegmentedButtonRow {
                ProcessSort.entries.forEachIndexed { i, item ->
                    SegmentedButton(item == sort, { onSort(item) }, SegmentedButtonDefaults.itemShape(i, ProcessSort.entries.size), icon = {}) { Text(item.label) }
                }
            }
        }
    }
    if (processes.isEmpty()) item { StateMessage(Icons.Outlined.Search, "No processes match your search", null) }
    else item {
        Panel(spacing = 0) {
            ProcessRow { Muted("Command"); Muted("CPU"); Muted("Memory") }
            processes.forEach { process ->
                HorizontalDivider(Modifier.padding(vertical = 10.dp), color = nxc.border)
                ProcessRow {
                    Column {
                        Text(process.command, style = MaterialTheme.typography.bodySmall, fontFamily = Mono, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Muted(process.meta)
                    }
                    Text(process.cpuText, style = MaterialTheme.typography.bodyMedium, fontFamily = Mono, color = if (sort == ProcessSort.CPU) MaterialTheme.colorScheme.primary else Color.Unspecified)
                    Text(process.memText, style = MaterialTheme.typography.bodyMedium, fontFamily = Mono, color = if (sort == ProcessSort.MEMORY) MaterialTheme.colorScheme.primary else Color.Unspecified)
                }
            }
        }
    }
}

@Composable
private fun ProcessRow(cells: @Composable () -> Unit) = androidx.compose.ui.layout.Layout(cells) { measurables, constraints ->
    val column = 64.dp.roundToPx()
    val stats = measurables.drop(1).map { it.measure(constraints.copy(minWidth = 0, maxWidth = column)) }
    val main = measurables.first().measure(constraints.copy(minWidth = 0, maxWidth = (constraints.maxWidth - column * stats.size - 12.dp.roundToPx()).coerceAtLeast(0)))
    val height = maxOf(main.height, stats.maxOfOrNull { it.height } ?: 0)
    layout(constraints.maxWidth, height) {
        main.placeRelative(0, (height - main.height) / 2)
        stats.forEachIndexed { i, cell -> cell.placeRelative(constraints.maxWidth - column * (stats.size - i - 1) - cell.width, (height - cell.height) / 2) }
    }
}
