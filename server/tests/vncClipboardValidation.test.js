const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    configValidation, createServerValidation, updateServerValidation,
} = require("../validations/server");

test("VNC clipboard validation preserves omitted/default encodings", () => {
    for (const config of [{ protocol: "vnc" }, { protocol: "vnc", clipboardEncoding: "" }]) {
        const result = configValidation.validate(config);
        assert.equal(result.error, undefined);
        assert.deepEqual(result.value, config);
    }
});

test("VNC clipboard validation accepts supported encodings on create and update", () => {
    for (const clipboardEncoding of ["ISO8859-1", "UTF-8", "UTF-16", "CP1252"]) {
        const config = { protocol: "vnc", clipboardEncoding };
        for (const schema of [createServerValidation, updateServerValidation]) {
            const result = schema.validate({ name: "test", config });
            assert.equal(result.error, undefined);
            assert.equal(result.value.config.clipboardEncoding, clipboardEncoding);
        }
    }
});

test("VNC clipboard validation rejects malformed or unsupported encodings", () => {
    for (const clipboardEncoding of ["UTF8", "MacRoman", "invalid", null, 17, {}, []]) {
        for (const schema of [createServerValidation, updateServerValidation]) {
            const result = schema.validate({ name: "test", config: { protocol: "vnc", clipboardEncoding } });
            assert(result.error);
            assert.deepEqual(result.error.details[0].path, ["config", "clipboardEncoding"]);
        }
    }
});
