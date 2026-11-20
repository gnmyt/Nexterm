package dev.gnm.nexterm.session

import dev.gnm.nexterm.util.arr
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.boolOrNull
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.str
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.abs

enum class ChatRole { USER, ASSISTANT, SYSTEM, NOTE, TOOL }

enum class ToolStatus { RUNNING, AWAITING_CONFIRM, AWAITING_ANSWER, DONE, DENIED, ABORTED, ERROR }

data class AIToolInfo(val label: String, val iconKey: String)

data class DirectoryItem(val name: String, val isFolder: Boolean) {
    val displayName: String get() = if (isFolder) "$name/" else name
}

data class QuestionOption(val label: String, val description: String?)

data class ToolImage(val data: String, val mimeType: String)

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
    val summary: String get() = if (isQuestion) "" else AITools.summary(tool, args)
    val isAwaitingConfirmation: Boolean get() = status == ToolStatus.AWAITING_CONFIRM

    val isQuestion: Boolean get() = tool == AITools.ASK_USER
    val isAwaitingAnswer: Boolean get() = status == ToolStatus.AWAITING_ANSWER
    val question: String? get() = args.str("question")?.takeIf { isQuestion }
    val questionOptions: List<QuestionOption>
        get() = (args.arr("options")?.takeIf { isQuestion }).orEmpty().mapNotNull { it.asObject() }
            .mapNotNull { o -> o.str("label")?.let { QuestionOption(it, o.str("description")) } }
    val isMultiSelect: Boolean get() = args.boolOrNull("multiSelect") == true
    val allowsFreeText: Boolean get() = args.boolOrNull("allowFreeText") != false
    val answer: String?
        get() = resultObject?.takeIf { isQuestion && status == ToolStatus.DONE }?.get("answer")?.let { a ->
            when (a) {
                is JsonArray -> a.mapNotNull { (it as? JsonPrimitive)?.content }.joinToString(", ")
                is JsonPrimitive -> a.content
                else -> null
            }
        }

    private val visibleResult: JsonObject? get() = if (status == ToolStatus.DONE && !isDeniedResult) resultObject else null

    val exitCode: Int? get() = visibleResult?.int("exitCode")
    private val resultError: String? get() = visibleResult?.str("error")?.takeIf { it.isNotEmpty() }
    val isFailed: Boolean get() = exitCode.let { it != null && it != 0 } || resultError != null

    val note: String?
        get() = when (status) {
            ToolStatus.DENIED -> resultObject?.str("message") ?: "You denied this action."
            ToolStatus.ABORTED -> "Stopped."
            ToolStatus.ERROR -> error ?: "Failed."
            else -> null
        }

    val stdout: String?
        get() = visibleResult?.let {
            when (tool) {
                "run_command", "exec_command" -> it.str("stdout")
                "terminal_run" -> it.str("output")
                "terminal_read" -> it.str("output")?.takeIf { o -> o.isNotEmpty() } ?: it.str("screen")
                "desktop_clipboard_get" -> it.str("text")
                else -> null
            }
        }?.takeIf { it.isNotEmpty() }
    val stderr: String?
        get() = resultError ?: visibleResult?.takeIf { tool == "run_command" || tool == "exec_command" }?.str("stderr")?.takeIf { it.isNotEmpty() }
    val fileContent: String?
        get() = visibleResult?.takeIf { tool == "file_read" }?.let {
            (it.str("content") ?: "") + if (it.boolOrNull("truncated") == true) "\n… [truncated]" else ""
        }
    val directoryEntries: List<DirectoryItem>
        get() = (visibleResult?.takeIf { tool == "file_list" }?.get("entries") as? JsonArray).orEmpty()
            .mapNotNull { it.asObject() }.map { DirectoryItem(it.str("name") ?: "null", it.str("type") == "folder") }
    val images: List<ToolImage>
        get() = visibleResult?.arr("images").orEmpty().mapNotNull { it.asObject() }
            .mapNotNull { i -> i.str("data")?.let { ToolImage(it, i.str("mimeType") ?: "image/png") } }
}

object AITools {
    const val ASK_USER = "ask_user"

    private val tools = mapOf(
        "list_entries" to AIToolInfo("List servers", "format-list-bulleted"),
        "get_entry" to AIToolInfo("Inspect server", "information-outline"),
        "list_folders" to AIToolInfo("List folders", "folder-outline"),
        "list_organizations" to AIToolInfo("List organizations", "domain"),
        "list_identities" to AIToolInfo("List identities", "format-list-bulleted"),
        "list_snippets" to AIToolInfo("List snippets", "format-list-bulleted"),
        "list_scripts" to AIToolInfo("List scripts", "format-list-bulleted"),
        "list_tags" to AIToolInfo("List tags", "format-list-bulleted"),
        "list_users" to AIToolInfo("List users", "format-list-bulleted"),
        "get_permissions" to AIToolInfo("Check permissions", "lock-outline"),
        "get_monitoring" to AIToolInfo("Read monitoring", "information-outline"),
        "list_sessions" to AIToolInfo("List sessions", "format-list-bulleted"),
        "open_session" to AIToolInfo("Open session", "lan-connect"),
        "get_session" to AIToolInfo("Inspect session", "information-outline"),
        "close_session" to AIToolInfo("Close session", "lan-disconnect"),
        "close_all_sessions" to AIToolInfo("Close all sessions", "lan-disconnect"),
        "terminal_run" to AIToolInfo("Run command", "console-line"),
        "terminal_send" to AIToolInfo("Send input", "keyboard-outline"),
        "terminal_read" to AIToolInfo("Read terminal", "text-box-outline"),
        "terminal_resize" to AIToolInfo("Resize terminal", "monitor"),
        "run_command" to AIToolInfo("Run command", "console-line"),
        "exec_command" to AIToolInfo("Run command", "console-line"),
        "file_list" to AIToolInfo("List directory", "folder-outline"),
        "file_stat" to AIToolInfo("Inspect path", "information-outline"),
        "file_read" to AIToolInfo("Read file", "file-document-outline"),
        "file_write" to AIToolInfo("Write file", "file-edit-outline"),
        "file_edit" to AIToolInfo("Edit file", "file-edit-outline"),
        "file_mkdir" to AIToolInfo("Create directory", "folder-plus-outline"),
        "file_delete" to AIToolInfo("Delete", "trash-can-outline"),
        "file_move" to AIToolInfo("Move", "file-move-outline"),
        "file_chmod" to AIToolInfo("Change permissions", "lock-outline"),
        "file_search_dirs" to AIToolInfo("Find directories", "magnify"),
        "desktop_screenshot" to AIToolInfo("Screenshot", "monitor-screenshot"),
        "desktop_info" to AIToolInfo("Inspect desktop", "information-outline"),
        "desktop_click" to AIToolInfo("Click", "cursor-default-click"),
        "desktop_mouse_move" to AIToolInfo("Move mouse", "mouse"),
        "desktop_drag" to AIToolInfo("Drag", "mouse"),
        "desktop_scroll" to AIToolInfo("Scroll", "mouse"),
        "desktop_type" to AIToolInfo("Type text", "keyboard-outline"),
        "desktop_key" to AIToolInfo("Press keys", "keyboard-outline"),
        "desktop_resize" to AIToolInfo("Resize desktop", "monitor"),
        "desktop_clipboard_set" to AIToolInfo("Set clipboard", "clipboard-text-outline"),
        "desktop_clipboard_get" to AIToolInfo("Read clipboard", "clipboard-text-outline"),
        "transfer_create" to AIToolInfo("Transfer files", "file-move-outline"),
        "transfer_status" to AIToolInfo("Check transfer", "information-outline"),
        "batch" to AIToolInfo("Run several actions", "format-list-bulleted"),
        ASK_USER to AIToolInfo("Question", "help-circle-outline"),
    )

    fun info(tool: String?): AIToolInfo? = tool?.let { tools[it] }

    fun summary(tool: String?, a: JsonObject): String {
        fun arg(k: String) = a.str(k) ?: ""
        val session = arg("sessionId").take(8)
        return when (tool) {
            "list_entries" -> listOf(arg("search"), arg("protocol")).filter { it.isNotEmpty() }.joinToString(" ")
            "get_entry" -> "#${arg("entryId")}"
            "get_monitoring" -> a.str("entryId")?.let { "#$it" } ?: ""
            "open_session" -> "#${arg("entryId")}" + (a.str("type")?.let { " ($it)" } ?: "")
            "get_session", "close_session", "terminal_read", "desktop_screenshot", "desktop_info", "desktop_clipboard_get" -> session
            "terminal_run", "run_command", "exec_command" -> arg("command")
            "terminal_send" -> (listOf(arg("text")) + a.arr("keys").orEmpty().mapNotNull { (it as? JsonPrimitive)?.content })
                .filter { it.isNotEmpty() }.joinToString(" ")
            "terminal_resize" -> "${arg("cols")}x${arg("rows")}"
            "file_list", "file_stat", "file_read", "file_write", "file_edit", "file_mkdir" -> arg("path")
            "file_delete" -> if (a.boolOrNull("recursive") == true) "${arg("path")} (recursive)" else arg("path")
            "file_move" -> "${arg("source")} → ${arg("destination")}"
            "file_chmod" -> "${arg("path")} → ${arg("mode")}"
            "file_search_dirs" -> arg("query")
            "desktop_click" -> "${arg("x")}, ${arg("y")}" +
                (a.str("button")?.takeIf { it != "left" }?.let { " ($it)" } ?: "") + if ((a.int("clicks") ?: 1) > 1) " ×2" else ""
            "desktop_mouse_move" -> "${arg("x")}, ${arg("y")}"
            "desktop_drag" -> "${arg("fromX")}, ${arg("fromY")} → ${arg("toX")}, ${arg("toY")}"
            "desktop_scroll" -> a.int("amount")?.let { "${if (it > 0) "↓" else "↑"} ${abs(it)}" } ?: ""
            "desktop_type", "desktop_clipboard_set" -> arg("text")
            "desktop_key" -> a.arr("keys")?.mapNotNull { (it as? JsonPrimitive)?.content }?.joinToString(", ") ?: arg("keys")
            "desktop_resize" -> "${arg("width")}x${arg("height")}"
            "batch" -> a.arr("steps").orEmpty().mapNotNull { it.asObject()?.str("tool") }.joinToString(" → ")
            ASK_USER -> arg("question")
            else -> ""
        }
    }
}
