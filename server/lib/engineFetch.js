const controlPlane = require("./controlPlane/ControlPlaneServer");

const engineFetch = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body || null;
    const timeout = options.timeout || 30000;
    const insecure = options.insecure !== undefined ? options.insecure : false;
    const engineId = options.engineId || null;

    if (!controlPlane.hasEngine()) {
        return nativeFetch(url, { method, headers, body, timeout, insecure });
    }

    const result = await controlPlane.httpFetch(method, url, headers, body, timeout, insecure, engineId);

    return {
        ok: result.statusCode >= 200 && result.statusCode < 300,
        status: result.statusCode,
        headers: result.headers,
        body: result.body,
        json() { return JSON.parse(result.body); },
    };
};

const nativeFetch = async (url, options = {}) => {
    const fetchOptions = {
        method: options.method || "GET",
        headers: options.headers || {},
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    };

    if (options.insecure) {
        const { Agent } = require("node:https");
        fetchOptions.dispatcher = new Agent({ rejectUnauthorized: false });
    }

    if (options.body) {
        fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    const resp = await fetch(url, fetchOptions);
    const text = await resp.text();

    return {
        ok: resp.ok,
        status: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        body: text,
        json() { return JSON.parse(text); },
    };
};

module.exports = { engineFetch, nativeFetch };
