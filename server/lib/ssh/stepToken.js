const crypto = require("node:crypto");

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const rawSignature = (der, size) => {
    let offset = der[1] < 0x80 ? 2 : 2 + (der[1] & 0x7f);
    const readInteger = () => {
        if (der[offset] !== 0x02) throw new Error("step-ca provisioner signature is malformed");
        const length = der[offset + 1];
        let value = der.subarray(offset + 2, offset + 2 + length);
        offset += 2 + length;
        if (value.length && value[0] === 0x00) value = value.subarray(1);
        return Buffer.concat([Buffer.alloc(Math.max(0, size - value.length)), value]);
    };
    return Buffer.concat([readInteger(), readInteger()]);
};

const loadProvisionerKey = (secret) => {
    const trimmed = String(secret || "").trim();
    if (!trimmed) throw new Error("step-ca provisioner key is required");
    if (trimmed.startsWith("{")) {
        const jwk = JSON.parse(trimmed);
        if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
            throw new Error("step-ca provisioner key must be a P-256 private key");
        }
        return crypto.createPrivateKey({ key: jwk, format: "jwk" });
    }
    const key = crypto.createPrivateKey(trimmed);
    const jwk = key.export({ format: "jwk" });
    if (jwk.kty !== "EC" || jwk.crv !== "P-256") throw new Error("step-ca provisioner key must be a P-256 private key");
    return key;
};

const signAudience = (config) => {
    if (config?.audience) return String(config.audience);
    const url = new URL(config.url);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/ssh/sign`;
    url.search = "";
    url.hash = "";
    return url.href;
};

const publicKeyFingerprint = (publicKey) => {
    const fields = String(publicKey || "").trim().split(/\s+/);
    const blob = fields.length >= 2 ? fields[1] : fields[0];
    if (!blob) throw new Error("SSH public key is invalid");
    return crypto.createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
};

const provisionerKid = (secret, key) => {
    const trimmed = String(secret || "").trim();
    if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        if (parsed.kid) return String(parsed.kid);
    }
    const jwk = key.export({ format: "jwk" });
    const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
    return crypto.createHash("sha256").update(canonical).digest("base64url");
};

const mintStepSshToken = ({ secret, config, subject, publicKey, principals, keyId, validAfter, validBefore }) => {
    const key = loadProvisionerKey(secret);
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "ES256", typ: "JWT", kid: provisionerKid(secret, key) };
    const payload = {
        aud: signAudience(config),
        iss: config.provisioner,
        sub: subject || principals[0],
        iat: now,
        nbf: now,
        exp: now + 120,
        sha: publicKeyFingerprint(publicKey),
        step: {
            ssh: {
                certType: "user",
                keyID: keyId,
                principals,
                validAfter: new Date(validAfter * 1000).toISOString(),
                validBefore: new Date(validBefore * 1000).toISOString(),
            },
        },
    };
    const input = `${encode(header)}.${encode(payload)}`;
    const signature = rawSignature(crypto.sign("sha256", Buffer.from(input), key), 32);
    return `${input}.${signature.toString("base64url")}`;
};

module.exports = { mintStepSshToken, loadProvisionerKey, signAudience };
