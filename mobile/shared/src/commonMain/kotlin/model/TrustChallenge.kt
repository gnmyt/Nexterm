package dev.gnm.nexterm.model

import kotlinx.serialization.Serializable

@Serializable
data class TrustChallenge(
    val kind: String = "tls",
    val host: String = "",
    val port: Int = 0,
    val algorithm: String? = null,
    val fingerprint: String = "",
    val certificate: Certificate? = null,
    val status: String = "new",
    val organizationName: String? = null,
    val canAccept: Boolean = true,
    val previous: Previous? = null,
) {
    @Serializable
    data class Certificate(val subject: String? = null, val issuer: String? = null, val selfSigned: Boolean = false, val validTo: String? = null)

    @Serializable
    data class Previous(val fingerprint: String = "")

    data class Fact(val label: String, val value: String)

    val isChanged: Boolean get() = status == "changed"
    val canTrust: Boolean get() = !isChanged || canAccept
    private val subject: String get() = if (kind == "ssh") "host key" else "certificate"
    val endpoint: String get() = "$host:$port"

    val title: String get() = if (isChanged) "The $subject has changed" else "Trust this $subject?"
    val message: String
        get() = if (isChanged) "$endpoint presents a different $subject than before. Only continue if you expect this."
        else "This is the first connection to $endpoint. Check the fingerprint before you continue."

    val previousFingerprint: String? get() = previous?.fingerprint?.takeIf { isChanged && it.isNotEmpty() }
    val previousLabel: String get() = "Trusted until now"
    val fingerprintLabel: String get() = if (isChanged) "Presented now" else "Fingerprint"

    val facts: List<Fact>
        get() = listOfNotNull(
            certificate?.subject?.let { Fact("Issued to", it) },
            (if (certificate?.selfSigned == true) "Self-signed" else certificate?.issuer)?.let { Fact("Issued by", it) },
            formatDate(certificate?.validTo)?.let { Fact("Valid until", it) },
        )

    val blockedHint: String? get() = if (canAccept) null else "Only certificate managers of ${organizationName ?: "this organization"} can accept this change."
    val acceptLabel: String get() = if (isChanged) "Trust the new one" else "Trust and connect"
    val cancelLabel: String get() = if (isChanged) "Disconnect" else "Cancel"

    private companion object {
        val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

        fun formatDate(iso: String?): String? {
            val parts = iso?.take(10)?.split('-')?.mapNotNull { it.toIntOrNull() } ?: return null
            if (parts.size != 3 || parts[1] !in 1..12) return null
            return "${MONTHS[parts[1] - 1]} ${parts[2]}, ${parts[0]}"
        }
    }
}
