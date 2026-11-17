package dev.gnm.nexterm.session

import dev.gnm.nexterm.util.arr
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.boolOrNull
import dev.gnm.nexterm.util.int
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.parseJsonOrNull
import dev.gnm.nexterm.util.str
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

enum class ScriptStepStatus { DONE, RUNNING, FAILED, SKIPPED, PENDING }

data class ScriptStep(val index: Int, val title: String, val status: ScriptStepStatus)

enum class ScriptInputKind { TEXT, PASSWORD, SELECT, CONFIRM }

data class ScriptRow(val index: Int, val cells: List<ScriptCell>)

data class ScriptCell(val label: String, val value: String)

sealed class ScriptDialog {
    data class Input(val variable: String?, val prompt: String, val kind: ScriptInputKind, val options: List<String>, val placeholder: String) : ScriptDialog()
    data class Summary(val title: String, val items: List<ScriptCell>) : ScriptDialog()
    data class Table(val title: String, val rows: List<ScriptRow>) : ScriptDialog()
    data class Notice(val title: String, val message: String) : ScriptDialog()
}

data class ScriptState(
    val name: String,
    private val titles: List<String> = listOf("Initializing..."),
    private val current: Int = 1,
    private val failed: Int? = null,
    val isCompleted: Boolean = false,
    val progress: Int? = null,
    val notice: String? = null,
    val dialog: ScriptDialog? = null,
    internal val queue: List<ScriptDialog> = emptyList(),
) {
    val isFailed: Boolean get() = failed != null
    val isRunning: Boolean get() = !isCompleted && !isFailed

    val steps: List<ScriptStep>
        get() = titles.mapIndexed { i, title ->
            ScriptStep(i, title, when {
                failed != null && i == failed - 1 -> ScriptStepStatus.FAILED
                failed != null && i > failed - 1 -> ScriptStepStatus.SKIPPED
                i < current - 1 || (isCompleted && i == current - 1 && i == titles.lastIndex) -> ScriptStepStatus.DONE
                i == current - 1 -> ScriptStepStatus.RUNNING
                else -> ScriptStepStatus.PENDING
            })
        }

    val currentTitle: String get() = titles.getOrNull((failed ?: current) - 1) ?: titles.last()
    val fraction: Double get() = if (isCompleted && !isFailed) 1.0 else progress?.let { it / 100.0 } ?: -1.0
    val summary: String
        get() = when {
            isFailed -> "Failed at step ${failed ?: current}"
            isCompleted -> "Completed"
            else -> "Step $current of ${maxOf(titles.size, current)}"
        }

    internal fun step(number: Int, description: String): ScriptState {
        val list = titles.toMutableList()
        if (list.size <= number) {
            while (list.size < number) list += ""
            list += description
        }
        return copy(titles = list, current = number + 1, progress = null)
    }

    internal fun fail() = copy(failed = failed ?: current)
    internal fun show(next: ScriptDialog) = if (dialog == null) copy(dialog = next) else copy(queue = queue + next)
    internal fun advance() = copy(dialog = queue.firstOrNull(), queue = queue.drop(1))
}

class ScriptRun internal constructor(name: String?) {
    private val _state = MutableStateFlow(ScriptState(name ?: "Script"))
    internal var send: (String) -> Unit = {}

    val state: StateFlow<ScriptState> = _state.asStateFlow()

    fun submit(value: String) {
        val input = _state.value.dialog as? ScriptDialog.Input ?: return
        control("input_response", "variable" to input.variable, "value" to value)
        _state.update { it.advance() }
    }

    fun cancel() {
        control("input_cancelled")
        if (_state.value.dialog is ScriptDialog.Input) _state.update { it.advance() }
    }

    fun dismiss() {
        val variable = when (_state.value.dialog) {
            is ScriptDialog.Summary -> "NEXTERM_SUMMARY_RESULT"
            is ScriptDialog.Table -> "NEXTERM_TABLE_RESULT"
            is ScriptDialog.Notice -> "NEXTERM_MSGBOX_RESULT"
            else -> return
        }
        control("input_response", "variable" to variable, "value" to "closed")
        _state.update { it.advance() }
    }

    private fun control(type: String, vararg fields: Pair<String, Any?>) = send(MAGIC + jsonOf("type" to type, *fields).toString())

    internal fun finish(failed: Boolean) = _state.update { if (it.isCompleted) it else (if (failed) it.fail() else it).copy(isCompleted = true) }

    internal fun filter(data: String): String {
        val output = StringBuilder()
        var rest = data
        while (true) {
            val start = rest.indexOf(MAGIC)
            if (start == -1) return output.append(rest).toString()
            output.append(rest, 0, start)
            val end = rest.indexOf(MAGIC, start + 1).let { if (it == -1) rest.length else it }
            parseJsonOrNull(rest.substring(start + 1, end)).asObject()?.let(::handle)
            if (end >= rest.length) return output.toString()
            rest = rest.substring(end)
        }
    }

    private fun handle(msg: JsonObject) = _state.update { s ->
        when (msg.str("type")) {
            "script_start" -> msg.str("name")?.let { s.copy(name = it) } ?: s
            "step" -> s.step(msg.int("number") ?: return@update s, msg.str("description") ?: "")
            "prompt", "confirm" -> s.show(input(msg))
            "warning", "info", "success" -> s.copy(notice = msg.str("message"))
            "progress" -> s.copy(progress = msg.int("percentage"))
            "summary" -> s.show(ScriptDialog.Summary(msg.str("title") ?: "Summary", pairs(msg)))
            "table" -> s.show(ScriptDialog.Table(msg.str("title") ?: "Results", table(msg)))
            "msgbox" -> s.show(ScriptDialog.Notice(msg.str("title") ?: "Message", msg.str("message") ?: ""))
            "script_end" -> (if (msg.boolOrNull("success") == false) s.fail() else s).copy(isCompleted = true)
            "script_error" -> s.fail()
            else -> s
        }
    }

    private fun input(msg: JsonObject): ScriptDialog.Input {
        val kind = when (msg.str("inputType") ?: msg.str("type")) {
            "password" -> ScriptInputKind.PASSWORD
            "select" -> ScriptInputKind.SELECT
            "confirm" -> ScriptInputKind.CONFIRM
            else -> ScriptInputKind.TEXT
        }
        return ScriptDialog.Input(msg.str("variable"), msg.str("prompt") ?: "", kind, strings(msg, "options"), msg.str("default") ?: "")
    }

    private fun strings(msg: JsonObject, key: String) = msg.arr(key).orEmpty().mapNotNull { (it as? JsonPrimitive)?.content }

    private fun pairs(msg: JsonObject) = strings(msg, "data").chunked(2).filter { it.size == 2 && it.all(String::isNotEmpty) }.map { ScriptCell(it[0], it[1]) }

    private fun table(msg: JsonObject): List<ScriptRow> {
        val lines = strings(msg, "data").map { line -> line.split(",").map(String::trim) }
        val headers = lines.firstOrNull() ?: return emptyList()
        return lines.drop(1).mapIndexed { i, row -> ScriptRow(i, headers.mapIndexed { c, h -> ScriptCell(h, row.getOrNull(c) ?: "") }) }
    }

    private companion object {
        const val MAGIC = "\u001F"
    }
}
