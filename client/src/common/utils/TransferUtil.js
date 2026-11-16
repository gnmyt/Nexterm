import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/common/utils/TauriUtil.js";

export const CANCELLED_MESSAGE = "Transfer cancelled";
export const isCancelledError = (error) => error?.message === CANCELLED_MESSAGE;
export const createCancelledError = () => new Error(CANCELLED_MESSAGE);

export const createTransferId = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replaceAll(/[^\w-]/g, "");

const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024;
const NATIVE_PROGRESS_EVENT = "transfer-progress";
const TRANSFER_ID_HEADER = "x-transfer-id";
const FALLBACK_USER_AGENT = "NextermConnector/1.0.0";

let cachedUserAgent = null;

export const getConnectorUserAgent = async () => {
    if (cachedUserAgent) return cachedUserAgent;
    if (!isTauri()) return FALLBACK_USER_AGENT;
    try {
        cachedUserAgent = await invoke("get_user_agent");
        return cachedUserAgent;
    } catch {
        return FALLBACK_USER_AGENT;
    }
};

const progressListeners = new Map();
let nativeListenerReady = null;

const ensureNativeListener = () => {
    if (!nativeListenerReady) {
        nativeListenerReady = listen(NATIVE_PROGRESS_EVENT, (event) => {
            progressListeners.get(event.payload?.id)?.(event.payload);
        });
    }
    return nativeListenerReady;
};

const subscribeNativeProgress = async (id, onProgress) => {
    await ensureNativeListener();
    progressListeners.set(id, ({ transferred, total }) => onProgress?.(transferred, total));
    return () => progressListeners.delete(id);
};

const parseResponseBody = (body) => {
    try { return JSON.parse(body); } catch { return { success: true }; }
};

const errorFromBody = (body, status) => {
    try { return JSON.parse(body).error || `Request failed (${status})`; } catch { return `Request failed (${status})`; }
};

export const pickSavePath = ({ fileName, filters }) =>
    save({ defaultPath: fileName, title: "Save File", ...(filters ? { filters } : {}) });

export const nativeDownload = async ({ id, url, destination, method = "GET", headers = {}, body, onProgress }) => {
    const unsubscribe = await subscribeNativeProgress(id, onProgress);
    try {
        await invoke("transfer_download", {
            id, url, method, destination,
            headers: { ...headers, "User-Agent": await getConnectorUserAgent() },
            body: body ?? null,
        });
        return destination;
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
    } finally {
        unsubscribe();
    }
};

export const nativeUpload = async ({ id, url, file, headers = {}, onProgress, signal }) => {
    const unsubscribe = await subscribeNativeProgress(id, onProgress);
    const throwIfCancelled = (error) => {
        if (signal?.aborted) throw createCancelledError();
        throw error instanceof Error ? error : new Error(String(error));
    };
    const onAbort = () => { invoke("transfer_cancel", { id }).catch(() => {}); };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
        if (signal?.aborted) throw createCancelledError();
        await invoke("transfer_upload_begin", {
            id, url, total: file.size,
            headers: { "Content-Type": "application/octet-stream", ...headers, "User-Agent": await getConnectorUserAgent() },
        });

        try {
            for (let offset = 0; offset < file.size; offset += UPLOAD_CHUNK_SIZE) {
                const chunk = new Uint8Array(await file.slice(offset, offset + UPLOAD_CHUNK_SIZE).arrayBuffer());
                await invoke("transfer_upload_chunk", chunk, { headers: { [TRANSFER_ID_HEADER]: id } });
            }
        } catch (chunkError) {
            if (signal?.aborted) throw createCancelledError();
            const outcome = await invoke("transfer_upload_finish", { id })
                .catch((finishError) => { throw new Error(String(finishError), { cause: finishError }); });
            if (outcome.status < 200 || outcome.status >= 300) {
                throw new Error(errorFromBody(outcome.body, outcome.status), { cause: chunkError });
            }
            throw chunkError instanceof Error ? chunkError : new Error(String(chunkError), { cause: chunkError });
        }

        const { status, body } = await invoke("transfer_upload_finish", { id });
        if (status < 200 || status >= 300) throw new Error(errorFromBody(body, status));
        return parseResponseBody(body);
    } catch (error) {
        throwIfCancelled(error);
    } finally {
        signal?.removeEventListener("abort", onAbort);
        unsubscribe();
    }
};

export const nativeCancel = (id) => invoke("transfer_cancel", { id }).catch(() => false);

export const browserDownload = ({ url, fileName }) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const browserFormDownload = ({ url, fields }) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
};

export const browserUpload = ({ url, file, headers = {}, onProgress, signal, timeout = 0 }) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    });

    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(parseResponseBody(xhr.responseText));
        else reject(new Error(errorFromBody(xhr.responseText, xhr.status)));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(createCancelledError());
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = timeout;

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.send(file);
});
