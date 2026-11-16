package dev.gnm.nexterm.api

import dev.gnm.nexterm.util.Uris

data class DeviceLinkPayload(val token: String, val server: String)

data class AuthorizePayload(val code: String, val server: String)

object QrPayloads {
    fun parseDeviceLink(raw: String): DeviceLinkPayload? {
        val uri = Uris.parse(raw) ?: return null
        if (uri.scheme != "nexterm" || uri.host != "devicelink") return null
        val token = uri.query["token"] ?: return null
        val server = uri.query["server"] ?: return null
        return DeviceLinkPayload(token, Uris.decodeComponent(server))
    }

    fun parseAuthorize(raw: String): AuthorizePayload? {
        val uri = Uris.parse(raw) ?: return null
        if (uri.scheme != "nexterm" || uri.host != "authorize") return null
        val code = uri.query["code"] ?: return null
        val server = uri.query["server"] ?: return null
        return AuthorizePayload(code, Uris.decodeComponent(server))
    }

    fun normalizeServer(url: String): String {
        val u = url.trim().lowercase().trimEnd('/')
        return u.removeSuffix("/api")
    }
}
