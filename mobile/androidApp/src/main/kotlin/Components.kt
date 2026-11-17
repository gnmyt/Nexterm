package dev.gnm.nexterm.app

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Laptop
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.*
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth
import androidx.window.core.layout.WindowSizeClass
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffold
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffoldRole
import androidx.compose.material3.adaptive.navigation.BackNavigationBehavior
import androidx.compose.material3.adaptive.navigation.rememberListDetailPaneScaffoldNavigator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.gnm.nexterm.Nexterm
import dev.gnm.nexterm.util.ColorRole
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

val nx: Nexterm get() = Nexterm.shared

@Composable
fun <T> StateFlow<T>.watch(): State<T> = collectAsStateWithLifecycle()

class Toaster(val host: SnackbarHostState, private val scope: CoroutineScope) {
    fun show(message: String, action: String? = null, onAction: () -> Unit = {}) {
        scope.launch {
            host.currentSnackbarData?.dismiss()
            if (host.showSnackbar(message, action) == SnackbarResult.ActionPerformed) onAction()
        }
    }
}

val LocalToaster = staticCompositionLocalOf<Toaster> { error("No Toaster") }

@Composable
fun AppSnackbar() = SnackbarHost(LocalToaster.current.host)

@Composable
fun <T : Any> rememberClosing(key: Any? = Unit, create: () -> T, close: (T) -> Unit): T {
    val value = remember(key) { create() }
    DisposableEffect(value) { onDispose { close(value) } }
    return value
}

@Composable
fun roleColor(role: ColorRole) = when (role) {
    ColorRole.PRIMARY -> MaterialTheme.colorScheme.primary
    ColorRole.TERTIARY -> MaterialTheme.colorScheme.tertiary
    ColorRole.OUTLINE -> MaterialTheme.colorScheme.outline
    ColorRole.ON_SURFACE_VARIANT -> MaterialTheme.colorScheme.onSurfaceVariant
    ColorRole.PINK -> Color(0xFFE91E63)
    ColorRole.PURPLE -> Color(0xFF9C27B0)
    ColorRole.ORANGE -> Color(0xFFFF9800)
    ColorRole.AMBER -> Color(0xFFFFC107)
    ColorRole.RED -> Color(0xFFF44336)
}

val MonoStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 17.sp)

val transparentListItem @Composable get() = ListItemDefaults.colors(containerColor = Color.Transparent)

@Composable
fun SheetHeader(icon: ImageVector, title: String, subtitle: String?, trailing: @Composable () -> Unit = {}) = ListItem(
    headlineContent = { Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1) },
    supportingContent = subtitle?.let { { Text(it, maxLines = 1) } },
    leadingContent = { Icon(icon, null, tint = MaterialTheme.colorScheme.primary) },
    trailingContent = trailing, colors = transparentListItem,
)

@Composable
fun SheetItem(icon: ImageVector, title: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(title, color = if (color == MaterialTheme.colorScheme.error) color else Color.Unspecified) },
    leadingContent = { Icon(icon, null, tint = color) },
    colors = transparentListItem, modifier = Modifier.clickable(onClick = onClick),
)

@Composable
fun StateMessage(icon: ImageVector, title: String, subtitle: String?, isError: Boolean = false, onRetry: (() -> Unit)? = null) =
    Column(Modifier.fillMaxWidth().padding(32.dp), Arrangement.spacedBy(8.dp), Alignment.CenterHorizontally) {
        Icon(icon, null, Modifier.size(48.dp), if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline)
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, textAlign = TextAlign.Center)
        if (onRetry != null) FilledTonalButton(onRetry, Modifier.padding(top = 8.dp)) { Text("Retry") }
    }

@Composable
fun ErrorBanner(text: String, onDismiss: (() -> Unit)? = null) = ListItem(
    headlineContent = { Text(text, style = MaterialTheme.typography.bodyMedium) },
    leadingContent = { Icon(Icons.Outlined.ErrorOutline, null) },
    trailingContent = onDismiss?.let { { IconButton(it) { Icon(Icons.Outlined.Close, "Dismiss") } } },
    colors = ListItemDefaults.colors(
        containerColor = MaterialTheme.colorScheme.errorContainer, headlineColor = MaterialTheme.colorScheme.onErrorContainer,
        leadingIconColor = MaterialTheme.colorScheme.onErrorContainer, trailingIconColor = MaterialTheme.colorScheme.onErrorContainer,
    ),
)

@Composable
fun ViewOnlyBanner(text: String, modifier: Modifier = Modifier) = ListItem(
    headlineContent = { Text(text, style = MaterialTheme.typography.bodySmall) },
    leadingContent = { Icon(Icons.Outlined.Visibility, null, Modifier.size(18.dp)) },
    modifier = modifier,
    colors = ListItemDefaults.colors(
        containerColor = MaterialTheme.colorScheme.secondaryContainer, headlineColor = MaterialTheme.colorScheme.onSecondaryContainer,
        leadingIconColor = MaterialTheme.colorScheme.onSecondaryContainer,
    ),
)

@Composable
fun SectionHeader(text: String) =
    Text(text, Modifier.padding(start = 16.dp, top = 24.dp, bottom = 8.dp), MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)

@Composable
fun ConfirmDialog(title: String, text: String, confirm: String, destructive: Boolean = false, onDismiss: () -> Unit, onConfirm: () -> Unit) =
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text(title) }, text = { Text(text) },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
        confirmButton = {
            TextButton(
                { onDismiss(); onConfirm() },
                colors = if (destructive) ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error) else ButtonDefaults.textButtonColors(),
            ) { Text(confirm) }
        },
    )

@Composable
fun TextInputDialog(title: String, label: String, initial: String = "", confirm: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var text by remember { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text(title) },
        text = { OutlinedTextField(text, { text = it }, Modifier.focusRequester(focus), label = { Text(label) }, singleLine = true) },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
        confirmButton = { TextButton({ onDismiss(); onConfirm(text.trim()) }) { Text(confirm) } },
    )
    LaunchedEffect(Unit) { focus.requestFocus() }
}

@Composable
fun DisconnectedOverlay(onReconnect: () -> Unit) =
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)), contentAlignment = Alignment.Center) {
        ElevatedCard { Column(Modifier.padding(24.dp), Arrangement.spacedBy(8.dp), Alignment.CenterHorizontally) {
            Text("Disconnected", style = MaterialTheme.typography.titleMedium)
            Text("The connection to the server was lost.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onReconnect, Modifier.padding(top = 8.dp)) { Text("Reconnect") }
        } }
    }

@Composable
fun ConnectionLoader(visible: Boolean, background: Color = Color.Black) = AnimatedVisibility(visible, exit = fadeOut()) {
    val dots = rememberInfiniteTransition("dots")
    val tint = if (background.luminance() < 0.5f) Color.White.copy(alpha = 0.5f) else Color.Black.copy(alpha = 0.4f)
    Column(Modifier.fillMaxSize().background(background)) {
        LinearProgressIndicator(Modifier.fillMaxWidth())
        Row(Modifier.fillMaxSize(), Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), Alignment.CenterVertically) {
            Icon(Icons.Outlined.Laptop, null, Modifier.padding(end = 14.dp).size(36.dp), tint)
            repeat(3) { i ->
                val a by dots.animateFloat(0.15f, 1f, infiniteRepeatable(tween(750, delayMillis = i * 200), RepeatMode.Reverse), "dot$i")
                Badge(Modifier.alpha(a), MaterialTheme.colorScheme.primary)
            }
            Icon(Icons.Outlined.Dns, null, Modifier.padding(start = 14.dp).size(36.dp), tint)
        }
    }
}

private fun Color.luminance() = 0.299f * red + 0.587f * green + 0.114f * blue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScreen(
    title: String, subtitle: String? = null, onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}, header: @Composable () -> Unit = {}, content: @Composable (PaddingValues) -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        Modifier.nestedScroll(scroll.nestedScrollConnection),
        topBar = {
            Column {
                LargeTopAppBar(
                    {
                        Column {
                            Text(title, maxLines = 1)
                            subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) }
                        }
                    },
                    actions = actions, scrollBehavior = scroll,
                    navigationIcon = { onBack?.let { IconButton(it) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } } },
                )
                header()
            }
        },
        content = content,
    )
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun ListDetail(showDetail: Boolean, onBack: () -> Unit, list: @Composable (twoPane: Boolean) -> Unit, detail: @Composable (twoPane: Boolean) -> Unit) {
    val info = currentWindowAdaptiveInfo()
    val directive = calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth(info)
    val nav = rememberListDetailPaneScaffoldNavigator<Nothing>(
        if (info.windowSizeClass.isHeightAtLeastBreakpoint(WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND)) directive else directive.copy(maxHorizontalPartitions = 1),
    )
    val twoPane = nav.scaffoldDirective.maxHorizontalPartitions > 1
    LaunchedEffect(showDetail) { if (showDetail) nav.navigateTo(ListDetailPaneScaffoldRole.Detail) else if (nav.canNavigateBack(BackNavigationBehavior.PopLatest)) nav.navigateBack(BackNavigationBehavior.PopLatest) }
    BackHandler(showDetail, onBack)
    ListDetailPaneScaffold(nav.scaffoldDirective, nav.scaffoldValue, { AnimatedPane { list(twoPane) } }, { AnimatedPane { detail(twoPane) } })
}

@Composable
fun DetailPlaceholder(icon: ImageVector, title: String) = Box(Modifier.fillMaxSize(), Alignment.Center) { StateMessage(icon, title, null) }
