package dev.gnm.nexterm.session

import dev.gnm.nexterm.model.SftpEntry
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.arr
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.parseJsonOrNull
import dev.gnm.nexterm.util.str
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

enum class SftpOperation(val code: Int) {
    READY(0x0), LIST_FILES(0x1), CREATE_FOLDER(0x5), DELETE_FILE(0x6), DELETE_FOLDER(0x7), RENAME_FILE(0x8), ERROR(0x9);

    companion object {
        fun fromCode(code: Int): SftpOperation? = entries.firstOrNull { it.code == code }
    }
}

class SftpFrame(val opCode: Int, val payload: String) {
    val operation: SftpOperation? get() = SftpOperation.fromCode(opCode)
    fun json(): JsonElement? = if (payload.isEmpty()) null else parseJsonOrNull(payload)

    val errorMessage: String
        get() = json().asObject()?.str("message") ?: payload.ifEmpty { "Unknown error" }
}

object SftpProtocol {
    internal fun encode(operation: SftpOperation, payload: JsonObject): ByteArray {
        val body = NextermJson.encodeToString(JsonObject.serializer(), payload).encodeToByteArray()
        return ByteArray(1 + body.size).also {
            it[0] = operation.code.toByte()
            body.copyInto(it, 1)
        }
    }

    fun decode(bytes: ByteArray): SftpFrame? {
        if (bytes.isEmpty()) return null
        val payload = if (bytes.size > 1) bytes.decodeToString(1, bytes.size) else ""
        return SftpFrame(bytes[0].toInt() and 0xFF, payload)
    }

    fun decodeText(text: String): SftpFrame? = if (text.isEmpty()) null else SftpFrame(text[0].code, text.substring(1))

    fun parseListing(payload: String): List<SftpEntry> {
        val decoded = NextermJson.parseToJsonElement(payload)
        val files = (decoded as? JsonArray) ?: decoded.asObject()?.arr("files") ?: JsonArray(emptyList())
        return NextermJson.decodeFromJsonElement(ListSerializer(SftpEntry.serializer()), files)
    }

    fun join(dir: String, name: String): String = if (dir == "/") "/$name" else "$dir/$name"

    fun parent(path: String): String {
        if (path == "/") return "/"
        val parent = path.split('/').dropLast(1).joinToString("/")
        return parent.ifEmpty { "/" }
    }
}
