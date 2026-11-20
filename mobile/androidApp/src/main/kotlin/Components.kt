package dev.gnm.nexterm.app

import android.view.HapticFeedbackConstants
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.GppMaybe
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.RemoveModerator
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Laptop
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Keyboard
import androidx.compose.material.icons.outlined.KeyboardHide
import androidx.compose.material3.*
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
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
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.gnm.nexterm.Nexterm
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.TrustChallenge
import dev.gnm.nexterm.model.Tag
import dev.gnm.nexterm.util.ColorRole
import dev.gnm.nexterm.util.IconKeys
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

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
fun AppSnackbar(modifier: Modifier = Modifier) = SnackbarHost(LocalToaster.current.host, modifier)

@Composable
fun <T : Any> rememberClosing(key: Any? = Unit, create: () -> T, close: (T) -> Unit): T {
    val value = remember(key) { create() }
    DisposableEffect(value) { onDispose { close(value) } }
    return value
}

@Composable
fun roleColor(role: ColorRole) = when (role) {
    ColorRole.PRIMARY -> MaterialTheme.colorScheme.primary
    ColorRole.TERTIARY -> nxc.proxmox
    ColorRole.OUTLINE, ColorRole.ON_SURFACE_VARIANT -> MaterialTheme.colorScheme.onSurfaceVariant
    ColorRole.PINK -> nxc.pink
    ColorRole.PURPLE -> nxc.violet
    ColorRole.ORANGE, ColorRole.AMBER -> nxc.warning
    ColorRole.RED -> nxc.error
}

@Composable
fun tagColor(tag: Tag) = tag.colorArgb?.let { Color(it) } ?: MaterialTheme.colorScheme.primary

val Mono = FontFamily.Monospace
val MonoStyle = TextStyle(fontFamily = Mono, fontSize = 12.sp, lineHeight = 17.sp)

val transparentListItem @Composable get() = ListItemDefaults.colors(containerColor = Color.Transparent)

val NextermLogo: ImageVector by lazy {
    ImageVector.Builder("Nexterm", 57.dp, 51.2.dp, 570f, 512f).addPath(
        addPathNodes(
            "M323.148 401.419C303.03 401.419 286.72 385.11 286.72 364.992C286.72 344.874 303.03 328.565 323.148 328.565H444.573C464.691 328.565 481 344.874 481 364.992" +
                "C481 385.11 464.691 401.419 444.573 401.419H323.148ZM141.286 291.862C161.238 271.91 161.197 239.55 141.196 219.648L93.3467 172.037" +
                "C70.3893 149.193 86.5666 110 118.953 110C128.568 110 137.791 113.815 144.597 120.607L254.421 230.211C268.507 244.539 268.507 267.852 254.421 281.695" +
                "L145.359 390.757C138.532 397.584 129.272 401.419 119.617 401.419C87.1842 401.419 70.9416 362.206 93.8753 339.273L141.286 291.862Z",
        ),
        fill = SolidColor(Color.White),
    ).build()
}

@Composable
fun Logo(size: Dp, modifier: Modifier = Modifier, tint: Color = MaterialTheme.colorScheme.primary) = Icon(NextermLogo, null, modifier.size(size), tint)

@Composable
fun LogoTile(size: Dp = 44.dp) = Box(Modifier.size(size).background(nxc.accent, RoundedCornerShape(size * 10 / 36)), Alignment.Center) {
    Icon(NextermLogo, null, Modifier.size(size * 0.72f), nxc.onAccent)
}

@Composable
fun HairlineCard(
    modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, selected: Boolean = false, outlined: Boolean = true, content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val border = if (outlined) BorderStroke(1.dp, if (selected) MaterialTheme.colorScheme.primary else nxc.border) else null
    val color = MaterialTheme.colorScheme.surfaceContainer
    if (onClick == null) Surface(modifier, shape, color, border = border) { Column(content = content) }
    else Surface(onClick, modifier, shape = shape, color = color, border = border) { Column(content = content) }
}

fun Modifier.groupRow(first: Boolean, last: Boolean, fill: Color): Modifier {
    val top = if (first) 16.dp else 0.dp
    val bottom = if (last) 16.dp else 0.dp
    return padding(horizontal = 16.dp).clip(RoundedCornerShape(top, top, bottom, bottom)).background(fill)
}

@Composable
fun ServerTile(server: Server) {
    val (background, glyph) = when {
        server.isStopped -> nxc.fill to nxc.subtext
        server.isPve -> nxc.proxmox to Color.White
        else -> nxc.accent to nxc.onAccent
    }
    Box(Modifier.size(32.dp).background(background, RoundedCornerShape(9.dp)), Alignment.Center) { Icon(iconFor(IconKeys.server(server)), null, Modifier.size(17.dp), glyph) }
}

@Composable
fun LeadingTile(icon: ImageVector, tint: Color = MaterialTheme.colorScheme.primary, size: Dp = 36.dp) =
    Box(Modifier.size(size).background(tint.copy(alpha = 0.14f), RoundedCornerShape(size * 10 / 36)), Alignment.Center) { Icon(icon, null, Modifier.size(size / 2), tint) }

@Composable
fun StatusPill(label: String, color: Color, modifier: Modifier = Modifier) = Row(
    modifier.background(color.copy(alpha = 0.18f), CircleShape).padding(horizontal = 8.dp, vertical = 3.dp), Arrangement.spacedBy(5.dp), Alignment.CenterVertically,
) {
    Box(Modifier.size(6.dp).background(color, CircleShape))
    Text(label, color = color, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
}

@Composable
fun TagDots(tags: List<Tag>) = Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    tags.forEach { Box(Modifier.size(8.dp).background(tagColor(it), CircleShape)) }
}

@Composable
fun SheetHeader(icon: ImageVector, title: String, subtitle: String?, trailing: @Composable () -> Unit = {}) = ListItem(
    headlineContent = { Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    supportingContent = subtitle?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
    leadingContent = { LeadingTile(icon) },
    trailingContent = trailing, colors = transparentListItem,
)

@Composable
fun SheetItem(icon: ImageVector, title: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant, trailing: (@Composable () -> Unit)? = null, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(title, color = if (color == MaterialTheme.colorScheme.error) color else Color.Unspecified) },
    leadingContent = { Icon(icon, null, tint = color) }, trailingContent = trailing,
    colors = transparentListItem, modifier = Modifier.clickable(onClick = onClick),
)

@Composable
fun SearchField(query: String, onChange: (String) -> Unit, placeholder: String) = OutlinedTextField(
    query, onChange, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), singleLine = true, shape = CircleShape,
    placeholder = { Text(placeholder) }, leadingIcon = { Icon(Icons.Outlined.Search, null) },
)

@Composable
fun ButtonLabel(icon: ImageVector, text: String) {
    Icon(icon, null, Modifier.size(ButtonDefaults.IconSize))
    Text(text, Modifier.padding(start = 8.dp))
}

@Composable
fun StateMessage(icon: ImageVector, title: String, subtitle: String?, isError: Boolean = false, onRetry: (() -> Unit)? = null) =
    Column(Modifier.fillMaxWidth().padding(32.dp), Arrangement.spacedBy(8.dp), Alignment.CenterHorizontally) {
        LeadingTile(icon, if (isError) nxc.error else MaterialTheme.colorScheme.onSurfaceVariant, 56.dp)
        Text(title, Modifier.padding(top = 8.dp), style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (onRetry != null) FilledTonalButton(onRetry, Modifier.padding(top = 8.dp)) { Text("Retry") }
    }

@Composable
fun LogoMessage(title: String, subtitle: String?, modifier: Modifier = Modifier) = Column(modifier.padding(32.dp), Arrangement.spacedBy(8.dp), Alignment.CenterHorizontally) {
    Logo(64.dp)
    Text(title, Modifier.padding(top = 12.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
}

@Composable
fun ErrorBanner(text: String, onDismiss: (() -> Unit)? = null, shape: Shape = RectangleShape, action: String? = null, onAction: () -> Unit = {}) = Row(
    Modifier.fillMaxWidth().clip(shape).background(MaterialTheme.colorScheme.errorContainer).heightIn(min = 48.dp).padding(start = 16.dp, end = 4.dp),
    verticalAlignment = Alignment.CenterVertically,
) {
    Icon(Icons.Outlined.ErrorOutline, null, Modifier.size(20.dp), nxc.error)
    Text(text, Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 10.dp), MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
    if (action != null) TextButton(onAction) { Text(action) }
    if (onDismiss != null) IconButton(onDismiss) { Icon(Icons.Outlined.Close, "Dismiss", tint = MaterialTheme.colorScheme.onErrorContainer) }
    if (action == null && onDismiss == null) Spacer(Modifier.width(12.dp))
}

@Composable
fun Modifier.focusOnTapOnly(): Modifier {
    var allowed by remember { mutableStateOf(false) }
    return pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial); allowed = true } }
        .focusProperties { canFocus = allowed }
        .onFocusChanged { if (!it.hasFocus) allowed = false }
}

@Composable
fun Modifier.keyboardPadding(): Modifier {
    val density = LocalDensity.current
    val ime = WindowInsets.ime.getBottom(density)
    var gap by remember { mutableIntStateOf(0) }
    return onGloballyPositioned { gap = (it.findRootCoordinates().size.height - it.positionInRoot().y - it.size.height).roundToInt() }
        .padding(bottom = with(density) { (ime - gap).coerceAtLeast(0).toDp() })
}

@Composable
fun SectionHeader(text: String) =
    Text(text, Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp, bottom = 6.dp), MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)

@Composable
fun SettingsGroup(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    HairlineCard(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), content = content)

@Composable
fun GroupDivider() = HorizontalDivider(Modifier.padding(start = 68.dp), color = nxc.border)

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
fun ConnectionFailed(sessionId: String, message: String?, onReconnect: () -> Unit = {}) = Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
    val cs = MaterialTheme.colorScheme
    Box(Modifier.fillMaxWidth().height(2.dp).background(nxc.error))
    Column(Modifier.align(Alignment.Center).verticalScroll(rememberScrollState()).padding(32.dp).widthIn(max = 420.dp), Arrangement.spacedBy(24.dp), Alignment.CenterHorizontally) {
        LinkGraphic(Icons.Filled.Error, nxc.error, 28.dp)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Connection failed", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, color = cs.onSurface)
            Text(message ?: "The connection to the server was lost.", style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant, textAlign = TextAlign.Center)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton({ nx.scope.launch { nx.sessions.closeSession(sessionId) } }) { ButtonLabel(Icons.Outlined.Close, "Close") }
            FilledTonalButton({ onReconnect(); nx.sessions.reconnect(sessionId) }) { ButtonLabel(Icons.Outlined.Refresh, "Reconnect") }
        }
    }
}

@Composable
private fun LinkGraphic(icon: ImageVector, tint: Color, iconSize: Dp) = Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
    Icon(Icons.Outlined.Laptop, null, Modifier.size(48.dp), MaterialTheme.colorScheme.onSurfaceVariant)
    Box(Modifier.padding(start = 10.dp).size(28.dp, 2.dp).background(nxc.borderStrong, CircleShape))
    Icon(icon, null, Modifier.size(iconSize), tint)
    Box(Modifier.padding(end = 10.dp).size(28.dp, 2.dp).background(nxc.borderStrong, CircleShape))
    Icon(Icons.Outlined.Dns, null, Modifier.size(48.dp), MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
fun TrustPrompt(sessionId: String, challenge: TrustChallenge) {
    val cs = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var busy by remember(challenge.fingerprint) { mutableStateOf(false) }
    var error by remember(challenge.fingerprint) { mutableStateOf<String?>(null) }
    val tone = if (challenge.isChanged) nxc.error else nxc.accentText
    fun answer(accept: Boolean) {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try { nx.sessions.answerTrust(sessionId, challenge, accept) } catch (e: Exception) { error = e.message ?: "Your decision could not be saved"; busy = false }
        }
    }
    Surface(Modifier.fillMaxSize(), color = cs.background, contentColor = cs.onSurface) { Box {
        Box(Modifier.fillMaxWidth(0.45f).height(2.dp).background(nxc.accent))
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(24.dp),
            Arrangement.spacedBy(20.dp, Alignment.CenterVertically), Alignment.CenterHorizontally,
        ) {
            LinkGraphic(if (challenge.isChanged) Icons.Filled.GppMaybe else Icons.Outlined.Shield, tone, 30.dp)
            Column(Modifier.widthIn(max = 560.dp), Arrangement.spacedBy(8.dp), Alignment.CenterHorizontally) {
                Text(challenge.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                Text(challenge.message, style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant, textAlign = TextAlign.Center)
            }
            HairlineCard(Modifier.widthIn(max = 560.dp).fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 18.dp, vertical = 16.dp), Arrangement.spacedBy(14.dp)) {
                    challenge.previousFingerprint?.let {
                        TrustValue(challenge.previousLabel) { Text(it, style = MonoStyle, color = cs.onSurfaceVariant, textDecoration = TextDecoration.LineThrough) }
                    }
                    TrustValue(challenge.fingerprintLabel) { SelectionContainer { Text(challenge.fingerprint, style = MonoStyle, color = if (challenge.isChanged) nxc.error else cs.onSurface) } }
                    if (challenge.facts.isNotEmpty()) {
                        HorizontalDivider(color = nxc.border)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            challenge.facts.forEach { fact -> TrustValue(fact.label) { Text(fact.value, style = MaterialTheme.typography.bodyMedium) } }
                        }
                    }
                }
            }
            (error ?: challenge.blockedHint)?.let {
                Text(it, Modifier.widthIn(max = 560.dp), if (error != null) nxc.error else cs.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (challenge.isChanged) {
                    if (challenge.canTrust) OutlinedButton({ answer(true) }, enabled = !busy) { ButtonLabel(Icons.Outlined.RemoveModerator, challenge.acceptLabel) }
                    FilledTonalButton({ answer(false) }, enabled = !busy, colors = ButtonDefaults.filledTonalButtonColors(nxc.error.copy(alpha = 0.18f), nxc.error)) {
                        ButtonLabel(Icons.Outlined.Close, challenge.cancelLabel)
                    }
                } else {
                    OutlinedButton({ answer(false) }, enabled = !busy) { ButtonLabel(Icons.Outlined.Close, challenge.cancelLabel) }
                    FilledTonalButton({ answer(true) }, enabled = !busy) { ButtonLabel(Icons.Outlined.Check, challenge.acceptLabel) }
                }
            }
        }
    } }
}

@Composable
private fun TrustValue(label: String, value: @Composable () -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
    value()
}

@Composable
fun ConnectionLoader(visible: Boolean) = AnimatedVisibility(visible, exit = fadeOut(tween(200))) {
    val cs = MaterialTheme.colorScheme
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(0.85f, keyframes {
            durationMillis = 8000
            0.22f at 400; 0.32f at 1200; 0.45f at 2400; 0.55f at 4000; 0.65f at 5600; 0.75f at 6800
        })
    }
    val flow = rememberInfiniteTransition("flow")
    Box(Modifier.fillMaxSize().background(cs.background)) {
        Box(Modifier.fillMaxWidth(progress.value).height(2.dp).background(nxc.accent))
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Laptop, null, Modifier.size(40.dp), cs.onSurfaceVariant)
            Row(Modifier.padding(horizontal = 32.dp), Arrangement.spacedBy(12.dp), Alignment.CenterVertically) {
                repeat(3) { i ->
                    val phase by flow.animateFloat(0f, 1f, infiniteRepeatable(tween(750, easing = FastOutSlowInEasing), RepeatMode.Reverse, StartOffset(i * 300)), "dot$i")
                    Box(Modifier.offset(x = (-4 + 8 * phase).dp).size(6.dp).alpha(phase).background(nxc.accent, CircleShape))
                }
            }
            Icon(Icons.Outlined.Dns, null, Modifier.size(40.dp), cs.onSurfaceVariant)
        }
    }
}

@Composable
fun KeyBar(keyboardShown: Boolean, onToggleKeyboard: () -> Unit, trailing: @Composable RowScope.() -> Unit = {}, keys: @Composable RowScope.() -> Unit) = Column(Modifier.background(MaterialTheme.colorScheme.surface)) {
    HorizontalDivider(color = nxc.border)
    Row(Modifier.height(52.dp).padding(horizontal = 8.dp), Arrangement.spacedBy(6.dp), Alignment.CenterVertically) {
        KeyCap(icon = if (keyboardShown) Icons.Outlined.KeyboardHide else Icons.Outlined.Keyboard, description = if (keyboardShown) "Hide keyboard" else "Show keyboard", onPress = onToggleKeyboard)
        Row(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).horizontalScroll(rememberScrollState()), Arrangement.spacedBy(6.dp), Alignment.CenterVertically, keys)
        trailing()
    }
}

@Composable
fun KeyCap(label: String? = null, icon: ImageVector? = null, description: String? = label, active: Boolean? = null, repeat: Boolean = false, onPress: () -> Unit) {
    val view = LocalView.current
    val source = remember { MutableInteractionSource() }
    val press by rememberUpdatedState { view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); onPress() }
    var repeated by remember { mutableStateOf(false) }
    if (repeat) {
        val pressed by source.collectIsPressedAsState()
        LaunchedEffect(pressed) {
            if (!pressed) return@LaunchedEffect
            repeated = false
            delay(400)
            repeated = true
            while (true) { press(); delay(60) }
        }
    }
    val on = active == true
    val shape = RoundedCornerShape(8.dp)
    val content = if (on) nxc.accentText else MaterialTheme.colorScheme.onSurface
    Box(
        Modifier.height(40.dp).widthIn(min = 40.dp).clip(shape).background(if (on) nxc.accentFill else nxc.fill).border(1.dp, if (on) nxc.accentText else nxc.border, shape)
            .then(if (active != null) Modifier.semantics { selected = on } else Modifier)
            .clickable(source, LocalIndication.current, role = Role.Button) { if (repeated) repeated = false else press() }.padding(horizontal = 10.dp),
        Alignment.Center,
    ) {
        if (icon != null) Icon(icon, description, Modifier.size(18.dp), content)
        else Text(label.orEmpty(), color = content, fontFamily = Mono, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScreen(
    title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, titleContent: (@Composable () -> Unit)? = null, anchor: @Composable () -> Unit = {},
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
                            titleContent?.invoke() ?: Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) }
                        }
                    },
                    actions = actions, scrollBehavior = scroll,
                    navigationIcon = { anchor(); onBack?.let { IconButton(it) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } } },
                    colors = TopAppBarDefaults.topAppBarColors(scrolledContainerColor = MaterialTheme.colorScheme.surface),
                )
                header()
            }
        },
        content = content,
    )
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
private fun paneDirective(): PaneScaffoldDirective {
    val info = currentWindowAdaptiveInfo()
    val directive = calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth(info)
    return if (info.windowSizeClass.isHeightAtLeastBreakpoint(WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND)) directive else directive.copy(maxHorizontalPartitions = 1)
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun isTwoPane(): Boolean = paneDirective().maxHorizontalPartitions > 1

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun ListDetail(showDetail: Boolean, onBack: () -> Unit, list: @Composable (twoPane: Boolean) -> Unit, detail: @Composable (twoPane: Boolean) -> Unit) {
    val nav = rememberListDetailPaneScaffoldNavigator<Nothing>(paneDirective())
    val twoPane = nav.scaffoldDirective.maxHorizontalPartitions > 1
    LaunchedEffect(showDetail) { if (showDetail) nav.navigateTo(ListDetailPaneScaffoldRole.Detail) else if (nav.canNavigateBack(BackNavigationBehavior.PopLatest)) nav.navigateBack(BackNavigationBehavior.PopLatest) }
    BackHandler(showDetail, onBack)
    ListDetailPaneScaffold(nav.scaffoldDirective, nav.scaffoldValue, { AnimatedPane { list(twoPane) } }, { AnimatedPane { detail(twoPane) } })
}

@Composable
fun DetailPlaceholder(icon: ImageVector, title: String) = Box(Modifier.fillMaxSize(), Alignment.Center) { StateMessage(icon, title, null) }
