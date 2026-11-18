package dev.gnm.nexterm.guacamole

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.changedToDownIgnoreConsumed
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import androidx.compose.runtime.getValue

@Composable
fun GuacamoleCanvas(
    viewport: GuacamoleViewport,
    modifier: Modifier = Modifier,
) {
    val state = viewport.state
    val version by state.frameVersion.collectAsState()
    val size by state.size.collectAsState()
    val cursor by state.cursor.collectAsState()
    val clientState by state.client.state.collectAsState()
    val threshold = with(LocalDensity.current) { 4.dp.toPx() }

    LaunchedEffect(size) {
        viewport.displayWidth = size.width
        viewport.displayHeight = size.height
    }
    LaunchedEffect(threshold) { viewport.moveThresholdSquared = threshold * threshold }

    val connected = clientState == GuacClientState.CONNECTED || clientState == GuacClientState.WAITING
    LaunchedEffect(connected, clientState, viewport.availableWidth, viewport.availableHeight) {
        val w = viewport.availableWidth.toInt()
        val h = viewport.availableHeight.toInt()
        if (connected && w > 0 && h > 0) state.client.sendSize(w, h)
    }

    val input = Modifier.onSizeChanged {
        viewport.availableWidth = it.width.toFloat()
        viewport.availableHeight = it.height.toFloat()
    }.pointerInput(viewport) { trackPointers(viewport) }

    Canvas(modifier.then(input).clipToBounds()) {
        drawRect(Color.Black)
        version
        val frame = state.frame ?: return@Canvas
        val scale = viewport.scale
        translate(viewport.offsetX, viewport.offsetY) {
            drawImage(
                frame,
                srcOffset = IntOffset.Zero,
                srcSize = IntSize(frame.width, frame.height),
                dstSize = IntSize((frame.width * scale).toInt(), (frame.height * scale).toInt()),
                filterQuality = FilterQuality.Low,
            )
            if (viewport.mouseMode == GuacMouseMode.VIRTUAL_MOUSE) {
                withTransform({ scale(scale, scale, Offset.Zero) }) {
                    drawPointer(viewport.mouseX, viewport.mouseY, cursor)
                }
            }
        }
    }
}

private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.trackPointers(viewport: GuacamoleViewport) {
    awaitPointerEventScope {
        val active = HashSet<Long>()
        try {
            while (true) {
                val event = awaitPointerEvent()
                if (event.type == PointerEventType.Scroll) {
                    event.changes.forEach {
                        viewport.onScroll(it.position.x, it.position.y, it.scrollDelta.y)
                        it.consume()
                    }
                    continue
                }
                for (change in event.changes) {
                    val id = change.id.value
                    val p = change.position
                    when {
                        change.changedToDownIgnoreConsumed() -> {
                            active += id
                            viewport.onPointerDown(id, p.x, p.y)
                        }
                        change.changedToUpIgnoreConsumed() -> {
                            active -= id
                            viewport.onPointerUp(id, p.x, p.y)
                        }
                        change.pressed && change.positionChanged() -> viewport.onPointerMove(id, p.x, p.y)
                    }
                    change.consume()
                }
            }
        } catch (e: CancellationException) {
            active.forEach(viewport::onPointerCancel)
            throw e
        }
    }
}

private fun DrawScope.drawPointer(x: Float, y: Float, cursor: GuacCursor) {
    val image = cursor.image
    if (image != null) {
        drawImage(image, Offset(x - cursor.hotspotX, y - cursor.hotspotY))
        return
    }
    val path = Path().apply {
        moveTo(x, y)
        lineTo(x, y + 18)
        lineTo(x + 5, y + 14)
        lineTo(x + 9, y + 22)
        lineTo(x + 12, y + 21)
        lineTo(x + 8, y + 13)
        lineTo(x + 13, y + 12)
        close()
    }
    drawPath(path, Color.White)
    drawPath(path, Color.Black, style = Stroke(width = 1.5f))
}
