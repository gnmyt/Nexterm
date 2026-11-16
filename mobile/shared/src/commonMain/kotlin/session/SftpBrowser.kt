package dev.gnm.nexterm.session

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.model.SftpEntry
import dev.gnm.nexterm.state.SftpSettings
import dev.gnm.nexterm.util.Uris
import dev.gnm.nexterm.util.jsonOf
import io.ktor.client.plugins.onUpload
import io.ktor.client.plugins.timeout
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.prepareGet
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.content.OutgoingContent
import io.ktor.http.contentLength
import io.ktor.utils.io.ByteWriteChannel
import io.ktor.utils.io.readAvailable
import io.ktor.utils.io.writeFully
import io.ktor.websocket.Frame
import io.ktor.websocket.readBytes
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject

fun interface SftpChunkSource {
    fun readChunk(maxBytes: Int): ByteArray?
}

fun interface SftpChunkSink {
    fun write(chunk: ByteArray)
}

data class Breadcrumb(val label: String, val path: String, val isCurrent: Boolean)

data class TransferProgress(val fileName: String, val transferred: Long, val total: Long) {
    val fraction: Double get() = if (total > 0) (transferred.toDouble() / total).coerceIn(0.0, 1.0) else -1.0
}

class UploadSource(val name: String, val size: Long, val source: SftpChunkSource) {
    companion object {
        fun fromBytes(name: String, data: ByteArray): UploadSource {
            var offset = 0
            return UploadSource(name, data.size.toLong()) { max ->
                if (offset >= data.size) null else data.copyOfRange(offset, minOf(data.size, offset + max)).also { offset += it.size }
            }
        }
    }
}

data class UploadResult(val uploaded: Int, val failed: Int) {
    val message: String
        get() = if (failed == 0) "Uploaded $uploaded file${if (uploaded != 1) "s" else ""}" else "Uploaded $uploaded, failed $failed"
}

class SftpBrowser internal constructor(
    private val api: ApiClient,
    private val sessionId: String,
    private val token: String,
    private val settings: SftpSettings,
    private val scope: CoroutineScope,
) {
    private val _ready = MutableStateFlow(false)
    private val requestLock = Mutex()
    private var pending: CompletableDeferred<SftpFrame>? = null
    private val _currentPath = MutableStateFlow("/")
    private val history = mutableListOf("/")
    private var historyIndex = 0
    private val _canGoBack = MutableStateFlow(false)
    private val rawEntries = MutableStateFlow<List<SftpEntry>>(emptyList())
    private val _isLoading = MutableStateFlow(true)
    private val _error = MutableStateFlow<String?>(null)
    private val _selected = MutableStateFlow<Set<String>>(emptySet())
    private val _transfer = MutableStateFlow<TransferProgress?>(null)

    private val socket = ReconnectingSocket(
        api.http,
        { api.webSocketUrl("/ws/sftp", mapOf("sessionToken" to token, "sessionId" to sessionId)) },
        api.userAgent,
        scope,
        onOpen = { _ready.value = false },
        onFrame = { frame ->
            val decoded = when (frame) {
                is Frame.Binary -> SftpProtocol.decode(frame.readBytes())
                is Frame.Text -> SftpProtocol.decodeText(frame.readText())
                else -> null
            }
            if (decoded != null) handle(decoded)
        },
        onDown = { err ->
            _ready.value = false
            if (err != null) _error.value = "Connection error: $err"
            pending?.completeExceptionally(NextermException(err?.let { "Connection error: $it" } ?: "Connection closed"))
        },
    )

    val currentPath: StateFlow<String> = _currentPath.asStateFlow()
    val canGoBack: StateFlow<Boolean> = _canGoBack.asStateFlow()
    val canGoUp: StateFlow<Boolean> = _currentPath.map { it != "/" }.stateIn(scope, SharingStarted.Eagerly, false)
    val breadcrumbs: StateFlow<List<Breadcrumb>> = _currentPath.map(::breadcrumbsFor).stateIn(scope, SharingStarted.Eagerly, breadcrumbsFor("/"))
    val entries: StateFlow<List<SftpEntry>> = combine(rawEntries, settings.showHiddenFiles, settings.sortFoldersFirst) { list, hidden, foldersFirst ->
        sortEntries(list, hidden, foldersFirst)
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())
    val isConnected: StateFlow<Boolean> = _ready.asStateFlow()
    val connectionState: StateFlow<ConnectionState> = socket.state
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()
    val selected: StateFlow<Set<String>> = _selected.asStateFlow()
    val transfer: StateFlow<TransferProgress?> = _transfer.asStateFlow()

    init {
        socket.start()
    }

    private fun handle(frame: SftpFrame) {
        if (frame.operation == SftpOperation.READY) {
            _ready.value = true
            refresh()
            return
        }
        pending?.complete(frame)
    }

    fun remotePath(name: String): String = SftpProtocol.join(_currentPath.value, name)

    fun refresh() {
        val path = _currentPath.value
        _isLoading.value = true
        scope.launch {
            try {
                val list = listDirectory(path)
                if (path == _currentPath.value) {
                    rawEntries.value = list
                    _selected.value = emptySet()
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                _error.value = e.message ?: e.toString()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun navigateTo(path: String) {
        _currentPath.value = path
        _error.value = null
        while (history.size > historyIndex + 1) history.removeAt(history.lastIndex)
        history += path
        historyIndex = history.lastIndex
        _canGoBack.value = historyIndex > 0
        refresh()
    }

    fun goBack() {
        if (historyIndex <= 0) return
        historyIndex--
        _canGoBack.value = historyIndex > 0
        _currentPath.value = history[historyIndex]
        refresh()
    }

    fun goUp() {
        if (_currentPath.value == "/") return
        navigateTo(SftpProtocol.parent(_currentPath.value))
    }

    fun tap(entry: SftpEntry): Boolean {
        if (_selected.value.isNotEmpty()) {
            toggleSelection(entry.name)
            return false
        }
        if (!entry.isDir) return false
        navigateTo(remotePath(entry.name))
        return true
    }

    fun longPress(entry: SftpEntry) = _selected.update { it + entry.name }

    fun toggleSelection(name: String) = _selected.update { if (name in it) it - name else it + name }

    fun clearSelection() {
        _selected.value = emptySet()
    }

    fun selectedEntries(): List<SftpEntry> = entries.value.filter { it.name in _selected.value }

    fun clearError() {
        _error.value = null
    }

    fun needsDeleteConfirmation(): Boolean = settings.confirmBeforeDelete.value

    fun deleteConfirmationMessage(entries: List<SftpEntry>): String =
        if (entries.size == 1) "Delete \"${entries.first().name}\"?" else "Delete ${entries.size} items?"

    fun createFolder(name: String) {
        val n = name.trim()
        if (n.isEmpty()) return
        op { request(SftpOperation.CREATE_FOLDER, jsonOf("path" to remotePath(n))) }
    }

    fun rename(entry: SftpEntry, newName: String) {
        val n = newName.trim()
        if (n.isEmpty() || n == entry.name) return
        op { request(SftpOperation.RENAME_FILE, jsonOf("path" to remotePath(entry.name), "newPath" to remotePath(n))) }
    }

    fun delete(entries: List<SftpEntry>) {
        val paths = entries.map { remotePath(it.name) to it.isDir }
        op { paths.forEach { (p, dir) -> request(if (dir) SftpOperation.DELETE_FOLDER else SftpOperation.DELETE_FILE, jsonOf("path" to p)) } }
    }

    @Throws(CancellationException::class)
    suspend fun upload(files: List<UploadSource>): UploadResult {
        val dir = _currentPath.value
        var uploaded = 0
        var failed = 0
        try {
            for (f in files) {
                try {
                    _transfer.value = TransferProgress(f.name, 0, f.size)
                    uploadStream(SftpProtocol.join(dir, f.name), f.size, f.source) { sent, total ->
                        _transfer.value = TransferProgress(f.name, sent, total)
                    }
                    uploaded++
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Throwable) {
                    failed++
                }
            }
        } finally {
            _transfer.value = null
        }
        refresh()
        return UploadResult(uploaded, failed)
    }

    @Throws(Exception::class)
    suspend fun downloadTo(entry: SftpEntry, sink: SftpChunkSink): Long {
        _transfer.value = TransferProgress(entry.name, 0, entry.size)
        try {
            return download(remotePath(entry.name), sink) { done, total ->
                _transfer.value = TransferProgress(entry.name, done, if (total > 0) total else entry.size)
            }
        } finally {
            _transfer.value = null
        }
    }

    private suspend fun request(operation: SftpOperation, payload: JsonObject): SftpFrame = requestLock.withLock {
        val bytes = SftpProtocol.encode(operation, payload)
        try {
            withTimeout(TIMEOUT_MS) {
                _ready.first { it }
                val deferred = CompletableDeferred<SftpFrame>()
                pending = deferred
                socket.send(Frame.Binary(true, bytes))
                val frame = deferred.await()
                if (frame.operation == SftpOperation.ERROR) throw NextermException(frame.errorMessage)
                frame
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            throw NextermException("SFTP ${operation.name.lowercase()} timed out", cause = e)
        } finally {
            pending = null
        }
    }

    private suspend fun listDirectory(path: String): List<SftpEntry> {
        val frame = request(SftpOperation.LIST_FILES, jsonOf("path" to path))
        return try {
            SftpProtocol.parseListing(frame.payload)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            throw NextermException("Failed to parse directory listing: ${e.message ?: e}", cause = e)
        }
    }

    private fun transferUrl(endpoint: String, remotePath: String) =
        api.url(endpoint) + "?sessionId=${Uris.encode(sessionId)}&path=${Uris.encode(remotePath)}&sessionToken=${Uris.encode(token)}"

    private suspend fun uploadStream(remotePath: String, size: Long, source: SftpChunkSource, onProgress: ((Long, Long) -> Unit)?) {
        val response = api.http.post(transferUrl("/entries/sftp/upload", remotePath)) {
            header(HttpHeaders.UserAgent, api.userAgent)
            timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
            setBody(object : OutgoingContent.WriteChannelContent() {
                override val contentLength: Long = size
                override val contentType: ContentType = ContentType.Application.OctetStream
                override suspend fun writeTo(channel: ByteWriteChannel) {
                    while (true) {
                        val chunk = source.readChunk(CHUNK_SIZE)
                        if (chunk == null || chunk.isEmpty()) break
                        channel.writeFully(chunk)
                    }
                }
            })
            if (onProgress != null) onUpload { sent, total -> onProgress(sent, total ?: size) }
        }
        val status = response.status.value
        if (status != 200 && status != 201) throw NextermException("Upload failed: $status", status)
    }

    private suspend fun download(remotePath: String, sink: SftpChunkSink, onProgress: ((Long, Long) -> Unit)?): Long =
        api.http.prepareGet(transferUrl("/entries/sftp", remotePath)) {
            header(HttpHeaders.UserAgent, api.userAgent)
            timeout { requestTimeoutMillis = Long.MAX_VALUE; socketTimeoutMillis = Long.MAX_VALUE }
        }.execute { response ->
            val status = response.status.value
            if (status != 200) throw NextermException("Download failed: $status", status)
            val total = response.contentLength() ?: -1L
            val channel = response.bodyAsChannel()
            val buffer = ByteArray(CHUNK_SIZE)
            var received = 0L
            while (true) {
                val n = channel.readAvailable(buffer, 0, buffer.size)
                if (n == -1) break
                if (n == 0) continue
                sink.write(buffer.copyOf(n))
                received += n
                onProgress?.invoke(received, total)
            }
            received
        }

    fun reconnect() = socket.reconnect()

    internal fun close() = socket.close()

    private fun op(block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                _error.value = e.message ?: e.toString()
            }
            refresh()
        }
    }

    companion object {
        const val CHUNK_SIZE = 64 * 1024
        const val TIMEOUT_MS = 30_000L

        fun sortEntries(list: List<SftpEntry>, showHidden: Boolean, foldersFirst: Boolean): List<SftpEntry> =
            list.filter { showHidden || !it.isHidden }.sortedWith { a, b ->
                if (foldersFirst && a.isDir != b.isDir) (if (a.isDir) -1 else 1)
                else a.name.lowercase().compareTo(b.name.lowercase())
            }

        fun breadcrumbsFor(path: String): List<Breadcrumb> {
            val segments = path.split('/').filter { it.isNotEmpty() }
            return listOf(Breadcrumb("/", "/", path == "/")) + segments.mapIndexed { i, s ->
                val p = "/" + segments.subList(0, i + 1).joinToString("/")
                Breadcrumb(s, p, p == path)
            }
        }
    }
}
