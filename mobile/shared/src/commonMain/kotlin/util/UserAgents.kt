package dev.gnm.nexterm.util

object UserAgents {
    private val connector = Regex("^NextermConnector/([\\d.]+)\\s*\\(([^;]+);")
    private val mobile = Regex("^NextermMobile/([\\d.]+)\\s*\\(([^;)]+)")

    fun deviceLabel(ua: String?): String {
        if (ua == null) return "Unknown Device"
        connector.find(ua)?.let { return "Connector ${it.groupValues[1]} · ${it.groupValues[2].trim()}" }
        mobile.find(ua)?.let {
            val p = it.groupValues[2].trim()
            return "Mobile ${it.groupValues[1]} · ${p.replaceFirstChar { c -> c.uppercaseChar() }}"
        }
        for (b in listOf("Chrome", "Firefox", "Safari", "Edge")) {
            if (ua.contains(b) && (b != "Safari" || !ua.contains("Chrome"))) {
                for (os in listOf("Windows", "Mac", "Linux", "Android", "iPhone", "iPad")) if (ua.contains(os)) return "$b · $os"
                return b
            }
        }
        return "Unknown Device"
    }
}
