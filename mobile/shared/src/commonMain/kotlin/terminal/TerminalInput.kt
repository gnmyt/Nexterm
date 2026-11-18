package dev.gnm.nexterm.terminal

enum class TerminalKey(internal val code: Int, internal val char: Char = '\u0000') {
    A(20, 'a'), B(21, 'b'), C(22, 'c'), D(23, 'd'), E(24, 'e'), F(25, 'f'), G(26, 'g'), H(27, 'h'), I(28, 'i'),
    J(29, 'j'), K(30, 'k'), L(31, 'l'), M(32, 'm'), N(33, 'n'), O(34, 'o'), P(35, 'p'), Q(36, 'q'), R(37, 'r'),
    S(38, 's'), T(39, 't'), U(40, 'u'), V(41, 'v'), W(42, 'w'), X(43, 'x'), Y(44, 'y'), Z(45, 'z'),
    DIGIT_0(6, '0'), DIGIT_1(7, '1'), DIGIT_2(8, '2'), DIGIT_3(9, '3'), DIGIT_4(10, '4'),
    DIGIT_5(11, '5'), DIGIT_6(12, '6'), DIGIT_7(13, '7'), DIGIT_8(14, '8'), DIGIT_9(15, '9'),
    BACKQUOTE(1, '`'), BACKSLASH(2, '\\'), BRACKET_LEFT(3, '['), BRACKET_RIGHT(4, ']'), COMMA(5, ','),
    EQUAL(16, '='), MINUS(46, '-'), PERIOD(47, '.'), QUOTE(48, '\''), SEMICOLON(49, ';'), SLASH(50, '/'),
    SPACE(63, ' '),
    BACKSPACE(53), ENTER(58), TAB(64), ESCAPE(120),
    DELETE(68), END(69), HOME(71), INSERT(72), PAGE_DOWN(73), PAGE_UP(74),
    ARROW_DOWN(75), ARROW_LEFT(76), ARROW_RIGHT(77), ARROW_UP(78),
    F1(121), F2(122), F3(123), F4(124), F5(125), F6(126), F7(127), F8(128), F9(129), F10(130), F11(131), F12(132);

    companion object {
        fun forChar(c: Char): TerminalKey? = entries.firstOrNull { it.char != '\u0000' && it.char == c.lowercaseChar() }

        fun function(n: Int): TerminalKey = entries[F1.ordinal + n - 1]
    }
}

enum class TerminalMouseButton(internal val code: Int) { NONE(0), LEFT(1), RIGHT(2), MIDDLE(3), WHEEL_UP(4), WHEEL_DOWN(5) }

enum class TerminalMouseAction { PRESS, RELEASE, MOTION }

enum class TerminalCursorStyle { BAR, BLOCK, UNDERLINE, BLOCK_HOLLOW }

internal fun mods(ctrl: Boolean, alt: Boolean, shift: Boolean): Int =
    (if (shift) 1 else 0) or (if (ctrl) 2 else 0) or (if (alt) 4 else 0)
