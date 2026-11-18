package dev.gnm.nexterm.api

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.KSerializer
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.Platform
import dev.gnm.nexterm.util.Uris
import dev.gnm.nexterm.util.parseJsonOrNull
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.serialization.json.JsonElement

open class NextermException(message: String, val statusCode: Int = 0, cause: Throwable? = null) : Exception(message, cause)

class ApiResponse(val status: Int, val body: String) {
    val isOk: Boolean get() = status == 200 || status == 201
    fun json(): JsonElement? = parseJsonOrNull(body)
}

object AppInfo {
    const val DEFAULT_BASE_URL = "http://localhost:8080"
    const val DEMO_BASE_URL = "https://demo.nexterm.dev"

    fun userAgent(version: String) = "NextermMobile/$version (${Platform.osName}; ${Platform.osVersion})"

    fun normalizeBaseUrl(url: String): String {
        var u = url.trim()
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://$u"
        u = u.trimEnd('/')
        if (!u.endsWith("/api")) u = "$u/api"
        return u
    }

    fun toWebSocketBase(baseUrl: String): String =
        if (baseUrl.startsWith("https://")) "wss://" + baseUrl.removePrefix("https://")
        else if (baseUrl.startsWith("http://")) "ws://" + baseUrl.removePrefix("http://")
        else baseUrl

    fun webBase(baseUrl: String): String = baseUrl.removeSuffix("/api")
}

class ApiClient internal constructor(
    val http: HttpClient,
    private val baseUrlProvider: () -> String,
    private val tokenProvider: () -> String?,
    val userAgent: String,
) {
    val baseUrl: String get() = baseUrlProvider()
    val token: String? get() = tokenProvider()

    fun forBaseUrl(baseUrl: String, token: String? = null) = ApiClient(http, { baseUrl }, { token }, userAgent)

    fun url(endpoint: String) = "$baseUrl$endpoint"

    fun webSocketUrl(endpoint: String, query: Map<String, String> = emptyMap()): String {
        val ws = AppInfo.toWebSocketBase(baseUrl)
        return if (query.isEmpty()) "$ws$endpoint" else "$ws$endpoint?${Uris.query(query)}"
    }

    internal suspend fun call(method: HttpMethod, endpoint: String, body: JsonElement? = null, auth: Boolean = true): ApiResponse {
        val response = http.request(url(endpoint)) {
            this.method = method
            applyDefaults(auth)
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(NextermJson.encodeToString(JsonElement.serializer(), body))
            }
        }
        return ApiResponse(response.status.value, response.bodyAsText())
    }

    internal suspend fun get(endpoint: String, auth: Boolean = true) = call(HttpMethod.Get, endpoint, null, auth)

    internal suspend fun <T> getAs(endpoint: String, error: String, serializer: KSerializer<T>): T {
        val r = get(endpoint)
        if (r.status != 200) throw NextermException("$error: ${r.status}", r.status)
        return NextermJson.decodeFromString(serializer, r.body)
    }
    internal suspend fun post(endpoint: String, body: JsonElement? = null, auth: Boolean = true) = call(HttpMethod.Post, endpoint, body, auth)
    internal suspend fun delete(endpoint: String) = call(HttpMethod.Delete, endpoint)

    internal fun HttpRequestBuilder.applyDefaults(auth: Boolean) {
        header(HttpHeaders.UserAgent, userAgent)
        if (auth) token?.let { header(HttpHeaders.Authorization, "Bearer $it") }
    }

    companion object {
        const val TIMEOUT_MS = 30_000L

        fun createHttpClient(): HttpClient = HttpClient { configure() }

        internal fun io.ktor.client.HttpClientConfig<*>.configure() {
            expectSuccess = false
            install(WebSockets)
            install(HttpTimeout) {
                requestTimeoutMillis = TIMEOUT_MS
                connectTimeoutMillis = TIMEOUT_MS
            }
        }
    }
}

internal suspend inline fun <T> safe(fallback: T, block: () -> T): T = try {
    block()
} catch (e: CancellationException) {
    throw e
} catch (_: Throwable) {
    fallback
}
