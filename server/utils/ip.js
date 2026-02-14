const net = require("net");

const stripZone = (ip) => {
    if (!ip || typeof ip !== "string") return ip;
    const percentIndex = ip.indexOf("%");
    return percentIndex === -1 ? ip : ip.slice(0, percentIndex);
};

const normalizeIp = (ip) => {
    if (!ip || typeof ip !== "string") return ip;

    const first = ip.split(",")[0].trim();
    const cleaned = stripZone(first);

    if (/^::ffff:/i.test(cleaned)) {
        const v4 = cleaned.replace(/^::ffff:/i, "");
        if (net.isIP(v4) === 4) return v4;
    }

    if (/^0:0:0:0:0:ffff:/i.test(cleaned)) {
        const v4 = cleaned.split(":").pop();
        if (net.isIP(v4) === 4) return v4;
    }

    return cleaned;
};

module.exports = { normalizeIp };
