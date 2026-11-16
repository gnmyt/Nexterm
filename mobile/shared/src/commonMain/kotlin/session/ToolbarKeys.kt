package dev.gnm.nexterm.session

import dev.gnm.nexterm.terminal.TerminalKey

enum class ToolbarKey(val label: String, internal val key: TerminalKey?, val isCompact: Boolean, internal val ctrl: Boolean = false) {
    CTRL("CTRL", null, false),
    ALT("ALT", null, false),
    ESC("ESC", TerminalKey.ESCAPE, false),
    TAB("TAB", TerminalKey.TAB, false),
    CTRL_C("^C", TerminalKey.C, true, ctrl = true),
    CTRL_Z("^Z", TerminalKey.Z, true, ctrl = true),
    CTRL_D("^D", TerminalKey.D, true, ctrl = true),
    UP("↑", TerminalKey.ARROW_UP, true),
    DOWN("↓", TerminalKey.ARROW_DOWN, true),
    LEFT("←", TerminalKey.ARROW_LEFT, true),
    RIGHT("→", TerminalKey.ARROW_RIGHT, true),
    HOME("HOME", TerminalKey.HOME, true),
    END("END", TerminalKey.END, true),
    PAGE_UP("PGUP", TerminalKey.PAGE_UP, true),
    PAGE_DOWN("PGDN", TerminalKey.PAGE_DOWN, true),
    F1("F1", TerminalKey.F1, true), F2("F2", TerminalKey.F2, true), F3("F3", TerminalKey.F3, true), F4("F4", TerminalKey.F4, true),
    F5("F5", TerminalKey.F5, true), F6("F6", TerminalKey.F6, true), F7("F7", TerminalKey.F7, true), F8("F8", TerminalKey.F8, true),
    F9("F9", TerminalKey.F9, true), F10("F10", TerminalKey.F10, true), F11("F11", TerminalKey.F11, true), F12("F12", TerminalKey.F12, true);

    val isToggle: Boolean get() = key == null
}
