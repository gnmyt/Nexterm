import { isTauri, getActiveServerUrl } from "@/common/utils/TauriUtil.js";

export const getBaseUrl = () => {
    if (isTauri()) {
        const serverUrl = getActiveServerUrl();
        if (serverUrl) return serverUrl;
    }
    return "";
};

export const getWebSocketBaseUrl = () => {
    if (isTauri()) {
        const serverUrl = getActiveServerUrl();
        if (serverUrl) {
            const url = new URL(serverUrl);
            return `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
        }
    }
    return "";
};

export const getWebSocketUrl = (path, params = {}) => {
    const baseUrl = getWebSocketBaseUrl();
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    
    const url = baseUrl 
        ? `${baseUrl}${path}`
        : `${protocol}://${window.location.host}${path}`;
    
    const queryString = new URLSearchParams(params).toString();
    return queryString ? `${url}?${queryString}` : url;
};