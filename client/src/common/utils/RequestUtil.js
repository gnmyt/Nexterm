import { isTauri, getActiveServerUrl } from "@/common/utils/TauriUtil.js";

let cachedUserAgent = null;

const getTauriUserAgent = async () => {
    if (cachedUserAgent) return cachedUserAgent;
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        cachedUserAgent = await invoke("get_user_agent");
        return cachedUserAgent;
    } catch {
        return "NextermConnector/1.0.0";
    }
};

export const tauriDownload = async (url, defaultFileName, options = {}) => {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
    
    const filePath = await save({ defaultPath: defaultFileName, title: "Save File", ...options });
    if (!filePath) return null;
    
    const userAgent = await getTauriUserAgent();
    const fetchOptions = { method: "GET", ...options.fetchOptions, headers: { ...options.fetchOptions?.headers, "User-Agent": userAgent } };
    const response = await tFetch(url, fetchOptions);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    await writeFile(filePath, new Uint8Array(await response.arrayBuffer()));
    return filePath;
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

const tauriFetch = async (url, options = {}) => {
    if (isTauri()) {
        try {
            const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
            const userAgent = await getTauriUserAgent();
            const headers = { ...options.headers, "User-Agent": userAgent };
            return tFetch(url, { ...options, headers });
        } catch (e) {
            console.warn("Tauri HTTP plugin not available, falling back to native fetch");
        }
    }
    return fetch(url, options);
};

export const uploadFile = async (url, file, { onProgress, timeout = 300000 } = {}) => {
    const baseUrl = getBaseUrl();
    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

    if (isTauri()) {
        try {
            const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
            const userAgent = await getTauriUserAgent();
            const arrayBuffer = await file.arrayBuffer();
            
            const response = await tFetch(fullUrl, {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream", "User-Agent": userAgent },
                body: arrayBuffer,
            });

            if (onProgress) onProgress(100);

            if (!response.ok) {
                const text = await response.text();
                let error = `Upload failed (${response.status})`;
                try { error = JSON.parse(text).error || error; } catch {}
                throw new Error(error);
            }

            const text = await response.text();
            try { return JSON.parse(text); } catch { return { success: true }; }
        } catch (e) {
            if (e.message?.includes("Upload failed")) throw e;
            console.warn("Tauri upload failed, trying XHR fallback:", e);
        }
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); }
            } else {
                let errorMsg = `Upload failed (${xhr.status})`;
                try { errorMsg = JSON.parse(xhr.responseText).error || errorMsg; } catch {}
                reject(new Error(errorMsg));
            }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.timeout = timeout;

        xhr.open("POST", fullUrl, true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.send(file);
    });
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

const getToken = () => {
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
    
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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