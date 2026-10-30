const test = require("node:test");
const assert = require("node:assert/strict");

const translations = {
    "common.errors.connection.rdpSessionConflict": "rdp conflict",
    "common.errors.connection.rdpSessionTimeout": "rdp timeout",
    "common.errors.connection.rdpSessionClosed": "rdp closed",
    "common.errors.connection.hostUnreachable": "host unreachable",
    "common.errors.connection.failed": "failed",
};
const t = (key) => translations[key] || key;

let classifyConnectionError;

test.before(async () => {
    ({ classifyConnectionError } = await import("../../client/src/common/utils/ConnectionErrorUtil.js"));
});

test("RDP session conflicts retain the useful protocol meaning and do not auto-reconnect", () => {
    assert.deepEqual(classifyConnectionError({
        rawMessage: "Aborted. See logs.",
        statusCode: 0x0209,
        protocol: "rdp",
        t,
    }), {
        message: "rdp conflict",
        autoReconnect: false,
    });
});

test("RDP server timeouts and forced closures do not auto-reconnect", () => {
    assert.equal(classifyConnectionError({
        rawMessage: "Idle session time limit exceeded.",
        statusCode: 0x020A,
        protocol: "rdp",
        t,
    }).autoReconnect, false);

    assert.deepEqual(classifyConnectionError({
        rawMessage: "Forcibly disconnected.",
        statusCode: 0x020B,
        protocol: "rdp",
        t,
    }), {
        message: "rdp closed",
        autoReconnect: false,
    });
});

test("RDP server-disconnect text is non-retryable when a status code is unavailable", () => {
    assert.deepEqual(classifyConnectionError({
        rawMessage: "Disconnected by other connection.",
        protocol: "RDP",
        t,
    }), {
        message: "rdp conflict",
        autoReconnect: false,
    });
});

test("transport failures and non-RDP session statuses remain eligible for auto-reconnect", () => {
    assert.deepEqual(classifyConnectionError({
        rawMessage: "No route to host",
        statusCode: 0x0207,
        protocol: "rdp",
        t,
    }), {
        message: "host unreachable",
        autoReconnect: true,
    });

    assert.equal(classifyConnectionError({
        rawMessage: "Disconnected by other connection.",
        statusCode: 0x0209,
        protocol: "ssh",
        t,
    }).autoReconnect, true);
});
