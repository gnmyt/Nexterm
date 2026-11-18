const crypto = require("node:crypto");
const {
    generateEd25519KeyPair,
    signUserCertificate,
    describeCertificate,
    normalizeCertificate,
} = require("./openssh");
const { resolvePrincipals, renderKeyId, normalizeSourceAddress, asArray, resolveTtl } = require("./principals");
const { mintStepSshToken } = require("./stepToken");

const redactSecrets = (message) => {
    let text = String(message || "SSH certificate request failed");
    let begin = text.indexOf("-----BEGIN");
    while (begin !== -1) {
        const end = text.indexOf("-----END", begin + 11);
        const close = end === -1 ? -1 : text.indexOf("-----", end + 8);
        if (close === -1) break;
        text = `${text.slice(0, begin)}[redacted]${text.slice(close + 5)}`;
        begin = text.indexOf("-----BEGIN");
    }
    return text.slice(0, 300);
};

const safeMessage = (message) => redactSecrets(message);

const readResponse = async (response) => {
    const text = await response.text();
    if (text.length > 65536) throw new Error("SSH certificate authority returned a response that is too large");
    const trimmed = text.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("ssh-")) return { certificate: trimmed };
    try {
        return JSON.parse(trimmed);
    } catch {
        throw new Error("SSH certificate authority returned an unreadable response");
    }
};

const certificateFromPayload = (payload) => {
    const certificate = payload?.certificate || payload?.crt || payload?.signed_key || payload?.data?.signed_key;
    if (!certificate) {
        const errors = payload?.errors || payload?.error;
        throw new Error(safeMessage(Array.isArray(errors) ? errors.join(", ") : errors || "SSH certificate authority did not return a certificate"));
    }
    return normalizeCertificate(certificate);
};

const postJson = async (fetchImpl, url, { headers, body }) => {
    let response;
    try {
        response = await fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json", ...headers },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
            redirect: "error",
        });
    } catch (error) {
        throw new Error(safeMessage(error.name === "TimeoutError" ? "SSH certificate authority timed out" : "SSH certificate authority could not be reached"));
    }
    const payload = await readResponse(response);
    if (!response.ok) {
        const errors = payload?.errors || payload?.error || payload?.message;
        throw new Error(safeMessage(Array.isArray(errors) ? errors.join(", ") : errors || `SSH certificate authority returned ${response.status}`));
    }
    return payload;
};

const assertHttpUrl = (value, label) => {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${label} is invalid`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${label} must use http or https`);
    return url;
};

const signLocal = ({ secret, rawPublic, keyId, principals, serial, validAfter, validBefore, sourceAddress }) => signUserCertificate({
    caPrivateKey: secret,
    rawPublic,
    keyId,
    principals,
    serial,
    validAfter,
    validBefore,
    sourceAddress,
});

const trimSlashes = (value) => {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === "/") start += 1;
    while (end > start && value[end - 1] === "/") end -= 1;
    return value.slice(start, end);
};

const signVault = async ({ ca, secret, publicKey, principals, keyId, ttlSeconds, sourceAddress, fetchImpl }) => {
    const address = assertHttpUrl(ca.config?.address, "Vault address");
    const mount = trimSlashes(String(ca.config?.mount || "ssh"));
    const role = ca.config?.role;
    if (!mount || !role) throw new Error("Vault mount and role are required");
    const url = new URL(`/v1/${mount}/sign/${encodeURIComponent(role)}`, address);
    const headers = { "x-vault-token": secret };
    if (ca.config?.namespace) headers["x-vault-namespace"] = ca.config.namespace;
    const body = {
        public_key: publicKey,
        valid_principals: principals.join(","),
        cert_type: "user",
        ttl: `${ttlSeconds}s`,
        key_id: keyId,
    };
    if (sourceAddress) body.critical_options = { "source-address": sourceAddress };
    return certificateFromPayload(await postJson(fetchImpl, url, { headers, body }));
};

const stepPublicKey = (publicKey) => {
    const fields = String(publicKey || "").trim().split(/\s+/);
    const blob = fields.length >= 2 ? fields[1] : fields[0];
    if (!blob) throw new Error("SSH public key is invalid");
    return blob;
};

const signStep = async ({ ca, secret, publicKey, principals, keyId, validAfter, validBefore, fetchImpl }) => {
    const endpoint = new URL("/ssh/sign", assertHttpUrl(ca.config?.url, "step-ca URL"));
    const tokenMode = ca.config?.tokenMode || "ott";
    const headers = {};
    const body = {
        publicKey: stepPublicKey(publicKey),
        certType: "user",
        keyId,
        principals,
        validAfter: new Date(validAfter * 1000).toISOString(),
        validBefore: new Date(validBefore * 1000).toISOString(),
    };
    if (tokenMode === "bearer") headers.authorization = `Bearer ${secret}`;
    else if (tokenMode === "provisioner") {
        body.ott = mintStepSshToken({ secret, config: ca.config, subject: ca.subject, publicKey, principals, keyId, validAfter, validBefore });
    } else body.ott = secret;
    return certificateFromPayload(await postJson(fetchImpl, endpoint, { headers, body }));
};

const signWebhook = async ({ ca, secret, publicKey, principals, keyId, ttlSeconds, validAfter, validBefore, sourceAddress, fetchImpl }) => {
    const url = assertHttpUrl(ca.config?.url, "Webhook URL");
    const headers = {};
    if (secret) headers.authorization = `Bearer ${secret}`;
    return certificateFromPayload(await postJson(fetchImpl, url, {
        headers,
        body: {
            publicKey,
            principals,
            keyId,
            ttlSeconds,
            validAfter: new Date(validAfter * 1000).toISOString(),
            validBefore: new Date(validBefore * 1000).toISOString(),
            sourceAddress,
            certType: "user",
        },
    }));
};

const signers = { local: signLocal, vault: signVault, step: signStep, webhook: signWebhook };

const signWithBackend = async (request) => {
    const signer = signers[request.ca.backend];
    if (!signer) throw new Error("SSH certificate authority backend is not supported");
    return signer(request);
};

const issueForSession = async ({ ca, secret, identity, account, entry, fetchImpl = global.fetch }) => {
    if (!ca?.enabled) throw new Error("SSH certificate authority is disabled");
    if (!secret) throw new Error("SSH certificate authority has no signing secret");
    if (ca.organizationId && Number(ca.organizationId) !== Number(entry?.organizationId)) {
        throw new Error("SSH certificate authority is not available for this server");
    }

    const username = identity?.username || "";
    const principals = resolvePrincipals({
        username,
        groups: account?.oidcGroups,
        groupPrincipalMappings: ca.groupPrincipalMappings,
        extraPrincipals: ca.extraPrincipals,
    });
    const keyId = renderKeyId(ca.keyIdTemplate, {
        username,
        account: account?.username || "",
        subject: account?.idpSubject || "",
        server: entry?.name || "",
        host: entry?.config?.ip || "",
    });
    const ttlSeconds = resolveTtl({ ca, account, entry });
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 30;
    const validBefore = now + ttlSeconds;
    const sourceAddress = normalizeSourceAddress(ca.sourceAddress);
    const serial = crypto.randomInt(1, 2147483647);
    const pair = generateEd25519KeyPair(keyId);
    let certificate;
    try {
        certificate = await signWithBackend({
        ca: { ...ca, config: ca.config || {}, extraPrincipals: asArray(ca.extraPrincipals), subject: account?.idpSubject || account?.username || username },
        secret,
        publicKey: pair.publicKey,
        rawPublic: pair.rawPublic,
        principals,
        keyId,
        ttlSeconds,
        validAfter,
        validBefore,
        sourceAddress,
        serial,
        fetchImpl,
    });
    } catch (error) {
        throw new Error(safeMessage(error.message));
    }
    let described = {};
    try {
        described = describeCertificate(certificate);
    } catch (error) {
        if (ca.backend === "local") throw new Error("The issued SSH certificate could not be verified");
    }
    if (ca.backend === "local" && described.signatureValid === false) {
        throw new Error("The issued SSH certificate could not be verified");
    }

    return {
        privateKey: pair.privateKey,
        certificate,
        metadata: {
            caId: ca.id,
            caName: ca.name,
            backend: ca.backend,
            keyId: described.keyId || keyId,
            serial: described.serial || String(serial),
            principals: described.principals?.length ? described.principals : principals,
            validAfter: described.validAfter || validAfter,
            validBefore: described.validBefore || validBefore,
            sourceAddress: described.sourceAddress || sourceAddress,
            identityId: identity?.id || null,
            identityName: identity?.name || null,
            account: account?.username || null,
            idpSubject: account?.idpSubject || null,
            entryId: entry?.id || null,
            server: entry?.name || null,
            host: entry?.config?.ip || null,
            ttlSeconds,
            startedAt: new Date().toISOString(),
        },
    };
};

module.exports = {
    issueForSession,
    signWithBackend,
    safeMessage,
};
