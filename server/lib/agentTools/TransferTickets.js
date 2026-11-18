const crypto = require("node:crypto");
const SessionManager = require("../SessionManager");

const MAX_PENDING_PER_ACCOUNT = 20;
const RESULT_RETENTION_MS = 60 * 60 * 1000;

const tickets = new Map();
const byTokenHash = new Map();

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const redeem = (ticket, status) => {
    byTokenHash.delete(ticket.tokenHash);
    clearTimeout(ticket.timer);
    ticket.status = status;
};

const settle = (ticket, status, result = {}) => {
    redeem(ticket, status);
    Object.assign(ticket, result);
    if (ticket.ownsSession) SessionManager.remove(ticket.sessionId).catch(() => {});
    ticket.timer = setTimeout(() => tickets.delete(ticket.id), RESULT_RETENTION_MS);
    ticket.timer.unref?.();
};

const create = ({ ctx, sessionId, ownsSession, entry, path, direction, ttlMs, maxBytes }) => {
    const pendingCount = [...byTokenHash.values()].filter((t) => t.ctx.accountId === ctx.accountId).length;
    if (pendingCount >= MAX_PENDING_PER_ACCOUNT) {
        throw new Error(`Too many open transfer links (max ${MAX_PENDING_PER_ACCOUNT}); use or let some expire first`);
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const ticket = {
        id: crypto.randomUUID(), tokenHash: hashToken(token), status: "pending",
        ctx, sessionId, ownsSession, entryId: entry.id,
        path, direction, maxBytes, expiresAt: new Date(Date.now() + ttlMs),
    };
    ticket.timer = setTimeout(() => settle(ticket, "expired"), ttlMs);
    ticket.timer.unref?.();

    tickets.set(ticket.id, ticket);
    byTokenHash.set(ticket.tokenHash, ticket);
    return { token, ticket };
};

const peek = (token) => byTokenHash.get(hashToken(token)) || null;

const start = (ticket) => redeem(ticket, "in_progress");

const finish = (ticket, { bytes, sha256 = null, error = null }) =>
    settle(ticket, error ? "failed" : "completed", { bytes, sha256, error });

const getStatus = (transferId, accountId) => {
    const ticket = tickets.get(transferId);
    if (!ticket || ticket.ctx.accountId !== accountId) return null;
    const { id, direction, path, entryId, status, expiresAt, bytes, sha256, error } = ticket;
    return { transferId: id, direction, path, entryId, status, expiresAt, bytes, sha256, error };
};

module.exports = { create, peek, start, finish, getStatus };
