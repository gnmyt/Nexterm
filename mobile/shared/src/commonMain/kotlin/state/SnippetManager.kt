package dev.gnm.nexterm.state

import dev.gnm.nexterm.model.Snippet
import kotlinx.serialization.builtins.ListSerializer
import dev.gnm.nexterm.api.ApiClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SnippetManager internal constructor(private val api: ApiClient) {
    private val _snippets = MutableStateFlow<List<Snippet>>(emptyList())
    private val _isLoaded = MutableStateFlow(false)
    private val _isLoading = MutableStateFlow(false)
    private val _error = MutableStateFlow<String?>(null)

    val snippets: StateFlow<List<Snippet>> = _snippets.asStateFlow()
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    val error: StateFlow<String?> = _error.asStateFlow()

    @Throws(CancellationException::class)
    suspend fun loadSnippets(forceRefresh: Boolean) {
        if (!forceRefresh && (_isLoaded.value || _isLoading.value)) return
        _isLoading.value = true
        _error.value = null
        try {
            _snippets.value = api.getAs("/snippets/all", "Failed to load snippets", ListSerializer(Snippet.serializer()))
            _isLoaded.value = true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            _error.value = e.message ?: e.toString()
            _isLoaded.value = false
        } finally {
            _isLoading.value = false
        }
    }

    @Throws(CancellationException::class)
    suspend fun reloadSnippets() = loadSnippets(true)

    fun clear() {
        _snippets.value = emptyList()
        _isLoaded.value = false
        _error.value = null
    }
}
