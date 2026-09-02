const CHUNK = 32768;

const hasNativeBase64 = typeof Uint8Array.prototype.toBase64 === "function";

export const bytesToBase64 = (bytes) => {
    if (hasNativeBase64) return bytes.toBase64();

    const parts = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
    }
    return btoa(parts.join(""));
};

export const base64ToBytes = (b64) => {
    if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(b64);
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};

export const textToBase64 = (text) => bytesToBase64(new TextEncoder().encode(text));
