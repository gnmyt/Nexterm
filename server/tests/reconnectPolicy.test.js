const test = require("node:test");
const assert = require("node:assert/strict");

let shouldAttemptAutoReconnect;

test.before(async () => {
    ({ shouldAttemptAutoReconnect } = await import("../../client/src/common/utils/ReconnectPolicy.js"));
});

test("a non-retryable error remains blocked when connectivity returns", () => {
    assert.equal(shouldAttemptAutoReconnect({
        enabled: true,
        session: { type: "terminal", reconnectKey: "session-1" },
        errorInfo: { message: "rdp closed", autoReconnect: false },
        wasConnected: true,
    }), false);
});

test("auto-reconnect requires the preference, a prior connection, and a current error", () => {
    const base = {
        enabled: true,
        session: { type: "terminal", reconnectKey: "session-1" },
        errorInfo: { message: "host unreachable", autoReconnect: true },
        wasConnected: true,
    };

    assert.equal(shouldAttemptAutoReconnect(base), true);
    assert.equal(shouldAttemptAutoReconnect({ ...base, enabled: false }), false);
    assert.equal(shouldAttemptAutoReconnect({ ...base, wasConnected: false }), false);
    assert.equal(shouldAttemptAutoReconnect({ ...base, errorInfo: null }), false);
});

test("joined, script, notes, and SFTP sessions are never automatically retried", () => {
    const base = {
        enabled: true,
        errorInfo: { message: "host unreachable", autoReconnect: true },
        wasConnected: true,
    };

    assert.equal(shouldAttemptAutoReconnect({
        ...base,
        session: { type: "terminal", isJoined: true },
    }), false);
    assert.equal(shouldAttemptAutoReconnect({
        ...base,
        session: { type: "terminal", scriptId: 42 },
    }), false);
    assert.equal(shouldAttemptAutoReconnect({
        ...base,
        session: { type: "notes" },
    }), false);
    assert.equal(shouldAttemptAutoReconnect({
        ...base,
        session: { type: "sftp" },
    }), false);
});
