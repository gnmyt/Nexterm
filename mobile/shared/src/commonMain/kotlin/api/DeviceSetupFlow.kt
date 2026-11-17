package dev.gnm.nexterm.api

import dev.gnm.nexterm.util.stringOnly
import dev.gnm.nexterm.util.str
import dev.gnm.nexterm.util.jsonOf
import dev.gnm.nexterm.util.asObject
import dev.gnm.nexterm.model.DevicePollResponse
import dev.gnm.nexterm.model.DeviceCodeResponse
import dev.gnm.nexterm.state.AccountManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class DeviceSetupStep {
    SERVER_URL,
    AUTH_CHOICE,
    CODE,
    QR_WAITING,
    DONE,
}

data class DeviceSetupState(
    val step: DeviceSetupStep,
    val isLoading: Boolean,
    val error: String?,
    val deviceCode: String?,
    val baseUrl: String?,
)

class DeviceSetupFlow internal constructor(
    private val api: ApiClient,
    private val accounts: AccountManager,
    private val scope: CoroutineScope,
    private val pollIntervalMs: Long,
) {
    private val _state = MutableStateFlow(DeviceSetupState(DeviceSetupStep.SERVER_URL, false, null, null, null))
    val state: StateFlow<DeviceSetupState> = _state.asStateFlow()

    private var codes: ApiClient? = null
    private var deviceToken: String? = null
    private var label: String = ""
    private var pollJob: Job? = null

    @Throws(CancellationException::class)
    suspend fun connect(url: String) {
        val trimmed = url.trim()
        if (trimmed.isEmpty()) {
            _state.update { it.copy(error = "Please enter a server URL") }
            return
        }
        _state.update { it.copy(isLoading = true, error = null) }
        if (tryConnect(trimmed)) {
            label = trimmed.replaceFirst(Regex("^https?://"), "")
            createDeviceCode()
            _state.update { it.copy(step = DeviceSetupStep.AUTH_CHOICE, isLoading = false) }
        } else {
            _state.update { it.copy(error = "Failed to connect to server", isLoading = false) }
        }
    }

    @Throws(CancellationException::class)
    suspend fun startDemo() {
        _state.update { it.copy(isLoading = true, error = null) }
        if (!tryConnect(AppInfo.DEMO_BASE_URL)) {
            _state.update { it.copy(error = "The demo server is not reachable right now", isLoading = false) }
            return
        }
        val base = _state.value.baseUrl ?: return
        val error = try {
            val r = (codes ?: return).post("/auth/demo", auth = false)
            val token = r.json().asObject()?.str("token")
            if (r.isOk && token != null) {
                accounts.loginWithToken(token, base, "Nexterm Demo")
                _state.update { it.copy(step = DeviceSetupStep.DONE, isLoading = false) }
                return
            }
            r.json().asObject()?.str("message") ?: "Could not start a demo session"
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            "Connection error: ${e.message ?: e}"
        }
        _state.update { it.copy(error = error, isLoading = false) }
    }

    fun showCode() {
        _state.update { it.copy(step = DeviceSetupStep.CODE) }
        startPolling()
    }

    fun openInBrowser(): String? {
        val code = _state.value.deviceCode ?: return null
        val base = _state.value.baseUrl ?: return null
        startPolling()
        return "${AppInfo.webBase(base)}/link?code=$code"
    }

    fun handleScannedQr(raw: String): Boolean {
        val payload = QrPayloads.parseDeviceLink(raw) ?: return false
        scope.launch { connectWithDeviceLink(payload) }
        return true
    }

    private suspend fun connectWithDeviceLink(payload: DeviceLinkPayload) {
        _state.update { it.copy(isLoading = true, error = null) }
        val server = payload.server
        if (tryConnect(server)) {
            label = server.trim().replaceFirst(Regex("^https?://"), "")
            deviceToken = payload.token
            startPolling()
            _state.update { it.copy(step = DeviceSetupStep.QR_WAITING, isLoading = false) }
        } else {
            _state.update { it.copy(error = "Failed to connect to server", isLoading = false) }
        }
    }

    fun back() {
        stopPolling()
        deviceToken = null
        _state.value = DeviceSetupState(DeviceSetupStep.SERVER_URL, false, null, null, _state.value.baseUrl)
    }

    fun clearError() = _state.update { it.copy(error = null) }

    fun close() = stopPolling()

    private suspend fun tryConnect(url: String): Boolean {
        val base = AppInfo.normalizeBaseUrl(url)
        val client = api.forBaseUrl(base)
        val ok = try {
            client.get("/service/is-fts", auth = false).status == 200
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
            false
        }
        if (ok) {
            codes = client
            _state.update { it.copy(baseUrl = base) }
        }
        return ok
    }

    private suspend fun createDeviceCode() {
        val r = createCode(codes ?: return)
        if (r.error != null) {
            _state.update { it.copy(error = r.error) }
            return
        }
        deviceToken = r.token
        _state.update { it.copy(deviceCode = r.code) }
    }

    private fun startPolling() {
        stopPolling()
        pollJob = scope.launch {
            while (isActive) {
                delay(pollIntervalMs)
                if (poll()) break
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    internal suspend fun poll(): Boolean {
        val token = deviceToken ?: return false
        val r = pollToken(codes ?: return false, token)
        val authToken = r.token
        if (r.isAuthorized && authToken != null) {
            try {
                accounts.loginWithToken(authToken, _state.value.baseUrl ?: return true, label)
                _state.update { it.copy(step = DeviceSetupStep.DONE) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                _state.update { it.copy(error = e.message ?: "Login failed") }
            }
            return true
        }
        if (r.isInvalid) createDeviceCode()
        return false
    }

    private suspend fun createCode(api: ApiClient): DeviceCodeResponse = try {
        val r = api.post("/auth/device/create", jsonOf("clientType" to "mobile"), auth = false)
        val data = r.json().asObject()
        when {
            r.isOk && data?.stringOnly("code") != null -> DeviceCodeResponse(
                code = data.str("code") ?: "",
                token = data.str("token") ?: "",
                error = null,
            )
            r.status == 429 -> codeError("Too many requests. Please try again later.")
            else -> codeError(data?.str("message") ?: "Failed to create device code")
        }
    } catch (e: CancellationException) {
        throw e
    } catch (e: Throwable) {
        codeError("Connection error: ${e.message ?: e}")
    }

    private suspend fun pollToken(api: ApiClient, token: String): DevicePollResponse = try {
        val r = api.post("/auth/device/poll", jsonOf("token" to token), auth = false)
        val data = r.json().asObject()
        if (r.status == 200 && data != null) DevicePollResponse(data.str("status") ?: "invalid", data.str("token"))
        else DevicePollResponse("invalid", null)
    } catch (e: CancellationException) {
        throw e
    } catch (_: Throwable) {
        DevicePollResponse("error", null)
    }

    private fun codeError(message: String) = DeviceCodeResponse("", "", message)
}
