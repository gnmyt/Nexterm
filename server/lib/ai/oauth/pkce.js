const crypto = require("node:crypto");

const base64Url = (buffer) => buffer.toString("base64")
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const createPkce = () => {
    const verifier = base64Url(crypto.randomBytes(32));
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    const state = base64Url(crypto.randomBytes(32));
    return { verifier, challenge, state };
};

const randomId = () => crypto.randomUUID();

const decodeJwtPayload = (token) => {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    try {
        const json = Buffer.from(parts[1].replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
};

module.exports = { base64Url, createPkce, randomId, decodeJwtPayload };
