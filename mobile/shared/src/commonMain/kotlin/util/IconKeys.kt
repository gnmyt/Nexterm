package dev.gnm.nexterm.util

import dev.gnm.nexterm.model.MonitoringServer
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.model.ServerFolder
import dev.gnm.nexterm.model.SftpEntry

enum class ColorRole { PRIMARY, TERTIARY, OUTLINE, ON_SURFACE_VARIANT, PINK, PURPLE, ORANGE, AMBER, RED }

object IconKeys {
    fun server(server: Server): String {
        when (server.type) {
            "pve-lxc" -> return "cube-outline"
            "pve-qemu" -> return "monitor"
            "pve-shell" -> return "console"
        }
        when (server.protocolLower) {
            "rdp" -> return "microsoft-windows"
            "vnc" -> return "remote-desktop"
        }
        return mdiToKebab(server.icon) ?: "server"
    }

    fun serverColor(server: Server): ColorRole = when {
        server.isStopped -> ColorRole.OUTLINE
        server.isPve -> ColorRole.TERTIARY
        else -> ColorRole.PRIMARY
    }

    fun folder(folder: ServerFolder, expanded: Boolean): String = when {
        folder.isOrganization -> if (expanded) "domain" else "domain-off"
        folder.isPveNode -> "server"
        else -> if (expanded) "folder-open" else "folder"
    }

    fun folderColor(folder: ServerFolder): ColorRole =
        if (!folder.isOrganization && folder.isPveNode) ColorRole.TERTIARY else ColorRole.PRIMARY

    fun file(entry: SftpEntry): String {
        if (entry.isDir) return "folder"
        if (entry.isSymlink) return "link-variant"
        return when (entry.extension) {
            "txt", "md", "log" -> "file-document-outline"
            "pdf" -> "file-pdf-box"
            "jpg", "jpeg", "png", "gif", "webp", "svg" -> "file-image-outline"
            "mp4", "avi", "mov", "mkv" -> "file-video-outline"
            "mp3", "wav", "flac", "ogg" -> "file-music-outline"
            "zip", "tar", "gz", "bz2", "xz", "7z", "rar" -> "zip-box-outline"
            "json", "xml", "yaml", "yml", "toml" -> "code-json"
            "js", "ts", "py", "dart", "java", "c", "cpp", "h", "rs", "go", "rb", "php", "sh", "bash" -> "file-code-outline"
            "conf", "cfg", "ini", "env" -> "file-cog-outline"
            "db", "sqlite", "sql" -> "database-outline"
            else -> "file-outline"
        }
    }

    fun fileColor(entry: SftpEntry): ColorRole {
        if (entry.isDir) return ColorRole.PRIMARY
        if (entry.isSymlink) return ColorRole.TERTIARY
        return when (entry.extension) {
            "jpg", "jpeg", "png", "gif", "webp", "svg" -> ColorRole.PINK
            "mp4", "avi", "mov", "mkv" -> ColorRole.PURPLE
            "mp3", "wav", "flac", "ogg" -> ColorRole.ORANGE
            "zip", "tar", "gz", "7z", "rar" -> ColorRole.AMBER
            "pdf" -> ColorRole.RED
            else -> ColorRole.ON_SURFACE_VARIANT
        }
    }

    fun monitoringServer(server: MonitoringServer): String = if (server.isPve) "server-network" else "server"

    fun userAgent(ua: String?): String {
        if (ua == null) return "devices"
        if (ua.startsWith("NextermConnector/")) return "application"
        if (ua.startsWith("NextermMobile/")) return "cellphone-link"
        val l = ua.lowercase()
        return when {
            "mobile" in l || "android" in l || "iphone" in l -> "cellphone"
            "tablet" in l || "ipad" in l -> "tablet"
            "mac" in l || "windows" in l || "linux" in l -> "laptop"
            else -> "devices"
        }
    }

    fun mdiToKebab(icon: String?): String? {
        if (icon == null || !icon.startsWith("mdi") || icon.length < 4) return null
        return icon.substring(3).replace(Regex("(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])"), "-").lowercase()
    }
}
