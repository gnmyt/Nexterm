package dev.gnm.nexterm.guacamole

data class GuacStatus(val code: Int, val message: String = "") {
    val isError: Boolean get() = code >= 0x0100

    companion object {
        const val SUCCESS = 0x0000
        const val UNSUPPORTED = 0x0100
        const val SERVER_ERROR = 0x0200
        const val UPSTREAM_TIMEOUT = 0x0202
        const val UPSTREAM_ERROR = 0x0203
    }
}
