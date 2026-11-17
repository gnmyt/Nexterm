import { isTauri, getActiveServerUrl } from "@/common/utils/TauriUtil.js";
import { fetch as tauriFetchApi } from "@tauri-apps/plugin-http";
import {
    browserDownload, browserUpload, createTransferId, getConnectorUserAgent, nativeDownload, nativeUpload, pickSavePath,
} from "@/common/utils/TransferUtil.js";

const getTauriUserAgent = getConnectorUserAgent;

export const tauriDownload = async (url, defaultFileName, options = {}) => {
    const destination = await pickSavePath({ fileName: defaultFileName, filters: options.filters });
    if (!destination) return null;
    const { method = "GET", headers = {}, body } = options.fetchOptions ?? {};
    return nativeDownload({ id: createTransferId(), url, destination, method, headers, body, onProgress: options.onProgress });
};

const getBaseUrl = () => {
    if (isTauri()) {
        const activeServerUrl = getActiveServerUrl();
        if (activeServerUrl) {
            return activeServerUrl;
        }
    }
    return "";
};

export const tauriFetch = async (url, options = {}) => {
    if (isTauri()) {
        try {
            const userAgent = await getTauriUserAgent();
            const headers = { ...options.headers, "User-Agent": userAgent };
            return tauriFetchApi(url, { ...options, headers });
        } catch (e) {
            console.warn("Tauri HTTP plugin not available, falling back to native fetch");
        }
    }
    return fetch(url, options);
};

export const uploadFile = async (url, file, { onProgress, timeout = 300000, headers = {}, signal } = {}) => {
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
    const reportPercent = onProgress ? (loaded, total) => onProgress(total ? Math.round((loaded / total) * 100) : 0) : undefined;

    if (isTauri()) {
        return nativeUpload({ id: createTransferId(), url: fullUrl, file, headers, signal, onProgress: reportPercent });
    }
    return browserUpload({ url: fullUrl, file, headers, signal, timeout, onProgress: reportPercent });
};

export const request = async (url, method, body, headers) => {
    url = url.startsWith("/") ? url.substring(1) : url;
    
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}/api/${url}` : `/api/${url}`;

    const response = await tauriFetch(fullUrl, {
        method: method,
        headers: {...headers, "Content-Type": "application/json"},
        body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401) throw new Error("Unauthorized");

    const rawData = await response.text();
    const data = rawData ? JSON.parse(rawData) : rawData.toString();

    if (data.code >= 300) throw data;

    if (!response.ok) throw data;

    return data;
}

export const downloadRequest = async (url) => {
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
    
    const response = await tauriFetch(fullUrl, {
        method: "GET",
        headers: {"Content-Type": "application/json"},
    });

    if (response.status === 401) throw new Error("Unauthorized");

    const blob = await response.blob();

    if (!response.ok) throw blob;

    return blob;
}

export const getToken = () => {
    return localStorage.getItem("overrideToken") || localStorage.getItem("sessionToken");
}

export const sessionRequest = (url, method, token, body) => {
    return request(url, method, body, {"Authorization": `Bearer ${token}`});
}

export const getRequest = (url) => {
    return sessionRequest(url, "GET", getToken());
}

export const postRequest = (url, body) => {
    return sessionRequest(url, "POST", getToken(), body);
}

export const putRequest = (url, body) => {
    return sessionRequest(url, "PUT", getToken(), body);
}

export const deleteRequest = (url) => {
    return sessionRequest(url, "DELETE", getToken());
}

export const patchRequest = (url, body) => {
    return sessionRequest(url, "PATCH", getToken(), body);
}

export const downloadFile = async (url) => {
    url = url.startsWith("/") ? url.substring(1) : url;
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}/api/${url}` : `/api/${url}`;
    const separator = fullUrl.includes("?") ? "&" : "?";
    const downloadUrl = `${fullUrl}${separator}token=${encodeURIComponent(getToken())}`;
    const fileName = url.split("?")[0].split("/").pop() || "download";
    
    if (isTauri()) return tauriDownload(downloadUrl, fileName);

    browserDownload({ url: downloadUrl, fileName });
}

export const getRawRequest = async (url) => {
    url = url.startsWith("/") ? url.substring(1) : url;
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}/api/${url}` : `/api/${url}`;
    
    const response = await tauriFetch(fullUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${getToken()}` },
    });

    if (response.status === 401) throw new Error("Unauthorized");
    if (!response.ok) throw new Error("Request failed");

    return response;
}