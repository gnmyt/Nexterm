const test = require("node:test");
const assert = require("node:assert/strict");

let markExplicitLogout;
let consumeExplicitLogout;
let createAutoLoginSuppressionGuard;
let values;

test.before(async () => {
    values = new Map();
    global.window = {
        sessionStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key),
        },
    };

    ({ markExplicitLogout, consumeExplicitLogout, createAutoLoginSuppressionGuard } = await import(
        "../../client/src/common/utils/OIDCLogoutUtil.js"
    ));
});

test.after(() => {
    delete global.window;
});

test("the explicit-logout marker suppresses automatic OIDC login exactly once", () => {
    markExplicitLogout();

    assert.equal(consumeExplicitLogout(), true);
    assert.equal(consumeExplicitLogout(), false);
});

test("no marker leaves automatic OIDC login enabled", () => {
    assert.equal(consumeExplicitLogout(), false);
});

test("duplicate open effects share the same explicit-logout decision", () => {
    let consumeCalls = 0;
    const shouldSkipAutoLogin = createAutoLoginSuppressionGuard(() => {
        consumeCalls += 1;
        return true;
    });

    assert.equal(shouldSkipAutoLogin(true), true);
    assert.equal(shouldSkipAutoLogin(true), true);
    assert.equal(consumeCalls, 1);

    assert.equal(shouldSkipAutoLogin(false), false);
    assert.equal(shouldSkipAutoLogin(true), true);
    assert.equal(consumeCalls, 2);
});
