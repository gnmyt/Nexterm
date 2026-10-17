const test = require("node:test");
const assert = require("node:assert/strict");

const { parseCPUUsage } = require("../utils/cpuUsage");

// Two aggregate /proc/stat lines, one second apart, as produced by the monitoring command.
const sample = (first, second) => `${first}\n${second}`;

test("cpu usage is calculated from the difference between two samples", () => {
    // /proc/stat separates the aggregate line from its first value with two spaces.
    const output = sample(
        "cpu  100 0 100 800 0 0 0 0 0 0",
        "cpu  150 0 150 900 0 0 0 0 0 0",
    );

    assert.equal(parseCPUUsage(output), 50);
});

test("a host that was idle since boot reports its current load, not the boot average", () => {
    // Almost all jiffies since boot are idle, but during the sampled second
    // the CPU was fully busy. The result must reflect the sampled second.
    const output = sample(
        "cpu 1000 0 1000 9998000 0 0 0 0 0 0",
        "cpu 1098 0 1002 9998000 0 0 0 0 0 0",
    );

    assert.equal(parseCPUUsage(output), 100);
});

test("per-core lines and blank lines are ignored", () => {
    const output = [
        "cpu 100 0 100 800 0 0 0 0 0 0",
        "cpu0 50 0 50 400 0 0 0 0 0 0",
        "",
        "cpu 150 0 150 900 0 0 0 0 0 0",
        "cpu0 75 0 75 450 0 0 0 0 0 0",
    ].join("\n");

    assert.equal(parseCPUUsage(output), 50);
});

test("a single sample cannot be turned into a percentage", () => {
    assert.equal(parseCPUUsage("cpu 1000 0 1000 9998000 0 0 0 0 0 0"), null);
});

test("identical samples and unparsable output return null", () => {
    assert.equal(parseCPUUsage(sample("cpu 1 2 3 4 5 6 7 8 9 10", "cpu 1 2 3 4 5 6 7 8 9 10")), null);
    assert.equal(parseCPUUsage(""), null);
    assert.equal(parseCPUUsage(undefined), null);
    assert.equal(parseCPUUsage("grep: /proc/stat: No such file or directory"), null);
});
