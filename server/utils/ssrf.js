const dns = require("node:dns").promises;
const net = require("node:net");

const isBlockedIPv4 = (ip) => {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
};

const isBlockedIPv6 = (ip) => {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80")) return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isBlockedIPv4(m[1]);
    return false;
};

const isBlockedAddress = (ip) =>
    net.isIPv6(ip) ? isBlockedIPv6(ip) : isBlockedIPv4(ip);

module.exports.assertPublicUrl = async (rawUrl, { allowInsecureProtocols = false } = {}) => {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("Invalid URL");
    }

    if (!allowInsecureProtocols && url.protocol !== "http:" && url.protocol !== "https:")
        throw new Error(`Blocked URL protocol: ${url.protocol}`);

    const host = url.hostname;

    if (net.isIP(host)) {
        if (isBlockedAddress(host)) throw new Error("Blocked private/loopback address");
        return;
    }

    let addresses;
    try {
        addresses = await dns.lookup(host, { all: true });
    } catch {
        throw new Error(`Could not resolve host: ${host}`);
    }
    if (!addresses.length) throw new Error(`Could not resolve host: ${host}`);
    for (const { address } of addresses) {
        if (isBlockedAddress(address))
            throw new Error("Blocked private/loopback address");
    }
};

module.exports.isBlockedAddress = isBlockedAddress;