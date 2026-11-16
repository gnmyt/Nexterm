package dev.gnm.nexterm.terminal

import androidx.compose.animation.core.AnimationState
import androidx.compose.animation.core.animateDecay
import androidx.compose.animation.core.exponentialDecay
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.gnm.nexterm.terminal.TerminalSnapshot.Cell
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import dev.gnm.nexterm.resources.Res
import dev.gnm.nexterm.resources.jetbrains_mono_bold
import dev.gnm.nexterm.resources.jetbrains_mono_regular
import org.jetbrains.compose.resources.Font
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.roundToInt
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

@Composable
fun TerminalCanvas(
    controller: TerminalController,
    modifier: Modifier = Modifier,
    onTap: () -> Unit = {},
) {
    val terminal = controller.terminal
    val theme = controller.theme
    LaunchedEffect(terminal, theme) { terminal.setTheme(theme) }
    val revision = terminal.revision.collectAsState()

    val regular = Font(Res.font.jetbrains_mono_regular, FontWeight.Normal)
    val bold = Font(Res.font.jetbrains_mono_bold, FontWeight.Bold)
    val family = remember(regular, bold) { FontFamily(regular, bold) }
    val measurer = rememberTextMeasurer(cacheSize = 0)
    val fontSize = controller.fontSize
    val style = remember(family, fontSize) {
        TextStyle(
            fontFamily = family,
            fontSize = fontSize.sp,
            lineHeight = (fontSize * 1.2f).sp,
            lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
        )
    }
    val glyphs = remember(measurer, style) { GlyphCache(measurer, style) }
    val cell = glyphs.cellSize
    val snapshot = remember(terminal) { TerminalSnapshot() }

    val density = LocalDensity.current
    val padX = with(density) { 8.dp.toPx() }
    val padY = with(density) { 4.dp.toPx() }
    var size by remember { mutableStateOf(IntSize.Zero) }
    val cols = max(1, ((size.width - 2 * padX) / cell.width).toInt())
    val rows = max(1, ((size.height - 2 * padY) / cell.height).toInt())
    LaunchedEffect(terminal, cols, rows, cell, size == IntSize.Zero) {
        if (size != IntSize.Zero) terminal.resize(cols, rows, cell.width.roundToInt(), cell.height.roundToInt())
    }

    var blinkOn by remember { mutableStateOf(true) }
    LaunchedEffect(terminal) {
        terminal.revision.collectLatest {
            blinkOn = true
            while (true) {
                delay(530)
                blinkOn = !blinkOn
            }
        }
    }

    val scope = rememberCoroutineScope()
    val scroller = remember(terminal) { Scroller(terminal) }
    scroller.cellHeight = cell.height

    Canvas(
        modifier
            .onSizeChanged { size = it }
            .clipToBounds()
            .pointerInput(controller, cell, padX, padY) {
                fun cellAt(p: Offset) = Pair(
                    ((p.x - padX) / cell.width).toInt().coerceIn(0, terminal.cols - 1),
                    ((p.y - padY) / cell.height).toInt().coerceIn(0, terminal.rows - 1),
                )
                var lastTap = 0L
                var lastTapPos = Offset.Zero
                var fling: Job? = null
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    fling?.cancel()
                    val tracker = VelocityTracker().apply { addPosition(down.uptimeMillis, down.position) }
                    var mode = Gesture.PENDING
                    var lastY = down.position.y
                    var pinchDistance = 0f
                    var pinchSize = controller.fontSize
                    val anchor = cellAt(down.position)
                    while (true) {
                        val event = if (mode == Gesture.PENDING) {
                            withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) { awaitPointerEvent() }
                        } else awaitPointerEvent()
                        if (event == null) {
                            mode = Gesture.SELECT
                            controller.hasSelection = terminal.selectWords(anchor.first, anchor.second, anchor.first, anchor.second)
                            continue
                        }
                        val pressed = event.changes.filter { it.pressed }
                        if (pressed.isEmpty()) {
                            val up = event.changes.first()
                            when (mode) {
                                Gesture.PENDING -> {
                                    val doubleTap = up.uptimeMillis - lastTap < viewConfiguration.doubleTapTimeoutMillis &&
                                        (up.position - lastTapPos).getDistance() < viewConfiguration.touchSlop * 2
                                    lastTap = up.uptimeMillis
                                    lastTapPos = up.position
                                    when {
                                        controller.hasSelection -> controller.clearSelection()
                                        doubleTap -> controller.hasSelection =
                                            terminal.selectWords(anchor.first, anchor.second, anchor.first, anchor.second)
                                        else -> {
                                            val p = up.position - Offset(padX, padY)
                                            if (terminal.mouseInput(TerminalMouseButton.LEFT, TerminalMouseAction.PRESS, p.x, p.y)) {
                                                terminal.mouseInput(TerminalMouseButton.LEFT, TerminalMouseAction.RELEASE, p.x, p.y)
                                            }
                                            onTap()
                                        }
                                    }
                                }
                                Gesture.SCROLL -> {
                                    tracker.addPosition(up.uptimeMillis, up.position)
                                    val velocity = tracker.calculateVelocity().y
                                    if (abs(velocity) > 50f) fling = scope.launch {
                                        var last = 0f
                                        AnimationState(0f, velocity).animateDecay(exponentialDecay()) {
                                            scroller.scrollBy(value - last)
                                            last = value
                                        }
                                    }
                                }
                                Gesture.PINCH -> controller.saveFontSize()
                                Gesture.SELECT -> Unit
                            }
                            break
                        }
                        val primary = pressed.first()
                        if (pressed.size >= 2 && (mode == Gesture.PENDING || mode == Gesture.SCROLL)) {
                            mode = Gesture.PINCH
                            pinchDistance = (pressed[0].position - pressed[1].position).getDistance()
                            pinchSize = controller.fontSize
                        }
                        when (mode) {
                            Gesture.PENDING -> if ((primary.position - down.position).getDistance() > viewConfiguration.touchSlop) {
                                mode = Gesture.SCROLL
                                lastY = primary.position.y
                            }
                            Gesture.SCROLL -> {
                                tracker.addPosition(primary.uptimeMillis, primary.position)
                                scroller.scrollBy(primary.position.y - lastY)
                                lastY = primary.position.y
                            }
                            Gesture.SELECT -> {
                                val (x, y) = cellAt(primary.position)
                                controller.hasSelection = terminal.selectWords(anchor.first, anchor.second, x, y)
                            }
                            Gesture.PINCH -> if (pressed.size >= 2 && pinchDistance > 0f) {
                                val d = hypot(pressed[0].position.x - pressed[1].position.x, pressed[0].position.y - pressed[1].position.y)
                                controller.setFontSize((pinchSize * d / pinchDistance).toDouble())
                            }
                        }
                        if (mode != Gesture.PENDING) event.changes.forEach { it.consume() }
                    }
                }
            },
    ) {
        revision.value
        if (!terminal.snapshot(snapshot)) return@Canvas
        drawRect(Color(snapshot.defaultBackground))
        drawCells(snapshot, glyphs, cell, padX, padY, Color(theme.selection))
        if (snapshot.cursorVisible && snapshot.cursorY in 0 until snapshot.rows && blinkOn) {
            drawCursor(snapshot, glyphs, cell, padX, padY, controller.cursorStyle, Color(theme.cursor))
        }
    }
}

private enum class Gesture { PENDING, SCROLL, SELECT, PINCH }

private class Scroller(private val terminal: Terminal) {
    var cellHeight = 1f
    private var pending = 0f

    fun scrollBy(dy: Float) {
        pending += dy
        val lines = (pending / cellHeight).toInt()
        if (lines == 0) return
        pending -= lines * cellHeight
        if (!terminal.isAltScreen) return terminal.scrollLines(-lines)
        val up = lines > 0
        repeat(abs(lines)) {
            val button = if (up) TerminalMouseButton.WHEEL_UP else TerminalMouseButton.WHEEL_DOWN
            if (!terminal.mouseInput(button, TerminalMouseAction.PRESS, 0f, 0f)) {
                terminal.keyInput(if (up) TerminalKey.ARROW_UP else TerminalKey.ARROW_DOWN)
            }
        }
    }
}

private class GlyphCache(private val measurer: TextMeasurer, private val base: TextStyle) {
    private val cache = HashMap<String, TextLayoutResult>()

    val cellSize: Size = measurer.measure("MMMMMMMMMM", base, softWrap = false).size.let { Size(it.width / 10f, it.height.toFloat()) }

    fun layout(text: String, flags: Int): TextLayoutResult {
        val key = "${flags and STYLE_MASK}|$text"
        cache[key]?.let { return it }
        if (cache.size > 4096) cache.clear()
        val decorations = buildList {
            if (flags and Cell.UNDERLINE != 0) add(TextDecoration.Underline)
            if (flags and Cell.STRIKETHROUGH != 0) add(TextDecoration.LineThrough)
        }
        val style = base.copy(
            fontWeight = if (flags and Cell.BOLD != 0) FontWeight.Bold else FontWeight.Normal,
            fontStyle = if (flags and Cell.ITALIC != 0) FontStyle.Italic else FontStyle.Normal,
            textDecoration = if (decorations.isEmpty()) null else TextDecoration.combine(decorations),
        )
        return measurer.measure(text, style, softWrap = false).also { cache[key] = it }
    }

    companion object {
        const val STYLE_MASK = Cell.BOLD or Cell.ITALIC or Cell.UNDERLINE or Cell.STRIKETHROUGH
    }
}

private fun TerminalSnapshot.fg(i: Int): Int {
    val c = if (flags[i] and Cell.INVERSE != 0) background[i] else foreground[i]
    return if (flags[i] and Cell.FAINT != 0) (c and 0xFFFFFF) or (0x80 shl 24) else c
}

private fun TerminalSnapshot.bg(i: Int): Int? = when {
    flags[i] and Cell.INVERSE != 0 -> foreground[i]
    flags[i] and Cell.HAS_BACKGROUND != 0 -> background[i]
    else -> null
}

private fun batchable(cp: Int) = cp in 0x20..0x24F || cp in 0x2500..0x259F

private fun TerminalSnapshot.isBlank(i: Int) =
    (codePoint(i).let { it == 0 || it == 0x20 } && flags[i] and (Cell.UNDERLINE or Cell.STRIKETHROUGH) == 0) ||
        flags[i] and (Cell.SPACER or Cell.INVISIBLE) != 0

private fun DrawScope.drawCells(s: TerminalSnapshot, glyphs: GlyphCache, cell: Size, padX: Float, padY: Float, selection: Color) {
    val sb = StringBuilder()
    for (y in 0 until s.rows) {
        val top = padY + y * cell.height
        val row = y * s.cols
        var x = 0
        while (x < s.cols) {
            val bg = s.bg(row + x)
            val selected = s.flags[row + x] and Cell.SELECTED != 0
            var end = x + 1
            while (end < s.cols && s.bg(row + end) == bg && (s.flags[row + end] and Cell.SELECTED != 0) == selected) end++
            val topLeft = Offset(padX + x * cell.width, top)
            val runSize = Size((end - x) * cell.width + 0.5f, cell.height)
            if (bg != null) drawRect(Color(bg), topLeft, runSize)
            if (selected) drawRect(selection, topLeft, runSize)
            x = end
        }

        x = 0
        while (x < s.cols) {
            val i = row + x
            if (s.isBlank(i)) {
                x++
                continue
            }
            val fg = s.fg(i)
            val style = s.flags[i] and GlyphCache.STYLE_MASK
            sb.clear()
            val start = x
            if (batchable(s.codePoint(i)) && !s.isCluster(i)) {
                var lastInk = x
                while (x < s.cols) {
                    val j = row + x
                    if (s.isBlank(j)) {
                        sb.append(' ')
                    } else {
                        val cp = s.codePoint(j)
                        if (!batchable(cp) || s.isCluster(j) || s.fg(j) != fg || s.flags[j] and GlyphCache.STYLE_MASK != style) break
                        s.appendText(j, sb)
                        lastInk = x
                    }
                    x++
                }
                sb.setLength(lastInk - start + 1)
                x = lastInk + 1
            } else {
                s.appendText(i, sb)
                x += if (s.flags[i] and Cell.WIDE != 0) 2 else 1
            }
            drawText(glyphs.layout(sb.toString(), style), Color(fg), Offset(padX + start * cell.width, top))
        }
    }
}

private fun DrawScope.drawCursor(
    s: TerminalSnapshot, glyphs: GlyphCache, cell: Size, padX: Float, padY: Float, style: TerminalCursorStyle, color: Color,
) {
    val i = s.cursorY * s.cols + s.cursorX.coerceIn(0, s.cols - 1)
    val width = cell.width * if (s.flags[i] and Cell.WIDE != 0) 2 else 1
    val topLeft = Offset(padX + s.cursorX * cell.width, padY + s.cursorY * cell.height)
    when (style) {
        TerminalCursorStyle.BLOCK -> {
            drawRect(color, topLeft, Size(width, cell.height))
            if (!s.isBlank(i)) {
                val sb = StringBuilder()
                s.appendText(i, sb)
                drawText(glyphs.layout(sb.toString(), s.flags[i]), Color(s.bg(i) ?: s.defaultBackground), topLeft)
            }
        }
        TerminalCursorStyle.BLOCK_HOLLOW -> drawRect(color, topLeft, Size(width, cell.height), style = Stroke(1.dp.toPx()))
        TerminalCursorStyle.UNDERLINE -> drawRect(color, topLeft + Offset(0f, cell.height - 2.dp.toPx()), Size(width, 2.dp.toPx()))
        TerminalCursorStyle.BAR -> drawRect(color, topLeft, Size(2.dp.toPx(), cell.height))
    }
}
