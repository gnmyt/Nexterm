@file:OptIn(ExperimentalForeignApi::class)

package dev.gnm.nexterm.terminal

import dev.gnm.nexterm.terminal.cinterop.*
import kotlinx.cinterop.*

internal actual object Vt {
    private fun vt(h: Long): CPointer<NxtVt>? = h.toCPointer()

    private inline fun <R> ByteArray.bytes(block: (CPointer<UByteVar>?) -> R): R =
        if (isEmpty()) block(null) else usePinned { block(it.addressOf(0).reinterpret()) }

    private inline fun take(h: Long, fn: (CPointer<NxtVt>?, CPointer<UByteVar>?, ULong) -> ULong): ByteArray {
        val out = ByteArray(fn(vt(h), null, 0u).toInt())
        out.bytes { fn(vt(h), it, out.size.toULong()) }
        return out
    }

    actual fun create(cols: Int, rows: Int, scrollback: Int): Long =
        nxt_new(cols.toUShort(), rows.toUShort(), scrollback.toUInt()).rawValue.toLong()

    actual fun free(h: Long) = nxt_free(vt(h))

    actual fun write(h: Long, data: ByteArray, len: Int): Int = data.bytes { nxt_write(vt(h), it, len.toULong()) }

    actual fun resize(h: Long, cols: Int, rows: Int, cw: Int, ch: Int) =
        nxt_resize(vt(h), cols.toUShort(), rows.toUShort(), cw.toUInt(), ch.toUInt())

    actual fun setColors(h: Long, fg: Int, bg: Int, cursor: Int, palette: IntArray) = palette.usePinned {
        nxt_set_colors(vt(h), fg.toUInt(), bg.toUInt(), cursor.toUInt(), it.addressOf(0).reinterpret())
    }

    actual fun takeOutput(h: Long): ByteArray? = take(h, ::nxt_take_output)

    actual fun snapshot(h: Long, cps: IntArray, fg: IntArray, bg: IntArray, flags: IntArray, extra: IntArray, info: IntArray): Boolean =
        cps.usePinned { c ->
            fg.usePinned { f ->
                bg.usePinned { b ->
                    flags.usePinned { fl ->
                        extra.usePinned { e ->
                            info.usePinned { i ->
                                nxt_snapshot(vt(h), c.addressOf(0), f.addressOf(0), b.addressOf(0), fl.addressOf(0), cps.size,
                                    e.addressOf(0), extra.size, i.addressOf(0)) != 0
                            }
                        }
                    }
                }
            }
        }

    actual fun scroll(h: Long, kind: Int, delta: Long) = nxt_scroll(vt(h), kind, delta)

    actual fun mode(h: Long, mode: Int, ansi: Boolean): Boolean = nxt_mode(vt(h), mode.toUShort(), if (ansi) 1 else 0) != 0

    actual fun key(h: Long, key: Int, mods: Int, utf8: ByteArray?, unshifted: Int): Boolean =
        (utf8 ?: ByteArray(0)).bytes { nxt_key(vt(h), key, mods, it, (utf8?.size ?: 0).toULong(), unshifted.toUInt()) != 0 }

    actual fun mouse(h: Long, action: Int, button: Int, mods: Int, x: Float, y: Float, sw: Int, sh: Int, cw: Int, ch: Int): Boolean =
        nxt_mouse(vt(h), action, button, mods, x, y, sw.toUInt(), sh.toUInt(), cw.toUInt(), ch.toUInt()) != 0

    actual fun text(h: Long, data: ByteArray) = data.bytes { nxt_text(vt(h), it, data.size.toULong()) }

    actual fun paste(h: Long, data: ByteArray) = data.bytes { nxt_paste(vt(h), it, data.size.toULong()) }

    actual fun selectWords(h: Long, x1: Int, y1: Int, x2: Int, y2: Int): Boolean =
        nxt_select_words(vt(h), x1.toUShort(), y1.toUShort(), x2.toUShort(), y2.toUShort()) != 0

    actual fun clearSelection(h: Long) = nxt_select_clear(vt(h))

    actual fun selectionText(h: Long): ByteArray? = if (nxt_selection_text(vt(h)) < 0) null else take(h, ::nxt_take_string)
}
