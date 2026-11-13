const test = require("node:test");
const assert = require("node:assert/strict");

const { CursorReporter, createQueryFilter } = require("../lib/CursorReporter");

const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const collectReplies = () => {
    const replies = [];
    const reporter = new CursorReporter((reply) => replies.push(reply));
    return { reporter, replies };
};

test("answers a cursor position query with the real cursor position", async () => {
    const { reporter, replies } = collectReplies();
    try {
        reporter.feed("PS C:\\> \r\nPS C:\\> abc\x1b[6n");
        await wait();
        assert.deepEqual(replies, ["\x1b[2;12R"]);
    } finally {
        reporter.dispose();
    }
});

test("answers a query split across chunks", async () => {
    const { reporter, replies } = collectReplies();
    try {
        reporter.feed("ab\x1b[");
        reporter.feed(Buffer.from("6n"));
        await wait();
        assert.deepEqual(replies, ["\x1b[1;3R"]);
    } finally {
        reporter.dispose();
    }
});

test("leaves other terminal queries for the browser to answer", async () => {
    const { reporter, replies } = collectReplies();
    try {
        reporter.feed("\x1b[c\x1b[5n\x1b[?6n");
        await wait();
        assert.deepEqual(replies, []);
    } finally {
        reporter.dispose();
    }
});

test("follows terminal resizes", async () => {
    const { reporter, replies } = collectReplies();
    try {
        reporter.resize(120, 40);
        reporter.feed("\x1b[40;200H\x1b[6n");
        await wait();
        assert.deepEqual(replies, ["\x1b[40;120R"]);
    } finally {
        reporter.dispose();
    }
});

test("removes cursor position queries from forwarded output", () => {
    const sent = [];
    const forward = createQueryFilter((text) => sent.push(text));
    forward("before\x1b[6nafter\x1b[6n");
    assert.deepEqual(sent, ["beforeafter"]);
});

test("removes a query split across chunks and keeps the surrounding output", () => {
    const sent = [];
    const forward = createQueryFilter((text) => sent.push(text));
    forward("prompt\x1b[");
    forward("6nmore");
    assert.equal(sent.join(""), "promptmore");
});

test("sends a held partial sequence that never becomes a query", async () => {
    const sent = [];
    const forward = createQueryFilter((text) => sent.push(text));
    forward("color\x1b[");
    forward("31mred");
    assert.equal(sent.join(""), "color\x1b[31mred");

    forward("trailing\x1b");
    await wait();
    assert.equal(sent.join(""), "color\x1b[31mredtrailing\x1b");
});
