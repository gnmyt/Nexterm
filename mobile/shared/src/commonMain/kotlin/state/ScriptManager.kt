package dev.gnm.nexterm.state

import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.model.Script
import dev.gnm.nexterm.model.Server
import dev.gnm.nexterm.util.asObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

class ScriptManager internal constructor(private val api: ApiClient) {
    private val _scripts = MutableStateFlow<List<Script>>(emptyList())
    val scripts: StateFlow<List<Script>> = _scripts.asStateFlow()

    @Throws(CancellationException::class)
    suspend fun load() {
        val serializer = ListSerializer(Script.serializer())
        val own = safe(emptyList()) { api.getAs("/scripts/all", "Failed to load scripts", serializer) }
        val sources = safe(emptyList()) { api.getAs("/scripts/sources", "Failed to load scripts", serializer) }
        _scripts.value = (own + sources).filterNot { it.isHidden }
    }

    internal fun nameOf(id: Int): String? = _scripts.value.firstOrNull { it.id == id }?.name

    @Throws(CancellationException::class)
    suspend fun scriptsFor(server: Server): List<Script> {
        if (_scripts.value.isEmpty()) load()
        val os = if (server.isPve) null else safe(null) {
            val r = api.get("/monitoring/${server.id}")
            val latest = (r.json().asObject()?.get("latest") as? JsonObject)?.get("osInfo").asObject()
            Script.normalizeSystem((latest?.get("name") as? kotlinx.serialization.json.JsonPrimitive)?.content)
        }
        return _scripts.value.filter { (it.organizationId == null || it.organizationId == server.organizationId) && it.runsOn(os, server.isPve) }
    }

    fun clear() {
        _scripts.value = emptyList()
    }
}
