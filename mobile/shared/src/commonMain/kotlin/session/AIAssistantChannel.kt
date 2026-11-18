package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.parseJsonOrNull
import io.ktor.client.plugins.timeout
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.random.Random

internal class AIAssistantChannel(
    private val api: ApiClient,
    private val token: String,
    private val sessionId: String,
    private val scope: CoroutineScope,
) {
    private var job: Job? = null
    private var outgoing = Channel<String>(Channel.UNLIMITED)
    private var closedByUs = false
    private val conversationId = "m-" + (1..16).joinToString("") { Random.nextInt(36).toString(36) }

    fun connect(onEvent: (JsonObject) -> Unit, onClosed: (Int?, String?) -> Unit) {
        job?.cancel()
        outgoing.close()
        val out = Channel<String>(Channel.UNLIMITED).also { outgoing = it }
        val url = api.webSocketUrl("/ws/ai", mapOf("sessionToken" to token, "sessionId" to sessionId, "conversationId" to conversationId))
        job = scope.launch {
            var code: Int? = null
            var reason: String? = null
            try {
                api.http.webSocket(url, request = {
                    header(HttpHeaders.UserAgent, api.userAgent)
                    timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
                }) {
                    val sender = launch { for (m in out) send(Frame.Text(m)) }
                    try {
                        for (frame in incoming) {
                            if (frame !is Frame.Text) continue
                            parseJsonOrNull(frame.readText()).asObject()?.let(onEvent)
                        }
                    } finally {
                        sender.cancel()
                    }
                    closeReason.await()?.let { code = it.code.toInt(); reason = it.message }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Throwable) {
                code = null
                reason = null
            }
            if (!closedByUs) onClosed(code, reason)
        }
    }

    private fun send(payload: JsonObject) {
        outgoing.trySend(payload.toString())
    }

    fun sendPrompt(content: String) = send(jsonOf("type" to "prompt", "content" to content))
    fun confirm(callId: String, allow: Boolean) = send(jsonOf("type" to "confirm", "callId" to callId, "allow" to allow))
    fun answer(callId: String, answer: JsonElement) = send(jsonOf("type" to "answer", "callId" to callId, "answer" to answer))
    fun abort() = send(jsonOf("type" to "abort"))

    fun dispose() {
        closedByUs = true
        job?.cancel()
        outgoing.close()
    }
}
