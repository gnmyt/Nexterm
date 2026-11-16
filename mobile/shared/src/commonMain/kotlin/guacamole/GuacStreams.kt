package dev.gnm.nexterm.guacamole

class GuacInputStream(val index: Int) {
    var onBlob: ((String) -> Unit)? = null
    var onEnd: (() -> Unit)? = null
}

data class GuacMouseState(
    val x: Double = 0.0,
    val y: Double = 0.0,
    val left: Boolean = false,
    val right: Boolean = false,
    val up: Boolean = false,
    val down: Boolean = false,
) {
    val buttonMask: Int
        get() = (if (left) 1 else 0) or (if (right) 4 else 0) or
            (if (up) 8 else 0) or (if (down) 16 else 0)
}
