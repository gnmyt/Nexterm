package dev.gnm.nexterm.model

data class DeviceCodeResponse(val code: String, val token: String, val error: String?)

data class DevicePollResponse(val status: String, val token: String?) {
    val isAuthorized: Boolean get() = status == "authorized"
    val isInvalid: Boolean get() = status == "invalid"
}
