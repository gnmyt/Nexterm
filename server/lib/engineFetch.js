const https = require("node:https");
const http = require("node:http");
const controlPlane = require("./controlPlane/ControlPlaneServer");
const hostTrust = require("../utils/hostTrust");

const endpointOf = (url) => {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    return { host, port: Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80), secure: parsed.protocol === "https:" };
};

const scopeOf = (options) => options.scope || hostTrust.currentScope() || hostTrust.SYSTEM_SCOPE;

const toResponse = (status, headers, body) => ({
    ok: status >= 200 && status < 300,
    status,
    headers,
    body,
    json() { return JSON.parse(body); },
});

const engineFetch = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body || null;
    const timeout = options.timeout || 30000;
    const engineId = options.engineId || null;
    const scope = scopeOf(options);

    if (!controlPlane.hasEngine()) {
        return nativeFetch(url, { method, headers, body, timeout, scope });
    }

    const { host, port } = endpointOf(url);
    const trust = await hostTrust.tlsTrustParams(scope, host, port);
    const result = await controlPlane.httpFetch(method, url, headers, body, timeout, trust, engineId);

    return toResponse(result.statusCode, result.headers, result.body);
};

const nativeFetch = async (url, options = {}) => {
    const { host, port, secure } = endpointOf(url);
    const scope = scopeOf(options);
    const timeout = options.timeout || 30000;
    const body = options.body
        ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
        : null;

    const socket = secure ? await hostTrust.openTrustedTlsSocket(scope, host, port, { timeout }) : null;

    return new Promise((resolve, reject) => {
        const request = (secure ? https : http).request(url, {
            method: options.method || "GET",
            headers: { ...options.headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) },
            agent: false,
            ...(socket ? { createConnection: () => socket } : {}),
        }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve(toResponse(response.statusCode, response.headers, Buffer.concat(chunks).toString())));
            response.on("error", reject);
        });

        request.setTimeout(timeout, () => request.destroy(new Error("Request timeout")));
        request.on("error", reject);
        request.end(body || undefined);
    });
};

module.exports = { engineFetch, nativeFetch };
