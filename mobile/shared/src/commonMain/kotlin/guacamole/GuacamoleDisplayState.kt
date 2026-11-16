package dev.gnm.nexterm.guacamole

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.jetbrains.compose.resources.decodeToImageBitmap
import kotlin.concurrent.Volatile
import kotlin.math.max
import kotlin.math.min

data class GuacDisplaySize(val width: Int, val height: Int)

data class GuacCursor(val image: ImageBitmap?, val hotspotX: Int, val hotspotY: Int, val x: Double, val y: Double, val visible: Boolean)

class GuacamoleDisplayState(val client: GuacClient) {
    val keyboard = GuacKeyboard(client)

    private val layers = HashMap<Int, GuacLayer>()
    private val frames = arrayOfNulls<ImageBitmap>(2)
    private var frameIndex = 0
    private var dirty = false

    @Volatile
    var frame: ImageBitmap? = null
        private set

    private val _frameVersion = MutableStateFlow(0L)
    val frameVersion: StateFlow<Long> = _frameVersion.asStateFlow()

    private val _size = MutableStateFlow(GuacDisplaySize(0, 0))
    val size: StateFlow<GuacDisplaySize> = _size.asStateFlow()

    private val _hasFrame = MutableStateFlow(false)
    val hasFrame: StateFlow<Boolean> = _hasFrame.asStateFlow()

    private val _cursor = MutableStateFlow(GuacCursor(null, 0, 0, 0.0, 0.0, false))
    val cursor: StateFlow<GuacCursor> = _cursor.asStateFlow()

    init {
        client.display = this
    }

    private fun layer(index: Int) = layers.getOrPut(index) { GuacLayer(index) }

    private fun existing(index: Int) = layers[index]

    fun resize(layer: Int, width: Int, height: Int) {
        layer(layer).resize(width, height)
        if (layer == 0) _size.value = GuacDisplaySize(width, height)
        dirty = true
    }

    fun drawImage(layer: Int, channelMask: Int, x: Int, y: Int, mimetype: String, data: ByteArray) {
        val image = try {
            data.decodeToImageBitmap()
        } catch (_: Exception) {
            return
        }
        val l = layer(layer)
        l.channelMask = channelMask
        l.fitRect(x, y, image.width, image.height)
        l.draw { it.drawImage(image, Offset(x.toFloat(), y.toFloat()), l.paint()) }
        dirty = true
    }

    fun copy(srcLayer: Int, srcX: Int, srcY: Int, width: Int, height: Int, channelMask: Int, dstLayer: Int, dstX: Int, dstY: Int) {
        val dst = layer(dstLayer)
        dst.channelMask = channelMask
        blit(layer(srcLayer), srcX, srcY, width, height, dst, dstX, dstY, dst.paint())
    }

    fun transfer(srcLayer: Int, srcX: Int, srcY: Int, width: Int, height: Int, function: Int, dstLayer: Int, dstX: Int, dstY: Int) {
        val src = layer(srcLayer)
        val dst = layer(dstLayer)
        if (function == TRANSFER_SRC) {
            blit(src, srcX, srcY, width, height, dst, dstX, dstY, Paint().apply { blendMode = BlendMode.Src })
            return
        }
        dst.fitRect(dstX, dstY, width, height)
        val r = clampCopy(src, srcX, srcY, width, height, dst, dstX, dstY) ?: return
        val srcBitmap = src.bitmap ?: return
        val dstBitmap = dst.bitmap ?: return
        val n = r.w * r.h
        val s = IntArray(n).also { srcBitmap.readPixels(it, r.sx, r.sy, r.w, r.h) }
        val d = IntArray(n).also { dstBitmap.readPixels(it, r.dx, r.dy, r.w, r.h) }
        val fn = transferFunction(function)
        for (i in 0 until n) {
            val sp = s[i]
            val dp = d[i]
            val red = fn(sp ushr 16 and 0xFF, dp ushr 16 and 0xFF) and 0xFF
            val green = fn(sp ushr 8 and 0xFF, dp ushr 8 and 0xFF) and 0xFF
            val blue = fn(sp and 0xFF, dp and 0xFF) and 0xFF
            d[i] = (dp and 0xFF000000.toInt()) or (red shl 16) or (green shl 8) or blue
        }
        val result = imageBitmapFromArgb(d, r.w, r.h)
        dst.canvas?.drawImage(result, Offset(r.dx.toFloat(), r.dy.toFloat()), Paint().apply { blendMode = BlendMode.Src })
        dirty = true
    }

    private fun blit(src: GuacLayer, srcX: Int, srcY: Int, width: Int, height: Int, dst: GuacLayer, dstX: Int, dstY: Int, paint: Paint) {
        dst.fitRect(dstX, dstY, width, height)
        val r = clampCopy(src, srcX, srcY, width, height, dst, dstX, dstY) ?: return
        var image = src.bitmap ?: return
        var sx = r.sx
        var sy = r.sy
        if (src === dst) {
            val tmp = ImageBitmap(r.w, r.h)
            Canvas(tmp).drawImageRect(image, IntOffset(sx, sy), IntSize(r.w, r.h), IntOffset.Zero, IntSize(r.w, r.h), Paint().apply { blendMode = BlendMode.Src })
            image = tmp
            sx = 0
            sy = 0
        }
        dst.draw { it.drawImageRect(image, IntOffset(sx, sy), IntSize(r.w, r.h), IntOffset(r.dx, r.dy), IntSize(r.w, r.h), paint) }
        dirty = true
    }

    fun rect(layer: Int, x: Int, y: Int, width: Int, height: Int) {
        val l = layer(layer)
        l.fitRect(x, y, width, height)
        l.currentPath().addRect(Rect(x.toFloat(), y.toFloat(), (x + width).toFloat(), (y + height).toFloat()))
    }

    fun fillColor(layer: Int, channelMask: Int, r: Int, g: Int, b: Int, a: Int) {
        val l = layer(layer)
        l.channelMask = channelMask
        val path = l.takePath() ?: return
        val paint = l.paint().apply { color = Color(r, g, b, a) }
        l.draw { it.drawPath(path, paint) }
        dirty = true
    }

    fun move(layer: Int, parent: Int, x: Int, y: Int, z: Int) {
        val l = layer(layer)
        val p = layer(parent)
        if (l.parent !== p) {
            l.parent?.children?.remove(l)
            p.children.add(l)
            l.parent = p
        }
        l.x = x
        l.y = y
        l.z = z
        dirty = true
    }

    fun shade(layer: Int, alpha: Int) {
        layer(layer).opacity = alpha.coerceIn(0, 255)
        dirty = true
    }

    fun dispose(layer: Int) {
        val l = layers.remove(layer) ?: return
        l.parent?.children?.remove(l)
        l.parent = null
        l.release()
        dirty = true
    }

    fun setCursor(hotspotX: Int, hotspotY: Int, srcLayer: Int, srcX: Int, srcY: Int, width: Int, height: Int) {
        val src = existing(srcLayer)?.bitmap
        val image = if (src != null && width > 0 && height > 0) {
            ImageBitmap(width, height).also {
                Canvas(it).drawImageRect(src, IntOffset(srcX, srcY), IntSize(width, height), IntOffset.Zero, IntSize(width, height), Paint())
            }
        } else null
        _cursor.value = _cursor.value.copy(image = image, hotspotX = hotspotX, hotspotY = hotspotY)
    }

    fun showCursor(visible: Boolean) {
        _cursor.value = _cursor.value.copy(visible = visible)
    }

    fun moveCursor(x: Double, y: Double) {
        _cursor.value = _cursor.value.copy(x = x, y = y)
    }

    fun flush(timestamp: Long, frames: Int) {
        if (!dirty && frame != null) return
        val root = existing(0) ?: return
        if (root.width <= 0 || root.height <= 0) return
        frameIndex = 1 - frameIndex
        var target = this.frames[frameIndex]
        if (target == null || target.width != root.width || target.height != root.height) {
            target = ImageBitmap(root.width, root.height)
            this.frames[frameIndex] = target
        }
        val canvas = Canvas(target)
        root.bitmap?.let { canvas.drawImage(it, Offset.Zero, Paint().apply { blendMode = BlendMode.Src }) }
        drawChildren(canvas, root, 1f)
        dirty = false
        frame = target
        _frameVersion.value++
        _hasFrame.value = true
    }

    private fun drawChildren(canvas: Canvas, layer: GuacLayer, alpha: Float) {
        if (layer.children.isEmpty()) return
        canvas.save()
        canvas.clipRect(0f, 0f, layer.width.toFloat(), layer.height.toFloat())
        for (child in layer.children.sortedBy { it.z }) {
            val childAlpha = alpha * child.opacity / 255f
            if (childAlpha <= 0f) continue
            canvas.save()
            canvas.translate(child.x.toFloat(), child.y.toFloat())
            child.bitmap?.let { canvas.drawImage(it, Offset.Zero, Paint().apply { this.alpha = childAlpha }) }
            drawChildren(canvas, child, childAlpha)
            canvas.restore()
        }
        canvas.restore()
    }

    fun disposeAll() {
        layers.values.forEach { it.release() }
        layers.clear()
    }

    private class CopyRect(val sx: Int, val sy: Int, val dx: Int, val dy: Int, val w: Int, val h: Int)

    private fun clampCopy(src: GuacLayer, srcX: Int, srcY: Int, width: Int, height: Int, dst: GuacLayer, dstX: Int, dstY: Int): CopyRect? {
        var sx = srcX; var sy = srcY; var dx = dstX; var dy = dstY; var w = width; var h = height
        if (sx < 0) { w += sx; dx -= sx; sx = 0 }
        if (sy < 0) { h += sy; dy -= sy; sy = 0 }
        if (dx < 0) { w += dx; sx -= dx; dx = 0 }
        if (dy < 0) { h += dy; sy -= dy; dy = 0 }
        w = min(w, min(src.width - sx, dst.width - dx))
        h = min(h, min(src.height - sy, dst.height - dy))
        return if (w > 0 && h > 0) CopyRect(sx, sy, dx, dy, w, h) else null
    }

    private companion object {
        const val TRANSFER_SRC = 0x3

        fun transferFunction(index: Int): (Int, Int) -> Int = when (index) {
            0x0 -> { _, _ -> 0 }
            0x1 -> { s, d -> s and d }
            0x2 -> { s, d -> s and d.inv() }
            0x4 -> { s, d -> s.inv() and d }
            0x5 -> { _, d -> d }
            0x6 -> { s, d -> s xor d }
            0x7 -> { s, d -> s or d }
            0x8 -> { s, d -> (s or d).inv() }
            0x9 -> { s, d -> (s xor d).inv() }
            0xA -> { _, d -> d.inv() }
            0xB -> { s, d -> s or d.inv() }
            0xC -> { s, _ -> s.inv() }
            0xD -> { s, d -> s.inv() or d }
            0xE -> { s, d -> (s and d).inv() }
            0xF -> { _, _ -> 0xFF }
            else -> { s, _ -> s }
        }
    }
}

internal fun blendModeFor(mask: Int): BlendMode = when (mask) {
    0x1 -> BlendMode.DstIn
    0x2 -> BlendMode.DstOut
    0x4 -> BlendMode.SrcIn
    0x6 -> BlendMode.SrcAtop
    0x8 -> BlendMode.SrcOut
    0x9 -> BlendMode.DstAtop
    0xA -> BlendMode.Xor
    0xB -> BlendMode.DstOver
    0xC -> BlendMode.Src
    0xF -> BlendMode.Plus
    else -> BlendMode.SrcOver
}

internal class GuacLayer(val index: Int) {
    var width = 0
    var height = 0
    var bitmap: ImageBitmap? = null
    var canvas: Canvas? = null

    var parent: GuacLayer? = null
    val children = mutableListOf<GuacLayer>()
    var x = 0
    var y = 0
    var z = 0
    var opacity = 255

    var channelMask = DEFAULT_MASK
    var path: Path? = null

    private val autosize get() = index < 0

    fun resize(newWidth: Int, newHeight: Int) {
        if (newWidth == width && newHeight == height) return
        val old = bitmap
        width = newWidth
        height = newHeight
        if (newWidth <= 0 || newHeight <= 0) {
            bitmap = null
            canvas = null
            return
        }
        val bmp = ImageBitmap(newWidth, newHeight)
        val c = Canvas(bmp)
        if (old != null) c.drawImage(old, Offset.Zero, Paint().apply { blendMode = BlendMode.Src })
        bitmap = bmp
        canvas = c
    }

    fun fitRect(x: Int, y: Int, w: Int, h: Int) {
        if (!autosize) return
        val newWidth = max(width, x + w)
        val newHeight = max(height, y + h)
        if (newWidth != width || newHeight != height) resize(newWidth, newHeight)
    }

    fun paint() = Paint().apply { blendMode = blendModeFor(channelMask) }

    inline fun draw(block: (Canvas) -> Unit) {
        canvas?.let(block)
    }

    fun currentPath(): Path = path ?: Path().also { path = it }

    fun takePath(): Path? = path.also { path = null }

    fun release() {
        bitmap = null
        canvas = null
        children.clear()
    }

    companion object {
        const val DEFAULT_MASK = 0xE
    }
}

internal expect fun imageBitmapFromArgb(pixels: IntArray, width: Int, height: Int): ImageBitmap
