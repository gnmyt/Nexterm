package dev.gnm.nexterm.state

import com.russhwolf.settings.Settings
import dev.gnm.nexterm.api.ApiClient
import dev.gnm.nexterm.api.AppInfo
import dev.gnm.nexterm.api.NextermException
import dev.gnm.nexterm.api.QrPayloads
import dev.gnm.nexterm.api.safe
import dev.gnm.nexterm.model.ServerAccount
import dev.gnm.nexterm.model.SessionModel
import dev.gnm.nexterm.model.UserInfo
import dev.gnm.nexterm.util.Formatters
import dev.gnm.nexterm.util.NextermJson
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.str
import io.ktor.client.HttpClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonPrimitive

class AccountManager internal constructor(private val settings: Settings, http: HttpClient, userAgent: String, scope: CoroutineScope) {
    private val _accounts = MutableStateFlow(
        settings.getStringOrNull(ACCOUNTS_KEY)?.let { runCatching { NextermJson.decodeFromString(serializer, it) }.getOrNull() } ?: emptyList(),
    )
    private var activeAccountId = settings.getStringOrNull(ACTIVE_KEY)
    private val _activeAccount = MutableStateFlow<ServerAccount?>(null)

    init {
        update(_accounts.value, activeAccountId)
    }

    val accounts: StateFlow<List<ServerAccount>> = _accounts.asStateFlow()
    val activeAccount: StateFlow<ServerAccount?> = _activeAccount.asStateFlow()
    val isAuthenticated: StateFlow<Boolean> = _activeAccount.map { it != null }.stateIn(scope, SharingStarted.Eagerly, _activeAccount.value != null)

    internal val api = ApiClient(http, { _activeAccount.value?.baseUrl ?: AppInfo.DEFAULT_BASE_URL }, { _activeAccount.value?.token }, userAgent)

    @Throws(Exception::class)
    suspend fun loginWithToken(token: String, baseUrl: String, label: String): ServerAccount {
        val user = safe(null) {
            val r = api.forBaseUrl(baseUrl, token).get("/accounts/me")
            if (r.status == 200) NextermJson.decodeFromString(UserInfo.serializer(), r.body) else null
        }
        val account = ServerAccount(
            id = Formatters.nowMillis().toString(), label = label, baseUrl = baseUrl, token = token,
            username = user?.username, fullName = user?.fullName,
        )
        update(_accounts.value + account, account.id)
        return account
    }

    @Throws(Exception::class)
    suspend fun logout() {
        _activeAccount.value?.let { removeAccount(it.id) }
    }

    @Throws(Exception::class)
    suspend fun removeAccount(id: String) {
        val account = _accounts.value.firstOrNull { it.id == id } ?: return
        safe(false) { api.forBaseUrl(account.baseUrl).post("/auth/logout", jsonOf("token" to account.token)) }
        val remaining = _accounts.value.filterNot { it.id == id }
        update(remaining, if (activeAccountId == id) remaining.firstOrNull()?.id else activeAccountId)
    }

    fun switchAccount(id: String) {
        if (_accounts.value.any { it.id == id }) update(_accounts.value, id)
    }

    fun renameAccount(id: String, label: String) {
        val l = label.trim()
        if (l.isNotEmpty()) update(_accounts.value.map { if (it.id == id) it.copy(label = l) else it }, activeAccountId)
    }

    @Throws(CancellationException::class)
    suspend fun listSessions(): List<SessionModel> = safe(emptyList()) { api.getAs("/sessions/list", "", ListSerializer(SessionModel.serializer())) }

    @Throws(CancellationException::class)
    suspend fun revokeSession(sessionId: String): Boolean = safe(false) { api.delete("/sessions/$sessionId").status == 200 }

    @Throws(Exception::class)
    suspend fun authorizeWebLogin(code: String, server: String) {
        val target = QrPayloads.normalizeServer(server)
        val account = _accounts.value.firstOrNull {
            val n = QrPayloads.normalizeServer(it.baseUrl)
            n == target || n == "$target/api"
        } ?: throw NextermException("No matching account found")
        val r = try {
            api.forBaseUrl(account.baseUrl, account.token).post("/auth/device/authorize", jsonOf("code" to code))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            throw NextermException("Connection error", cause = e)
        }
        val data = r.json().asObject()
        val codeIsInt = (data?.get("code") as? JsonPrimitive)?.let { !it.isString && it.content.toIntOrNull() != null } == true
        if (r.status != 200 || codeIsInt) throw NextermException(data?.str("message") ?: "Authorization failed", r.status)
    }

    private fun update(list: List<ServerAccount>, activeId: String?) {
        _accounts.value = list
        activeAccountId = activeId
        _activeAccount.value = list.firstOrNull { it.id == activeId } ?: list.firstOrNull()
        settings.putString(ACCOUNTS_KEY, NextermJson.encodeToString(serializer, list))
        activeId?.let { settings.putString(ACTIVE_KEY, it) } ?: settings.remove(ACTIVE_KEY)
    }

    private companion object {
        const val ACCOUNTS_KEY = "server_accounts"
        const val ACTIVE_KEY = "active_account_id"
        val serializer = ListSerializer(ServerAccount.serializer())
    }
}
