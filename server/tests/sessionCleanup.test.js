const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexterm-session-cleanup-"));
process.env.NODE_ENV = "test";
process.env.DB_TYPE = "sqlite";
process.env.DB_STORAGE_PATH = path.join(tempDir, "nexterm.db");
process.env.SESSION_RETENTION_DAYS = "30";
process.env.LOG_LEVEL = "error";

const db = require("../utils/database");
const Session = require("../models/Session");
const { hashSessionToken } = require("../models/Session");
const DeviceCode = require("../models/DeviceCode");
const {
    MS_PER_DAY,
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    parseRetentionDays,
    getSessionRetentionCutoff,
    isSessionExpired,
    cleanupInactiveSessions,
    start,
    stop,
    isRunning,
} = require("../utils/sessionCleanup");
const { cleanupExpiredCodes, CODE_EXPIRY_MS, CODE_RETENTION_MS } = require("../utils/deviceCodeCleanup");
const SessionSettings = require("../models/SessionSettings");
const { findActiveSession } = require("../utils/loginSession");
const SessionManager = require("../lib/SessionManager");
const { listSessions } = require("../controllers/session");
const { createCode, authorizeCode, pollToken, checkLinkStatus } = require("../controllers/deviceCode");

const createSession = (accountId, lastActivity) => Session.create({
    accountId,
    ip: "127.0.0.1",
    userAgent: "test",
    lastActivity,
});

const createDeviceCode = (createdAt, sessionId = null, redeemedAt = null) => DeviceCode.create({
    sessionId,
    redeemedAt,
    ipAddress: "127.0.0.1",
    userAgent: "test",
    clientType: "mobile",
    createdAt,
});

const createTerminalSession = (sessionId, authSessionId) => SessionManager.create({
    accountId: 1,
    entryId: 1,
    configuration: {},
    authSessionId,
    sessionId,
});

test.before(async () => {
    assert.equal(db.getDialect(), "sqlite");

    await Session.sync({ force: true });
    await SessionSettings.sync({ force: true });
    await DeviceCode.sync({ force: true });
});

test.beforeEach(async () => {
    await SessionManager.removeAllByAccountId(1);
    await SessionManager.removeAllByAccountId(2);
    await Session.destroy({ where: {} });
    await DeviceCode.destroy({ where: {} });
});

test.after(async () => {
    await stop();
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test("parses the retention setting and falls back to the default", () => {
    assert.equal(DEFAULT_RETENTION_DAYS, 30);
    assert.equal(parseRetentionDays("7"), 7);
    assert.equal(parseRetentionDays(14), 14);
    assert.equal(parseRetentionDays(""), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays("0"), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays("-1"), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays("30.5"), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays("invalid"), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays("1e20"), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays(String(MAX_RETENTION_DAYS + 1)), DEFAULT_RETENTION_DAYS);
    assert.equal(parseRetentionDays(String(MAX_RETENTION_DAYS)), MAX_RETENTION_DAYS);
});

test("calculates the retention cutoff from the configured number of days", () => {
    const now = Date.UTC(2026, 9, 28, 12, 0, 0);

    assert.equal(getSessionRetentionCutoff(now, 30).getTime(), now - 30 * MS_PER_DAY);
    assert.equal(getSessionRetentionCutoff(now, 7).getTime(), now - 7 * MS_PER_DAY);
    assert.equal(getSessionRetentionCutoff(now, "1e20").getTime(), now - DEFAULT_RETENTION_DAYS * MS_PER_DAY);
});

test("detects expired and invalid session activity timestamps", () => {
    const now = Date.now();

    assert.equal(isSessionExpired(new Date(now - 31 * MS_PER_DAY), now), true);
    assert.equal(isSessionExpired(new Date(now - 29 * MS_PER_DAY), now), false);
    assert.equal(isSessionExpired(null, now), true);
    assert.equal(isSessionExpired("not-a-date", now), true);
});

test("removes only sessions inactive for longer than the retention period", async () => {
    const now = Date.now();
    const stale = await createSession(1, new Date(now - 31 * MS_PER_DAY));
    const recent = await createSession(1, new Date(now - 29 * MS_PER_DAY));
    const boundary = await createSession(1, new Date(now - 30 * MS_PER_DAY));
    const unknownActivity = await createSession(1, null);
    createTerminalSession("stale-terminal", stale.id);
    createTerminalSession("recent-terminal", recent.id);

    const removed = await cleanupInactiveSessions({ now, retentionDays: 30 });

    assert.equal(removed, 2);
    assert.equal(await Session.findByPk(stale.id), null);
    assert.equal(await Session.findByPk(unknownActivity.id), null);
    assert.equal(SessionManager.get("stale-terminal"), null);
    assert.ok(await Session.findByPk(recent.id));
    assert.ok(await Session.findByPk(boundary.id));
    assert.ok(SessionManager.get("recent-terminal"));
});

test("removes inactive sessions across multiple cleanup batches", async () => {
    const now = Date.now();
    const staleActivity = new Date(now - 31 * MS_PER_DAY);

    await Session.bulkCreate(Array.from({ length: 501 }, (_, index) => ({
        accountId: 1,
        tokenHash: hashSessionToken(`${now}-${index}`),
        ip: "127.0.0.1",
        userAgent: "test",
        lastActivity: staleActivity,
    })));

    assert.equal(await cleanupInactiveSessions({ now, retentionDays: 30 }), 501);
    assert.equal(await Session.count(), 0);
});

test("cleanup leaves terminals alone when the database delete fails", async () => {
    const now = Date.now();
    const login = await createSession(1, new Date(now - 31 * MS_PER_DAY));
    createTerminalSession("db-failure-terminal", login.id);

    const failingModel = {
        findAll: async () => [{ id: login.id }],
        destroy: async () => { throw new Error("database unavailable"); },
    };

    await assert.rejects(
        cleanupInactiveSessions({ now, retentionDays: 30, SessionModel: failingModel }),
        /database unavailable/,
    );
    assert.ok(SessionManager.get("db-failure-terminal"));
    assert.ok(await Session.findByPk(login.id));
});

test("findActiveSession rejects expired tokens and tears down their connections", async () => {
    const now = Date.now();
    const stale = await createSession(1, new Date(now - 31 * MS_PER_DAY));
    const recent = await createSession(1, new Date(now - 1 * MS_PER_DAY));
    createTerminalSession("expired-terminal", stale.id);
    createTerminalSession("recent-terminal", recent.id);

    assert.equal(await findActiveSession(stale.token), null);
    assert.equal(await Session.findByPk(stale.id), null);
    assert.equal(SessionManager.get("expired-terminal"), null);
    assert.equal((await findActiveSession(recent.token)).id, recent.id);
    assert.ok(SessionManager.get("recent-terminal"));
});

test("revokes the terminal sessions bound to a login session", async () => {
    const session = await createSession(1, new Date());
    createTerminalSession("owned-terminal", session.id);
    createTerminalSession("other-terminal", session.id + 1);

    assert.equal(await SessionManager.removeAllByAuthSessionId(session.id), 1);
    assert.equal(SessionManager.get("owned-terminal"), null);
    assert.ok(SessionManager.get("other-terminal"));
});

test("resuming a terminal session refreshes its login session binding", async () => {
    createTerminalSession("resumed-terminal", null);

    assert.equal(SessionManager.resume("resumed-terminal", null, null, 7), true);
    assert.equal(SessionManager.get("resumed-terminal").authSessionId, 7);
});

test("a null login session id never removes unbound terminals", async () => {
    createTerminalSession("unbound-terminal", null);

    assert.equal(await SessionManager.removeAllByAuthSessionId(null), 0);
    assert.ok(SessionManager.get("unbound-terminal"));
});

test("shared viewer activity does not keep the owner login session alive", async () => {
    const now = Date.now();
    const login = await createSession(1, new Date(now - 60 * 60 * 1000));
    createTerminalSession("shared-terminal", login.id);

    SessionManager.updateActivity("shared-terminal", { touchLoginSession: false });
    await new Promise(resolve => setTimeout(resolve, 25));

    const untouched = await Session.findByPk(login.id);
    // SQLite may hand back the timestamp as a string, so normalize before comparing.
    assert.ok(new Date(untouched.lastActivity).getTime() < now - 30 * 60 * 1000);

    SessionManager.updateActivity("shared-terminal");
    await new Promise(resolve => setTimeout(resolve, 25));

    const touched = await Session.findByPk(login.id);
    assert.ok(new Date(touched.lastActivity).getTime() > now - 5000);
});

test("revoking a login session disconnects its organization viewers", async () => {
    const login = await createSession(1, new Date());
    createTerminalSession("owner-terminal", login.id + 1000);

    const closes = [];
    const ws = { close: (code, reason) => closes.push([code, reason]) };
    SessionManager.addWebSocket("owner-terminal", ws, true, {
        accountId: 1,
        kind: "organization",
        authSessionId: login.id,
        writable: true,
    });

    assert.equal(SessionManager.disconnectAuthSessionViewers(login.id), 1);
    assert.deepEqual(closes, [[4016, "Session invalidated"]]);
    assert.equal(SessionManager.disconnectAuthSessionViewers(null), 0);
});

test("session listing hides inactive sessions immediately", async () => {
    const now = Date.now();
    const stale = await createSession(1, new Date(now - 31 * MS_PER_DAY));
    const recent = await createSession(1, new Date(now - 1 * MS_PER_DAY));
    await createSession(2, new Date(now));

    const sessions = await listSessions(1, recent.id);

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, recent.id);
    assert.equal(sessions[0].current, true);
    assert.notEqual(sessions[0].id, stale.id);
});

test("session listing sorts sessions by most recent activity", async () => {
    const now = Date.now();
    const older = await createSession(1, new Date(now - 2 * MS_PER_DAY));
    const newer = await createSession(1, new Date(now - 1 * MS_PER_DAY));

    const sessions = await listSessions(1, null);

    assert.deepEqual(sessions.map(session => session.id), [newer.id, older.id]);
});

test("device code authorization still hands the session token to the polling client", async () => {
    const deviceCode = await createCode({ clientType: "mobile", ipAddress: "127.0.0.1", userAgent: "test" });

    const authorized = await authorizeCode({ code: deviceCode.code, accountId: 1 });
    assert.equal(authorized.message, "Device authorized successfully");

    const poll = await pollToken({ token: deviceCode.token });
    assert.equal(poll.status, "authorized");

    const session = await Session.findOne({ where: { tokenHash: hashSessionToken(poll.token) } });
    assert.ok(session);
    assert.equal(session.accountId, 1);

    const secondPoll = await pollToken({ token: deviceCode.token });
    assert.equal(secondPoll.status, "invalid");
});

test("removes sessions that belong to expired device codes but keeps short-lived tombstones", async () => {
    const now = Date.now();
    const expiredSession = await createSession(1, new Date(now));
    const activeSession = await createSession(1, new Date(now));

    const expiredAuthorizedCode = await createDeviceCode(new Date(now - CODE_EXPIRY_MS - 1000), expiredSession.id);
    const activeAuthorizedCode = await createDeviceCode(new Date(now - CODE_EXPIRY_MS + 60 * 1000), activeSession.id);
    const expiredUnredeemedCode = await createDeviceCode(new Date(now - CODE_EXPIRY_MS - 1000));
    const oldUnredeemedCode = await createDeviceCode(new Date(now - CODE_RETENTION_MS - 1000));

    const removedCodes = await cleanupExpiredCodes(now);

    assert.equal(removedCodes, 1);
    assert.equal(await Session.findByPk(expiredSession.id), null);
    assert.ok(await Session.findByPk(activeSession.id));
    assert.equal((await DeviceCode.findByPk(expiredAuthorizedCode.id)).sessionId, null);
    assert.ok(await DeviceCode.findByPk(activeAuthorizedCode.id));
    assert.ok(await DeviceCode.findByPk(expiredUnredeemedCode.id));
    assert.equal(await DeviceCode.findByPk(oldUnredeemedCode.id), null);
});

test("device link status keeps reporting expired links instead of a false success", async () => {
    const now = Date.now();
    const session = await createSession(1, new Date(now));
    const expiredCode = await createDeviceCode(new Date(now - CODE_EXPIRY_MS - 1000), session.id);

    assert.equal((await checkLinkStatus({ code: expiredCode.code })).status, "expired");
    assert.equal(await Session.findByPk(session.id), null);
    assert.equal((await DeviceCode.findByPk(expiredCode.id)).sessionId, null);

    assert.equal((await checkLinkStatus({ code: expiredCode.code })).status, "expired");
    assert.ok(await DeviceCode.findByPk(expiredCode.id));
});

test("unknown device codes are not reported as claimed", async () => {
    assert.equal((await checkLinkStatus({ code: "ABCD-EFGH" })).status, "expired");
});

test("polling an expired device code destroys its session and keeps a tombstone", async () => {
    const now = Date.now();
    const session = await createSession(1, new Date(now));
    const expiredCode = await createDeviceCode(new Date(now - CODE_EXPIRY_MS - 1000), session.id);

    assert.equal((await pollToken({ token: expiredCode.token })).status, "invalid");
    assert.equal(await Session.findByPk(session.id), null);
    assert.equal((await DeviceCode.findByPk(expiredCode.id)).sessionId, null);
});

test("device link status reports claimed after a successful redemption", async () => {
    const deviceCode = await createCode({ clientType: "mobile", ipAddress: "127.0.0.1", userAgent: "test" });

    await authorizeCode({ code: deviceCode.code, accountId: 1 });
    const poll = await pollToken({ token: deviceCode.token });
    assert.equal(poll.status, "authorized");

    const session = await Session.findOne({ where: { tokenHash: hashSessionToken(poll.token) } });
    const codeRow = await DeviceCode.findOne({ where: { token: deviceCode.token } });
    assert.equal(codeRow.sessionId, null);
    assert.ok(codeRow.redeemedAt);

    assert.equal((await checkLinkStatus({ code: deviceCode.code })).status, "claimed");
    assert.equal((await pollToken({ token: deviceCode.token })).status, "invalid");
    assert.equal((await authorizeCode({ code: deviceCode.code, accountId: 1 })).code, 400);

    await cleanupExpiredCodes(Date.now() + CODE_EXPIRY_MS + 1000);
    assert.ok(await Session.findByPk(session.id));
    assert.equal((await checkLinkStatus({ code: deviceCode.code })).status, "claimed");
});

test("device code authorization removes its session when the claim fails", async () => {
    const deviceCode = await createCode({ clientType: "mobile", ipAddress: "127.0.0.1", userAgent: "test" });
    const originalUpdate = DeviceCode.update;

    DeviceCode.update = async () => { throw new Error("database unavailable"); };
    try {
        await assert.rejects(
            authorizeCode({ code: deviceCode.code, accountId: 1 }),
            /database unavailable/,
        );
    } finally {
        DeviceCode.update = originalUpdate;
    }

    assert.equal(await Session.count(), 0);
});

test("concurrent device code authorization creates a single session", async () => {
    const deviceCode = await createCode({ clientType: "mobile", ipAddress: "127.0.0.1", userAgent: "test" });

    const results = await Promise.all(
        Array.from({ length: 5 }, () => authorizeCode({ code: deviceCode.code, accountId: 1 })),
    );

    assert.equal(results.filter(result => result.message === "Device authorized successfully").length, 1);
    assert.equal(await Session.count(), 1);
});

test("device code authorization is idempotent and leaves no orphan sessions", async () => {
    const deviceCode = await createCode({ clientType: "mobile", ipAddress: "127.0.0.1", userAgent: "test" });

    const first = await authorizeCode({ code: deviceCode.code, accountId: 1 });
    const sessionsAfterFirst = await Session.count();
    const second = await authorizeCode({ code: deviceCode.code, accountId: 1 });

    assert.equal(first.message, "Device authorized successfully");
    assert.deepEqual(second, { code: 400, message: "Device code has already been authorized" });
    assert.equal(await Session.count(), sessionsAfterFirst);
});

test("session cleanup can be stopped and started again", async () => {
    await start({ intervalMs: 60 * 60 * 1000 });
    assert.equal(isRunning(), true);

    await stop();
    assert.equal(isRunning(), false);

    const firstStart = start({ intervalMs: 60 * 60 * 1000 });
    const stopping = stop();
    const secondStart = start({ intervalMs: 60 * 60 * 1000 });
    await Promise.all([firstStart, stopping, secondStart]);

    assert.equal(isRunning(), true);
    await stop();
});
