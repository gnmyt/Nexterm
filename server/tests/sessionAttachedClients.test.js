const { after, test } = require("node:test");
const assert = require("node:assert/strict");

const database = require("../utils/database");
const SessionManager = require("../lib/SessionManager");

after(async () => {
    await database.close();
});

const makeSession = () => SessionManager.create({ accountId: 1, entryId: 1, configuration: {} });

test("a session with no master connection has no attached clients", () => {
    const session = makeSession();
    SessionManager.addWebSocket(session.sessionId, {});
    assert.equal(SessionManager.hasAttachedClients(session.sessionId), false);
});

test("a live session counts attached clients until the last websocket leaves", () => {
    const session = makeSession();
    session.masterConnection = {};
    const ws = {};
    const shared = {};

    assert.equal(SessionManager.hasAttachedClients(session.sessionId), false);
    SessionManager.addWebSocket(session.sessionId, ws);
    SessionManager.addWebSocket(session.sessionId, shared, true);
    assert.equal(SessionManager.hasAttachedClients(session.sessionId), true);

    SessionManager.removeWebSocket(session.sessionId, ws);
    assert.equal(SessionManager.hasAttachedClients(session.sessionId), true);
    SessionManager.removeWebSocket(session.sessionId, shared, true);
    assert.equal(SessionManager.hasAttachedClients(session.sessionId), false);
});

test("an unknown session has no attached clients", () => {
    assert.equal(SessionManager.hasAttachedClients("missing"), false);
});
