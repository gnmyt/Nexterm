const SessionManager = require("./SessionManager");
const logger = require("../utils/logger");

const OP_TRANSFER_PROGRESS = 0x13;
const PROGRESS_INTERVAL_MS = 250;
const FINISHED_RETENTION_MS = 5000;
const TRANSFER_ID_PATTERN = /^[\w-]{1,64}$/;

const transfers = new Map();

const isValidTransferId = (id) => typeof id === "string" && TRANSFER_ID_PATTERN.test(id);

const serialize = (transfer) => ({
    id: transfer.id,
    name: transfer.name,
    count: transfer.count,
    direction: transfer.direction,
    action: transfer.action,
    sessionIds: transfer.sessionIds,
    total: transfer.total,
    transferred: transfer.transferred,
    state: transfer.state,
    error: transfer.error,
});

const broadcast = (transfer) => {
    const frame = Buffer.concat([Buffer.from([OP_TRANSFER_PROGRESS]), Buffer.from(JSON.stringify(serialize(transfer)))]);
    for (const sessionId of transfer.sessionIds) {
        const session = SessionManager.get(sessionId);
        if (!session) continue;
        for (const ws of session.connectedWs) {
            if (!ws.isSftp || ws.readyState !== 1) continue;
            try { ws.send(frame); } catch {}
        }
    }
};

const flush = (transfer) => {
    clearTimeout(transfer.flushTimer);
    transfer.flushTimer = null;
    transfer.lastBroadcast = Date.now();
    broadcast(transfer);
};

const register = ({ id, sessionId, sessionIds, name, count = 1, direction, action = null, total, cancel }) => {
    if (id === null) return null;
    if (!isValidTransferId(id)) throw new Error("Invalid transfer id");
    if (transfers.has(id)) throw new Error("Transfer id already in use");
    const transfer = {
        id, name, count, direction, action, cancel,
        sessionIds: sessionIds ?? [sessionId],
        total: total || 0,
        transferred: 0,
        state: "active",
        error: null,
        lastBroadcast: 0,
        flushTimer: null,
        retentionTimer: null,
    };
    transfers.set(id, transfer);
    flush(transfer);
    return transfer;
};

const progress = (id, transferred) => {
    if (id === null) return;
    const transfer = transfers.get(id);
    if (!transfer || transfer.state !== "active") return;
    transfer.transferred = transferred;
    if (transfer.flushTimer) return;
    const elapsed = Date.now() - transfer.lastBroadcast;
    if (elapsed >= PROGRESS_INTERVAL_MS) flush(transfer);
    else transfer.flushTimer = setTimeout(() => flush(transfer), PROGRESS_INTERVAL_MS - elapsed);
};

const setTotal = (id, total) => {
    const transfer = transfers.get(id);
    if (!transfer || transfer.state !== "active") return;
    transfer.total = total;
    flush(transfer);
};

const finish = (id, { error = null, cancelled = false } = {}) => {
    if (id === null) return;
    const transfer = transfers.get(id);
    if (!transfer || transfer.state !== "active") return;
    if (cancelled) transfer.state = "cancelled";
    else if (error) { transfer.state = "error"; transfer.error = error; }
    else transfer.state = "done";
    flush(transfer);
    transfer.retentionTimer = setTimeout(() => transfers.delete(id), FINISHED_RETENTION_MS);
};

const cancel = (id, sessionId) => {
    const transfer = transfers.get(id);
    if (!transfer || !transfer.sessionIds.includes(sessionId) || transfer.state !== "active") return false;
    logger.info("Transfer cancelled by client", { id, sessionId, name: transfer.name });
    try { transfer.cancel(); } catch (err) { logger.warn("Transfer cancel failed", { id, error: err.message }); }
    return true;
};

const list = (sessionId) => [...transfers.values()]
    .filter((transfer) => transfer.sessionIds.includes(sessionId) && transfer.state === "active")
    .map(serialize);

module.exports = { OP_TRANSFER_PROGRESS, isValidTransferId, register, progress, setTotal, finish, cancel, list };
