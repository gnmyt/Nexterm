package dev.gnm.nexterm.guacamole

import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.hypot
import kotlin.math.min
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

enum class GuacMouseMode { DIRECT, VIRTUAL_MOUSE }

@Stable
class GuacamoleViewport internal constructor(val state: GuacamoleDisplayState) {
    private val scope = MainScope()

    fun dispose() = scope.cancel()

    private val client get() = state.client

    var mouseMode by mutableStateOf(GuacMouseMode.DIRECT)
    var userScale by mutableFloatStateOf(1f)
        private set
    var panX by mutableFloatStateOf(0f)
        private set
    var panY by mutableFloatStateOf(0f)
        private set
    var availableWidth by mutableFloatStateOf(0f)
        internal set
    var availableHeight by mutableFloatStateOf(0f)
        internal set
    var displayWidth by mutableIntStateOf(0)
        internal set
    var displayHeight by mutableIntStateOf(0)
        internal set
    var mouseX by mutableFloatStateOf(0f)
        private set
    var mouseY by mutableFloatStateOf(0f)
        private set

    var moveThresholdSquared = 16f

    val displayScale: Float
        get() = if (displayWidth <= 0 || displayHeight <= 0 || availableWidth <= 0f || availableHeight <= 0f) 1f
        else min(availableWidth / displayWidth, availableHeight / displayHeight)

    val scale: Float get() = displayScale * userScale
    val offsetX: Float get() = (availableWidth - displayWidth * scale) / 2 + panX
    val offsetY: Float get() = (availableHeight - displayHeight * scale) / 2 + panY

    fun screenToRemoteX(x: Float): Float = ((x - offsetX) / scale).coerceIn(0f, displayWidth.toFloat())
    fun screenToRemoteY(y: Float): Float = ((y - offsetY) / scale).coerceIn(0f, displayHeight.toFloat())

    fun fit() {
        userScale = 1f
        panX = 0f
        panY = 0f
    }

    private val pointers = LinkedHashMap<Long, Offset>()
    private var pinching = false
    private var pinchBaseDistance = 0f
    private var pinchBaseScale = 1f
    private var pinchBaseCenter = Offset.Zero
    private var pinchBasePan = Offset.Zero
    private var downPosition: Offset? = null
    private var hasMoved = false
    private var buttonHeld = false
    private var releaseJob: Job? = null
    private var longPressJob: Job? = null

    private fun send(left: Boolean = false, right: Boolean = false) =
        client.sendMouseState(GuacMouseState(x = mouseX.toDouble(), y = mouseY.toDouble(), left = left, right = right))

    private fun moveMouseTo(x: Float, y: Float) {
        mouseX = screenToRemoteX(x)
        mouseY = screenToRemoteY(y)
    }

    fun onPointerDown(id: Long, x: Float, y: Float) {
        val position = Offset(x, y)
        pointers[id] = position
        if (pointers.size == 2) {
            cancelTimers()
            if (buttonHeld) sendMouseUp()
            startPinch()
            return
        }
        if (pointers.size > 2) return

        downPosition = position
        hasMoved = false
        releaseJob?.cancel()
        releaseJob = null
        longPressJob?.cancel()
        longPressJob = scope.launch {
            delay(LONG_PRESS_MILLIS)
            if (!hasMoved && pointers.size == 1) onLongPress(position)
        }
    }

    fun onPointerMove(id: Long, x: Float, y: Float) {
        val position = Offset(x, y)
        val previous = pointers[id] ?: return
        pointers[id] = position

        if (pinching && pointers.size >= 2) {
            updatePinch()
            return
        }
        if (pointers.size != 1) return

        val down = downPosition
        if (!hasMoved && down != null) {
            if ((position - down).getDistanceSquared() > moveThresholdSquared) {
                hasMoved = true
                longPressJob?.cancel()
            }
        }
        if (!hasMoved) return

        if (mouseMode == GuacMouseMode.DIRECT) {
            moveMouseTo(x, y)
            buttonHeld = true
            send(left = true)
        } else {
            val delta = position - previous
            mouseX = (mouseX + delta.x / scale).coerceIn(0f, displayWidth.toFloat())
            mouseY = (mouseY + delta.y / scale).coerceIn(0f, displayHeight.toFloat())
            send(left = buttonHeld)
        }
    }

    fun onPointerUp(id: Long, x: Float, y: Float) {
        pointers.remove(id)
        longPressJob?.cancel()
        if (pinching) {
            if (pointers.isEmpty()) pinching = false
            return
        }
        if (hasMoved) {
            if (buttonHeld) sendMouseUp()
            return
        }
        if (mouseMode == GuacMouseMode.DIRECT) moveMouseTo(x, y)
        if (!buttonHeld) {
            buttonHeld = true
            send(left = true)
        }
        releaseJob?.cancel()
        releaseJob = scope.launch {
            delay(RELEASE_DELAY_MILLIS)
            if (buttonHeld) sendMouseUp()
        }
    }

    fun onPointerCancel(id: Long) {
        pointers.remove(id)
        cancelTimers()
        if (buttonHeld) sendMouseUp()
        if (pointers.isEmpty()) pinching = false
    }

    fun onScroll(x: Float, y: Float, deltaY: Float) {
        if (deltaY == 0f) return
        moveMouseTo(x, y)
        val up = deltaY < 0
        client.sendMouseState(GuacMouseState(x = mouseX.toDouble(), y = mouseY.toDouble(), up = up, down = !up))
        send()
    }

    private fun sendMouseUp() {
        buttonHeld = false
        send()
    }

    private fun cancelTimers() {
        longPressJob?.cancel()
        releaseJob?.cancel()
        releaseJob = null
    }

    private fun onLongPress(position: Offset) {
        if (mouseMode == GuacMouseMode.DIRECT) moveMouseTo(position.x, position.y)
        if (buttonHeld) sendMouseUp()
        send(right = true)
        scope.launch {
            delay(RIGHT_CLICK_RELEASE_MILLIS)
            send()
        }
    }

    private fun startPinch() {
        pinching = true
        val (a, b) = pointers.values.toList()
        pinchBaseCenter = (a + b) / 2f
        pinchBaseDistance = (a - b).getDistance()
        pinchBaseScale = userScale
        pinchBasePan = Offset(panX, panY)
    }

    private fun updatePinch() {
        val p = pointers.values.toList()
        if (p.size < 2 || pinchBaseDistance <= 0f) return
        val center = (p[0] + p[1]) / 2f
        userScale = (pinchBaseScale * hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinchBaseDistance).coerceIn(MIN_SCALE, MAX_SCALE)
        panX = pinchBasePan.x + (center.x - pinchBaseCenter.x)
        panY = pinchBasePan.y + (center.y - pinchBaseCenter.y)
    }

    private companion object {
        const val LONG_PRESS_MILLIS = 500L
        const val RELEASE_DELAY_MILLIS = 250L
        const val RIGHT_CLICK_RELEASE_MILLIS = 50L
        const val MIN_SCALE = 0.5f
        const val MAX_SCALE = 3f
    }
}
