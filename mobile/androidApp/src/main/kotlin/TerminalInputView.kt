package dev.gnm.nexterm.app

import android.content.Context
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager

class TerminalInputView(
    context: Context,
    private val onText: (String) -> Unit,
    private val onKey: (KeyEvent) -> Boolean,
) : View(context) {
    init {
        isFocusable = true
        isFocusableInTouchMode = true
    }

    fun showKeyboard() {
        requestFocus()
        context.getSystemService(InputMethodManager::class.java).showSoftInput(this, InputMethodManager.SHOW_IMPLICIT)
    }

    override fun onCheckIsTextEditor() = true

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
        outAttrs.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD or
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_ACTION_NONE
        return object : BaseInputConnection(this, true) {
            override fun commitText(text: CharSequence, newCursorPosition: Int): Boolean {
                super.commitText(text, newCursorPosition)
                flush()
                return true
            }

            override fun finishComposingText(): Boolean {
                super.finishComposingText()
                flush()
                return true
            }

            override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
                if (editable?.isNotEmpty() == true) return super.deleteSurroundingText(beforeLength, afterLength)
                repeat(beforeLength.coerceAtLeast(1)) { onText("\u007f") }
                return true
            }

            override fun sendKeyEvent(event: KeyEvent): Boolean = dispatchKeyEvent(event)

            private fun flush() {
                val editable = editable ?: return
                editable.toString().takeIf { it.isNotEmpty() }?.let { onText(it.replace('\n', '\r')) }
                editable.clear()
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (onKey(event)) return true
        when (keyCode) {
            KeyEvent.KEYCODE_DEL -> onText("\u007f")
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> onText("\r")
            else -> event.unicodeChar.takeIf { it != 0 }?.let { onText(String(Character.toChars(it))) }
                ?: return super.onKeyDown(keyCode, event)
        }
        return true
    }
}
