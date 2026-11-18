const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Parameter construction should not need a database or Proxmox connection.
const moduleStub = { exports: {} };
const unexpected = () => { throw new Error("Unexpected credential/integration lookup"); };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../lib/guacParamBuilders.js"), "utf8"), {
    module: moduleStub,
    require(name) {
        if (name.endsWith("/Integration")) return { findByPk: unexpected };
        if (name.endsWith("/identity")) return { getIdentityCredentials: unexpected };
        if (name.endsWith("/integration")) return { getIntegrationCredentials: unexpected };
        if (name.endsWith("/pve")) return {};
        throw new Error(`Unexpected dependency: ${name}`);
    },
});
const { buildVncParams, buildRdpParams } = moduleStub.exports;

test("VNC leaves the legacy clipboard default unchanged", async () => {
    for (const clipboardEncoding of [undefined, null, "", "UTF8", "MacRoman", "invalid", {}, []]) {
        const params = await buildVncParams({ ip: "localhost", clipboardEncoding });
        assert.equal(Object.hasOwn(params, "clipboard-encoding"), false);
        assert.equal(params.hostname, "localhost");
        assert.equal(params.port, "5900");
    }
});

test("VNC forwards only supported explicitly selected clipboard encodings", async () => {
    for (const clipboardEncoding of ["ISO8859-1", "UTF-8", "UTF-16", "CP1252"]) {
        const params = await buildVncParams({ ip: "localhost", clipboardEncoding });
        assert.equal(params["clipboard-encoding"], clipboardEncoding);
    }
});

test("UTF-8 does not alter VNC credentials, color depth, port or resize method", async () => {
    const params = await buildVncParams({
        ip: "localhost", port: 5902, clipboardEncoding: "UTF-8",
        colorDepth: "32", resizeMethod: "display-update",
    }, { isDirect: true, username: "test", directCredentials: { password: "test-only" } });
    assert.equal(params["clipboard-encoding"], "UTF-8");
    assert.equal(params["resize-method"], "display-update");
    assert.equal(params["color-depth"], "32");
    assert.equal(params.port, "5902");
    assert.equal(params.username, "test");
    assert.equal(params.password, "test-only");
});

test("VNC encoding does not leak into RDP arguments", async () => {
    const params = await buildRdpParams({ ip: "localhost", clipboardEncoding: "UTF-8" });
    assert.equal(Object.hasOwn(params, "clipboard-encoding"), false);
});
