import { isTauri, getActiveServerUrl } from "@/common/utils/TauriUtil.js";

const getBaseUrl = () => {
    if (isTauri()) {
        const activeServerUrl = getActiveServerUrl();
        if (activeServerUrl) {
            return activeServerUrl;
        }
    }
    return "";
};

const tauriFetch = async (url, options) => {
    if (isTauri()) {
        try {
            const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
            return tFetch(url, options);
        } catch (e) {
            console.warn("Tauri HTTP plugin not available, falling back to native fetch");
        }
    }
    return fetch(url, options);
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