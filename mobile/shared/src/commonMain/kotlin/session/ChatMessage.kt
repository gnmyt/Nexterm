package dev.gnm.nexterm.session

import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.boolOrNull
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.str
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

enum class ChatRole { USER, ASSISTANT, SYSTEM, TOOL }

enum class ToolStatus { RUNNING, AWAITING_CONFIRM, DONE, DENIED, ABORTED, ERROR }

data class AIToolInfo(val label: String, val iconKey: String)

data class DirectoryItem(val name: String, val isFolder: Boolean) {
    val displayName: String get() = if (isFolder) "$name/" else name
}

data class ChatMessage(
    val id: Int,
    val role: ChatRole,
    val text: String,
    val isStreaming: Boolean,
    val callId: String?,
    val tool: String?,
    val args: JsonObject,
    val status: ToolStatus?,
    val result: JsonElement?,
    val error: String?,
) {
    private val resultObject: JsonObject? get() = result.asObject()
    private val isDeniedResult: Boolean get() = resultObject?.boolOrNull("denied") == true

    val toolInfo: AIToolInfo? get() = AITools.info(tool)
    val toolLabel: String get() = toolInfo?.label ?: tool ?: "Tool"
    val toolIconKey: String get() = toolInfo?.iconKey ?: "console-line"
    val summary: String get() = AITools.summary(tool, args)
    val isAwaitingConfirmation: Boolean get() = status == ToolStatus.AWAITING_CONFIRM

    val exitCode: Int?
        get() = if (tool == "runCommand" && status == ToolStatus.DONE && !isDeniedResult) resultObject?.int("exitCode") else null
    val isFailed: Boolean get() = exitCode.let { it != null && it != 0 }

    val note: String?
        get() = when (status) {
            ToolStatus.DENIED -> "You denied this action."
            ToolStatus.ABORTED -> "Stopped."
            ToolStatus.ERROR -> error ?: "Failed."
            else -> null
        }

    private val visibleResult: JsonObject? get() = if (status == ToolStatus.DONE && !isDeniedResult) resultObject else null
    val stdout: String? get() = visibleResult?.takeIf { tool == "runCommand" }?.str("stdout")?.takeIf { it.isNotEmpty() }
    val stderr: String? get() = visibleResult?.takeIf { tool == "runCommand" }?.str("stderr")?.takeIf { it.isNotEmpty() }
    val fileContent: String?
        get() = visibleResult?.takeIf { tool == "readFile" }?.let {
            (it.str("content") ?: "") + if (it.boolOrNull("truncated") == true) "\n… [truncated]" else ""
        }
    val directoryEntries: List<DirectoryItem>
        get() = (visibleResult?.takeIf { tool == "listDirectory" }?.get("entries") as? JsonArray).orEmpty()
            .mapNotNull { it.asObject() }.map { DirectoryItem(it.str("name") ?: "null", it.str("type") == "folder") }
}

object AITools {
    private val tools = mapOf(
        "runCommand" to AIToolInfo("Run command", "console-line"),
        "readFile" to AIToolInfo("Read file", "file-document-outline"),
        "writeFile" to AIToolInfo("Write file", "file-edit-outline"),
        "editFile" to AIToolInfo("Edit file", "file-edit-outline"),
        "listDirectory" to AIToolInfo("List directory", "folder-outline"),
        "statPath" to AIToolInfo("Inspect path", "information-outline"),
        "makeDirectory" to AIToolInfo("Create directory", "folder-plus-outline"),
        "deleteFile" to AIToolInfo("Delete file", "trash-can-outline"),
        "removeDirectory" to AIToolInfo("Remove directory", "trash-can-outline"),
        "movePath" to AIToolInfo("Move", "file-move-outline"),
        "changePermissions" to AIToolInfo("Change permissions", "lock-outline"),
        "findDirectories" to AIToolInfo("Find directories", "magnify"),
    )

    fun info(tool: String?): AIToolInfo? = tool?.let { tools[it] }

    fun summary(tool: String?, a: JsonObject): String {
        fun arg(k: String) = a.str(k) ?: ""
        return when (tool) {
            "runCommand" -> arg("command")
            "readFile", "writeFile", "editFile", "listDirectory", "statPath", "makeDirectory", "deleteFile" -> arg("path")
            "removeDirectory" -> if (a.boolOrNull("recursive") == true) "${arg("path")} (recursive)" else arg("path")
            "movePath" -> "${arg("source")} → ${arg("destination")}"
            "changePermissions" -> "${arg("path")} → ${arg("mode")}"
            "findDirectories" -> arg("query")
            else -> ""
        }
    }
}
