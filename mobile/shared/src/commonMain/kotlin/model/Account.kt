package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Flag
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.time.Instant

@Serializable
data class ServerAccount(
    val id: String,
    val label: String,
    val baseUrl: String,
    val token: String,
    val username: String? = null,
    val fullName: String? = null,
) {
    val displayUrl: String get() = baseUrl.replace(Regex("https?://"), "").replace("/api", "")
    val subtitle: String get() = fullName ?: username ?: displayUrl
    val displayName: String get() = fullName ?: username ?: "User"
}

@Serializable
internal class UserInfo(val username: String = "", val firstName: String = "", val lastName: String = "") {
    val fullName: String get() = "$firstName $lastName"
}

@Serializable
class SessionModel(
    val id: String = "",
    val userAgent: String? = null,
    val ip: String? = null,
    @SerialName("lastActivity") private val lastActivityIso: String? = null,
    val current: Flag? = null,
) {
    val lastActivity: Long? get() = lastActivityIso?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() }
}
