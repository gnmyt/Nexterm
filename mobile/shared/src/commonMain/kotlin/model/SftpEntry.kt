package dev.gnm.nexterm.model

import dev.gnm.nexterm.util.Flag
import dev.gnm.nexterm.util.Formatters
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SftpEntry(
    val name: String = "",
    private val type: String? = null,
    @SerialName("isDir") private val dir: Flag = false,
    val isSymlink: Flag = false,
    val size: Long = 0,
    @SerialName("last_modified") private val lastModified: Long? = null,
    @SerialName("mtime") private val modified: Long? = null,
) {
    val isDir: Boolean get() = type == "folder" || dir
    val mtime: Long get() = lastModified ?: modified ?: 0
    val formattedSize: String get() = if (isDir) "" else Formatters.bytes(size)
    val extension: String
        get() {
            if (isDir) return ""
            val dot = name.lastIndexOf('.')
            return if (dot > 0) name.substring(dot + 1).lowercase() else ""
        }
    val isHidden: Boolean get() = name.startsWith(".")
    val subtitle: String
        get() = listOfNotNull(
            formattedSize.takeIf { !isDir },
            if (mtime > 0) Formatters.relativeTime(mtime * 1000) else null,
        ).joinToString(" • ")
}
