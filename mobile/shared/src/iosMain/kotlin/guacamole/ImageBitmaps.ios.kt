package dev.gnm.nexterm.guacamole

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asComposeImageBitmap
import org.jetbrains.skia.Bitmap
import org.jetbrains.skia.ColorAlphaType
import org.jetbrains.skia.ColorType
import org.jetbrains.skia.ImageInfo

internal actual fun imageBitmapFromArgb(pixels: IntArray, width: Int, height: Int): ImageBitmap {
    val bytes = ByteArray(pixels.size * 4)
    for (i in pixels.indices) {
        val p = pixels[i]
        val o = i * 4
        bytes[o] = p.toByte()
        bytes[o + 1] = (p shr 8).toByte()
        bytes[o + 2] = (p shr 16).toByte()
        bytes[o + 3] = (p shr 24).toByte()
    }
    val info = ImageInfo(width, height, ColorType.BGRA_8888, ColorAlphaType.UNPREMUL)
    val bitmap = Bitmap()
    bitmap.allocPixels(info)
    bitmap.installPixels(info, bytes, width * 4)
    return bitmap.asComposeImageBitmap()
}
