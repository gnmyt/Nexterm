const controlPlane = require("../../lib/controlPlane/ControlPlaneServer");

const checkServerStatusBatch = async (entries, timeoutMs = 2000) => {
    if (!controlPlane.hasEngine()) throw new Error("No engine connected");

    const targets = [];
    const skipped = [];

    for (const entry of entries) {
        const { ip, port } = entry.config || {};
        if (!ip || !port) {
            skipped.push({ id: entry.id, status: "offline" });
            continue;
        }
        targets.push({ id: String(entry.id), host: ip, port });
    }

    if (targets.length === 0) return skipped;

    const result = await controlPlane.portCheck(targets, timeoutMs);
    const statusMap = new Map(result.entries.map(e => [e.id, e.online ? "online" : "offline"]));
    return [
        ...targets.map(t => ({ id: Number(t.id), status: statusMap.get(t.id) || "offline" })),
        ...skipped,
    ];
}

module.exports = { checkServerStatusBatch };