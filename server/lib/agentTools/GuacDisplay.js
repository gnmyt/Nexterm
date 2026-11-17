const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GuacdClient = require("../GuacdClient");
const SessionManager = require("../SessionManager");
const controlPlane = require("../controlPlane/ControlPlaneServer");
const logger = require("../../utils/logger");
const { sleep } = require("./context");

const COMPOSITE_OPERATIONS = {
    0x1: "destination-in",
    0x2: "destination-out",
    0x4: "source-in",
    0x6: "source-atop",
    0x8: "source-out",
    0x9: "destination-atop",
    0xA: "xor",
    0xB: "destination-over",
    0xC: "source-over",
    0xE: "source-over",
    0xF: "lighter",
};

const LINE_CAPS = ["butt", "round", "square"];
const LINE_JOINS = ["bevel", "miter", "round"];

const TRANSFER_FUNCTIONS = {
    0x0: () => 0,
    0xF: () => 255,
    0x3: (s) => s,
    0x5: (s, d) => d,
    0xC: (s) => 255 & ~s,
    0xA: (s, d) => 255 & ~d,
    0x1: (s, d) => s & d,
    0xE: (s, d) => 255 & ~(s & d),
    0x7: (s, d) => s | d,
    0x8: (s, d) => 255 & ~(s | d),
    0x6: (s, d) => s ^ d,
    0x9: (s, d) => 255 & ~(s ^ d),
    0x2: (s, d) => s & (255 & ~d),
    0x4: (s, d) => (255 & ~s) & d,
    0xB: (s, d) => s | (255 & ~d),
    0xD: (s, d) => (255 & ~s) | d,
};

const SOURCE_ALPHA_TRANSFERS = new Set([0x3, 0xC]);

const MOUSE_BUTTONS = { left: 1, middle: 2, right: 4, up: 8, down: 16 };

class GuacParser {
    constructor(onInstruction) {
        this.onInstruction = onInstruction;
        this.buffer = "";
        this.elements = [];
    }

    feed(data) {
        this.buffer += data;
        let pos = 0;

        for (;;) {
            const dot = this.buffer.indexOf(".", pos);
            if (dot === -1) break;

            const length = Number.parseInt(this.buffer.substring(pos, dot), 10);
            if (Number.isNaN(length)) throw new Error("Invalid instruction length");

            const valueStart = dot + 1;
            const valueEnd = valueStart + length;
            if (this.buffer.length < valueEnd + 1) break;

            const value = this.buffer.substring(valueStart, valueEnd);
            const terminator = this.buffer[valueEnd];
            this.elements.push(value);
            pos = valueEnd + 1;

            if (terminator === ";") {
                const instruction = this.elements;
                this.elements = [];
                this.onInstruction(instruction[0], instruction.slice(1));
            } else if (terminator !== ",") {
                throw new Error(`Invalid instruction terminator: ${JSON.stringify(terminator)}`);
            }
        }

        this.buffer = this.buffer.substring(pos);
    }
}

class Layer {
    constructor(index, width = 0, height = 0, autosize = false) {
        this.index = index;
        this.autosize = autosize;
        this.width = width;
        this.height = height;
        this.canvas = createCanvas(Math.max(1, width), Math.max(1, height));
        this.ctx = this.canvas.getContext("2d");
        this.path = [];
        this.saved = 0;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.parent = index > 0 ? 0 : null;
        this.alpha = 1;
    }

    resize(width, height) {
        if (width === this.width && height === this.height) return;
        const next = createCanvas(Math.max(1, width), Math.max(1, height));
        const ctx = next.getContext("2d");
        if (this.width > 0 && this.height > 0) ctx.drawImage(this.canvas, 0, 0);
        this.canvas = next;
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.saved = 0;
    }

    fitTo(x, y, width, height) {
        if (!this.autosize) return;
        const needWidth = Math.max(this.width, x + width);
        const needHeight = Math.max(this.height, y + height);
        if (needWidth > this.width || needHeight > this.height) this.resize(needWidth, needHeight);
    }

    setComposite(mask) {
        this.ctx.globalCompositeOperation = COMPOSITE_OPERATIONS[mask] || "source-over";
    }

    replayPath() {
        const { ctx } = this;
        ctx.beginPath();
        for (const segment of this.path) {
            switch (segment[0]) {
                case "rect": ctx.rect(segment[1], segment[2], segment[3], segment[4]); break;
                case "start": ctx.moveTo(segment[1], segment[2]); break;
                case "line": ctx.lineTo(segment[1], segment[2]); break;
                case "curve": ctx.bezierCurveTo(segment[1], segment[2], segment[3], segment[4], segment[5], segment[6]); break;
                case "arc": ctx.arc(segment[1], segment[2], segment[3], segment[4], segment[5], segment[6]); break;
                case "close": ctx.closePath(); break;
            }
        }
    }

    pathBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const segment of this.path) {
            const points = segment[0] === "rect"
                ? [[segment[1], segment[2]], [segment[1] + segment[3], segment[2] + segment[4]]]
                : segment[0] === "arc"
                    ? [[segment[1] - segment[3], segment[2] - segment[3]], [segment[1] + segment[3], segment[2] + segment[3]]]
                    : segment.length >= 3 ? [[segment[segment.length - 2], segment[segment.length - 1]]] : [];
            for (const [x, y] of points) {
                minX = Math.min(minX, x); minY = Math.min(minY, y);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            }
        }
        return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
    }
}

class GuacDisplay {
    constructor({ sessionId, width, height, dpi = 96 }) {
        this.sessionId = sessionId;
        this.requestedWidth = width;
        this.requestedHeight = height;
        this.dpi = dpi;
        this.layers = new Map();
        this.streams = new Map();
        this.tasks = [];
        this.pumping = false;
        this.client = null;
        this.closed = false;
        this.error = null;
        this.connectionId = null;
        this.cursor = null;
        this.mouse = { x: 0, y: 0, mask: 0 };
        this.clipboard = null;
        this.remoteName = null;
        this.syncWaiters = new Set();
        this.outboundStream = 0;
        this.resetState();
        this.getLayer(0).resize(width, height);
    }

    resetState() {
        this.stats = { instructions: 0, frames: 0, images: 0, lastInstructionAt: null, lastSyncAt: null };
        this.parser = new GuacParser((opcode, args) => this.handleInstruction(opcode, args));
        this.lastSync = 0;
    }

    async connect(masterClient, { attempts = 3, syncTimeoutMs = 4000 } = {}) {
        if (!controlPlane.hasEngine()) throw new Error("No engine connected");
        if (!masterClient?.connectionId) throw new Error("Remote display is not ready yet");
        this.masterClient = masterClient;

        let lastError = null;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            await this.join(masterClient);
            const synced = await this.waitForSync(syncTimeoutMs).then(() => true, () => false);
            if (synced) {
                const deadline = Date.now() + syncTimeoutMs * 2;
                while (!this.hasFrame && Date.now() < deadline && !this.closed) await sleep(200);
                if (this.hasFrame) return this;
                lastError = "no image data received";
                break;
            }
            lastError = "no frame received";
            if (attempt === attempts) break;
            logger.warn("Agent display received no frame after joining, retrying", { sessionId: this.sessionId, attempt, reason: lastError });
            this.detachClient();
        }

        logger.warn("Agent display attached without an initial frame", { sessionId: this.sessionId, reason: lastError });
        return this;
    }

    async join(masterClient) {
        const joinSocket = await controlPlane.joinSession(this.sessionId);
        const master = masterClient.connectionSettings || {};
        this.resetLayers();

        this.client = new GuacdClient({
            sessionId: this.sessionId,
            joinConnectionId: masterClient.connectionId,
            connectionSettings: {
                ...master,
                connection: { ...(master.connection || {}), width: this.requestedWidth, height: this.requestedHeight, dpi: this.dpi },
                enableAudio: false,
            },
            existingSocket: joinSocket,
            onData: (data) => this.feed(data),
            onClose: (reason) => this.handleClose(reason),
        });
        const client = this.client;
        client.GUAC_IMAGE = ["image/png", "image/jpeg"];
        client.connect();

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.client === client) this.detachClient();
                else closeClient(client);
                reject(new Error("Timed out waiting for the remote display"));
            }, 20000);
            client.onReadyCallback = (connectionId) => {
                this.connectionId = connectionId;
                clearTimeout(timeout);
                resolve();
            };
            client.onCloseCallback = (reason) => {
                clearTimeout(timeout);
                if (this.client === client) this.handleClose(reason);
                reject(new Error(`Display connection failed: ${reason}`));
            };
        });
        this.joinedAt = Date.now();
    }

    detachClient() {
        const client = this.client;
        if (!client) return;
        this.client = null;
        closeClient(client);
    }

    resetLayers() {
        const { width, height } = this.layers.get(0) || { width: this.requestedWidth, height: this.requestedHeight };
        this.layers = new Map();
        this.streams = new Map();
        this.resetState();
        this.cursor = null;
        this.getLayer(0).resize(width, height);
    }

    async rejoin() {
        if (this.closed || !this.masterClient) throw new Error("Display closed");
        this.detachClient();
        await this.connect(this.masterClient, { attempts: 2 });
        return this;
    }

    get hasFrame() {
        return this.stats.images > 0;
    }

    feed(data) {
        if (this.closed) return;
        try {
            this.parser.feed(data);
        } catch (err) {
            logger.warn("GuacDisplay parser error", { sessionId: this.sessionId, error: err.message });
        }
    }

    handleClose(reason) {
        if (this.closed) return;
        this.closed = true;
        this.error = reason;
        for (const waiter of this.syncWaiters) waiter.reject(new Error(`Display closed: ${reason}`));
        this.syncWaiters.clear();
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        try { this.client?.close(); } catch {}
        for (const waiter of this.syncWaiters) waiter.reject(new Error("Display closed"));
        this.syncWaiters.clear();
    }

    get connected() {
        return !this.closed && this.client?.state === "open";
    }

    get width() { return this.getLayer(0).width; }
    get height() { return this.getLayer(0).height; }

    getLayer(index) {
        let layer = this.layers.get(index);
        if (!layer) {
            layer = new Layer(index, 0, 0, index < 0);
            this.layers.set(index, layer);
        }
        return layer;
    }

    enqueue(task) {
        this.tasks.push(task);
        if (!this.pumping) this.pump();
    }

    async pump() {
        this.pumping = true;
        while (this.tasks.length) {
            const task = this.tasks.shift();
            try {
                await task();
            } catch (err) {
                logger.debug("GuacDisplay task failed", { sessionId: this.sessionId, error: err.message });
            }
        }
        this.pumping = false;
    }

    send(parts) {
        if (!this.connected) throw new Error("Remote display is not connected");
        this.client.sendOpCode(parts);
    }

    handleInstruction(opcode, args) {
        this.stats.instructions++;
        this.stats.lastInstructionAt = Date.now();
        if (opcode === "sync") { this.stats.frames++; this.stats.lastSyncAt = Date.now(); }
        if (opcode === "img" || opcode === "png" || opcode === "jpeg" || opcode === "webp") this.stats.images++;
        const handler = INSTRUCTIONS[opcode];
        if (handler) handler(this, args);
    }

    waitForSync(timeoutMs = 2000) {
        if (this.closed) return Promise.reject(new Error("Display closed"));
        return new Promise((resolve, reject) => {
            const waiter = {
                resolve: () => { clearTimeout(timer); this.syncWaiters.delete(waiter); resolve(); },
                reject: (err) => { clearTimeout(timer); this.syncWaiters.delete(waiter); reject(err); },
            };
            const timer = setTimeout(() => waiter.reject(new Error("Timed out waiting for display sync")), timeoutMs);
            this.syncWaiters.add(waiter);
        });
    }

    async settle(delayMs = 250, syncTimeoutMs = 1500) {
        if (delayMs > 0) await sleep(delayMs);
        await this.waitForSync(syncTimeoutMs).catch(() => {});
        await new Promise((resolve) => this.enqueue(async () => resolve()));
    }

    sendMouse(x, y, mask = this.mouse.mask) {
        const px = Math.round(x);
        const py = Math.round(y);
        this.mouse = { x: px, y: py, mask };
        this.send(["mouse", px, py, mask]);
    }

    sendKey(keysym, pressed) {
        this.send(["key", keysym, pressed ? 1 : 0]);
    }

    sendSize(width, height) {
        this.requestedWidth = width;
        this.requestedHeight = height;
        this.send(["size", width, height, this.dpi]);
    }

    sendClipboard(text) {
        const index = this.outboundStream++;
        this.send(["clipboard", index, "text/plain"]);
        const encoded = Buffer.from(text, "utf8").toString("base64");
        for (let offset = 0; offset < encoded.length; offset += 6144) {
            this.send(["blob", index, encoded.substring(offset, offset + 6144)]);
        }
        this.send(["end", index]);
    }

    absolutePosition(layer) {
        let x = layer.x;
        let y = layer.y;
        let parentIndex = layer.parent;
        let guard = 0;
        while (parentIndex !== null && parentIndex !== 0 && guard++ < 32) {
            const parent = this.layers.get(parentIndex);
            if (!parent) break;
            x += parent.x;
            y += parent.y;
            parentIndex = parent.parent;
        }
        return { x, y };
    }

    compose({ includeCursor = true } = {}) {
        const root = this.getLayer(0);
        const canvas = createCanvas(Math.max(1, root.width), Math.max(1, root.height));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(root.canvas, 0, 0);

        const visible = [...this.layers.values()].filter((layer) => layer.index > 0 && layer.width > 0 && layer.height > 0);
        visible.sort((a, b) => a.z - b.z || a.index - b.index);
        for (const layer of visible) {
            const { x, y } = this.absolutePosition(layer);
            ctx.globalAlpha = layer.alpha;
            ctx.drawImage(layer.canvas, x, y);
        }
        ctx.globalAlpha = 1;

        if (includeCursor && this.cursor) {
            ctx.drawImage(this.cursor.canvas, this.mouse.x - this.cursor.hotspotX, this.mouse.y - this.cursor.hotspotY);
        }
        return canvas;
    }

    screenshot({ format = "jpeg", quality = 85, maxWidth = null, includeCursor = true } = {}) {
        return new Promise((resolve, reject) => {
            this.enqueue(async () => {
                try {
                    let canvas = this.compose({ includeCursor });
                    let scale = 1;
                    if (maxWidth && canvas.width > maxWidth) {
                        scale = maxWidth / canvas.width;
                        const scaled = createCanvas(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
                        const ctx = scaled.getContext("2d");
                        ctx.imageSmoothingEnabled = true;
                        ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
                        canvas = scaled;
                    }
                    const buffer = format === "png"
                        ? await canvas.encode("png")
                        : await canvas.encode("jpeg", quality);
                    resolve({
                        buffer,
                        mimeType: format === "png" ? "image/png" : "image/jpeg",
                        width: canvas.width,
                        height: canvas.height,
                        displayWidth: this.width,
                        displayHeight: this.height,
                        hasFrame: this.hasFrame,
                        scale,
                    });
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    drawImage(layerIndex, mask, x, y, image) {
        const layer = this.getLayer(layerIndex);
        layer.fitTo(x, y, image.width, image.height);
        layer.setComposite(mask);
        layer.ctx.drawImage(image, x, y);
    }

    copy(srcIndex, sx, sy, w, h, mask, dstIndex, dx, dy) {
        const src = this.getLayer(srcIndex);
        const dst = this.getLayer(dstIndex);
        if (w <= 0 || h <= 0) return;
        dst.fitTo(dx, dy, w, h);
        dst.setComposite(mask);
        if (src === dst) {
            const temp = createCanvas(w, h);
            temp.getContext("2d").drawImage(src.canvas, sx, sy, w, h, 0, 0, w, h);
            dst.ctx.drawImage(temp, 0, 0, w, h, dx, dy, w, h);
        } else {
            dst.ctx.drawImage(src.canvas, sx, sy, w, h, dx, dy, w, h);
        }
    }

    transfer(srcIndex, sx, sy, w, h, fn, dstIndex, dx, dy) {
        if (fn === 0x3) return this.copy(srcIndex, sx, sy, w, h, 0xC, dstIndex, dx, dy);
        if (fn === 0x5) return;
        const transform = TRANSFER_FUNCTIONS[fn];
        if (!transform || w <= 0 || h <= 0) return;
        const src = this.getLayer(srcIndex);
        const dst = this.getLayer(dstIndex);
        dst.fitTo(dx, dy, w, h);
        const dstData = dst.ctx.getImageData(dx, dy, w, h);
        const s = src.ctx.getImageData(sx, sy, w, h).data;
        const d = dstData.data;
        const sourceAlpha = SOURCE_ALPHA_TRANSFERS.has(fn);
        for (let i = 0; i < d.length; i += 4) {
            d[i] = transform(s[i], d[i]);
            d[i + 1] = transform(s[i + 1], d[i + 1]);
            d[i + 2] = transform(s[i + 2], d[i + 2]);
            if (sourceAlpha) d[i + 3] = s[i + 3];
        }
        dst.ctx.putImageData(dstData, dx, dy);
    }

    fill(mask, layerIndex, style) {
        const layer = this.getLayer(layerIndex);
        const bounds = layer.pathBounds();
        if (bounds) layer.fitTo(bounds.x, bounds.y, bounds.width, bounds.height);
        layer.setComposite(mask);
        layer.replayPath();
        layer.ctx.fillStyle = style;
        layer.ctx.fill();
        layer.path = [];
    }

    stroke(mask, layerIndex, cap, join, thickness, style) {
        const layer = this.getLayer(layerIndex);
        layer.setComposite(mask);
        layer.replayPath();
        layer.ctx.lineCap = LINE_CAPS[cap] || "butt";
        layer.ctx.lineJoin = LINE_JOINS[join] || "miter";
        layer.ctx.lineWidth = thickness;
        layer.ctx.strokeStyle = style;
        layer.ctx.stroke();
        layer.path = [];
    }
}

const int = (value) => Number.parseInt(value, 10);
const rgba = (r, g, b, a) => `rgba(${int(r)},${int(g)},${int(b)},${int(a) / 255})`;

const closeClient = (client) => {
    client.onReadyCallback = null;
    client.onCloseCallback = null;
    try { client.close(); } catch {}
};

const decodeImage = async (display, stream) => {
    const data = Buffer.from(stream.chunks.join(""), "base64");
    if (!data.length) return;
    const image = await loadImage(data);
    display.drawImage(stream.layer, stream.mask, stream.x, stream.y, image);
};

const inlineImage = (d, [mask, layer, x, y, data]) =>
    d.enqueue(() => decodeImage(d, { chunks: [data], mask: int(mask), layer: int(layer), x: int(x), y: int(y) }));

const rejectStream = (d, stream) => {
    try { d.client?.sendOpCode(["ack", stream, "Unsupported", 0x0100]); } catch {}
};

const INSTRUCTIONS = {
    size: (d, [layer, width, height]) => d.enqueue(() => d.getLayer(int(layer)).resize(int(width), int(height))),

    img: (d, [stream, mask, layer, mimetype, x, y]) => {
        d.streams.set(int(stream), { type: "img", chunks: [], mask: int(mask), layer: int(layer), mimetype, x: int(x), y: int(y) });
    },

    blob: (d, [stream, data]) => {
        const entry = d.streams.get(int(stream));
        if (entry) entry.chunks.push(data);
    },

    end: (d, [stream]) => {
        const index = int(stream);
        const entry = d.streams.get(index);
        if (!entry) return;
        d.streams.delete(index);
        if (entry.type === "img") d.enqueue(() => decodeImage(d, entry));
        else if (entry.type === "clipboard") {
            const buffer = Buffer.from(entry.chunks.join(""), "base64");
            d.clipboard = { mimetype: entry.mimetype, text: buffer.toString("utf8"), receivedAt: Date.now() };
        }
    },

    png: inlineImage,
    jpeg: inlineImage,
    webp: inlineImage,

    copy: (d, [srcL, sx, sy, w, h, mask, dstL, dx, dy]) => d.enqueue(() =>
        d.copy(int(srcL), int(sx), int(sy), int(w), int(h), int(mask), int(dstL), int(dx), int(dy))),

    transfer: (d, [srcL, sx, sy, w, h, fn, dstL, dx, dy]) => d.enqueue(() =>
        d.transfer(int(srcL), int(sx), int(sy), int(w), int(h), int(fn), int(dstL), int(dx), int(dy))),

    rect: (d, [layer, x, y, w, h]) => d.enqueue(() => d.getLayer(int(layer)).path.push(["rect", int(x), int(y), int(w), int(h)])),
    start: (d, [layer, x, y]) => d.enqueue(() => d.getLayer(int(layer)).path.push(["start", int(x), int(y)])),
    line: (d, [layer, x, y]) => d.enqueue(() => d.getLayer(int(layer)).path.push(["line", int(x), int(y)])),
    curve: (d, [layer, cp1x, cp1y, cp2x, cp2y, x, y]) => d.enqueue(() =>
        d.getLayer(int(layer)).path.push(["curve", int(cp1x), int(cp1y), int(cp2x), int(cp2y), int(x), int(y)])),
    arc: (d, [layer, x, y, radius, startAngle, endAngle, negative]) => d.enqueue(() =>
        d.getLayer(int(layer)).path.push(["arc", int(x), int(y), int(radius), Number.parseFloat(startAngle), Number.parseFloat(endAngle), negative !== "0"])),
    close: (d, [layer]) => d.enqueue(() => d.getLayer(int(layer)).path.push(["close"])),

    cfill: (d, [mask, layer, r, g, b, a]) => d.enqueue(() => d.fill(int(mask), int(layer), rgba(r, g, b, a))),
    cstroke: (d, [mask, layer, cap, join, thickness, r, g, b, a]) => d.enqueue(() =>
        d.stroke(int(mask), int(layer), int(cap), int(join), int(thickness), rgba(r, g, b, a))),
    lfill: (d, [mask, layer, srcLayer]) => d.enqueue(() => {
        const target = d.getLayer(int(layer));
        const pattern = target.ctx.createPattern(d.getLayer(int(srcLayer)).canvas, "repeat");
        d.fill(int(mask), int(layer), pattern);
    }),
    lstroke: (d, [mask, layer, cap, join, thickness, srcLayer]) => d.enqueue(() => {
        const target = d.getLayer(int(layer));
        const pattern = target.ctx.createPattern(d.getLayer(int(srcLayer)).canvas, "repeat");
        d.stroke(int(mask), int(layer), int(cap), int(join), int(thickness), pattern);
    }),

    clip: (d, [layer]) => d.enqueue(() => {
        const target = d.getLayer(int(layer));
        target.ctx.save();
        target.saved++;
        target.replayPath();
        target.ctx.clip();
        target.path = [];
    }),
    reset: (d, [layer]) => d.enqueue(() => {
        const target = d.getLayer(int(layer));
        while (target.saved > 0) { target.ctx.restore(); target.saved--; }
        target.ctx.setTransform(1, 0, 0, 1, 0, 0);
        target.path = [];
    }),
    push: (d, [layer]) => d.enqueue(() => { const t = d.getLayer(int(layer)); t.ctx.save(); t.saved++; }),
    pop: (d, [layer]) => d.enqueue(() => { const t = d.getLayer(int(layer)); if (t.saved > 0) { t.ctx.restore(); t.saved--; } }),
    identity: (d, [layer]) => d.enqueue(() => d.getLayer(int(layer)).ctx.setTransform(1, 0, 0, 1, 0, 0)),
    transform: (d, [layer, a, b, c, dd, e, f]) => d.enqueue(() =>
        d.getLayer(int(layer)).ctx.transform(+a, +b, +c, +dd, +e, +f)),
    distort: (d, [layer, a, b, c, dd, e, f]) => d.enqueue(() =>
        d.getLayer(int(layer)).ctx.setTransform(+a, +b, +c, +dd, +e, +f)),

    dispose: (d, [layer]) => d.enqueue(() => { if (int(layer) !== 0) d.layers.delete(int(layer)); }),
    move: (d, [layer, parent, x, y, z]) => d.enqueue(() => {
        const index = int(layer);
        if (index <= 0) return;
        const target = d.getLayer(index);
        target.parent = int(parent);
        target.x = int(x); target.y = int(y); target.z = int(z);
    }),
    shade: (d, [layer, alpha]) => d.enqueue(() => { if (int(layer) >= 0) d.getLayer(int(layer)).alpha = int(alpha) / 255; }),

    cursor: (d, [hx, hy, srcL, sx, sy, w, h]) => d.enqueue(() => {
        const width = int(w), height = int(h);
        if (width <= 0 || height <= 0) { d.cursor = null; return; }
        const canvas = createCanvas(width, height);
        canvas.getContext("2d").drawImage(d.getLayer(int(srcL)).canvas, int(sx), int(sy), width, height, 0, 0, width, height);
        d.cursor = { canvas, hotspotX: int(hx), hotspotY: int(hy), width, height };
    }),

    clipboard: (d, [stream, mimetype]) => {
        d.streams.set(int(stream), { type: "clipboard", chunks: [], mimetype });
    },

    sync: (d, [timestamp]) => {
        const ts = int(timestamp);
        d.enqueue(() => {
            if (ts !== d.lastSync) {
                d.lastSync = ts;
                try { d.client?.sendOpCode(["sync", ts]); } catch {}
            }
            for (const waiter of [...d.syncWaiters]) waiter.resolve();
        });
    },

    name: (d, [name]) => { d.remoteName = name; },
    error: (d, [message, status]) => { d.error = `${message} (${status})`; },

    audio: (d, [stream]) => rejectStream(d, stream),
    file: (d, [stream]) => rejectStream(d, stream),
    pipe: (d, [stream]) => rejectStream(d, stream),
    video: (d, [stream]) => rejectStream(d, stream),
    argv: () => {},
    nop: () => {},
    required: () => {},
    msg: () => {},
    set: () => {},
    filesystem: () => {},
    body: (d, [, stream]) => rejectStream(d, stream),
};

const resolveDisplaySize = (session, masterClient) => {
    const config = session.configuration || {};
    const master = masterClient?.connectionSettings?.connection || {};
    if (session.displaySize?.width && session.displaySize?.height) return session.displaySize;
    const width = Number.parseInt(config.displayWidth, 10) || master.width || 1024;
    const height = Number.parseInt(config.displayHeight, 10) || master.height || 768;
    return { width, height };
};

const getGuacDisplay = async (sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error("Session not found");
    const conn = SessionManager.getConnection(sessionId);
    if (!conn?.guacdClient) throw new Error("Session has no remote display");
    if (conn._agentDisplayConnecting) return conn._agentDisplayConnecting;
    if (conn.agentDisplay && conn.agentDisplay.connected) {
        const display = conn.agentDisplay;
        if (display.hasFrame || Date.now() - (display.joinedAt || 0) < 2000) return display;
        conn._agentDisplayConnecting = display.rejoin().finally(() => { conn._agentDisplayConnecting = null; });
        return conn._agentDisplayConnecting;
    }

    conn._agentDisplayConnecting = (async () => {
        if (!session.guacReady) await SessionManager.waitForGuacReady(sessionId);
        const masterClient = conn.guacdClient;
        if (masterClient.state === "closed") throw new Error("Remote display connection is closed");
        const { width, height } = resolveDisplaySize(session, masterClient);
        const display = new GuacDisplay({
            sessionId,
            width,
            height,
            dpi: Number.parseInt(session.configuration?.displayDpi, 10) || 96,
        });
        await display.connect(masterClient);
        conn.agentDisplay = display;
        logger.info("Agent display attached", { sessionId, width: display.width, height: display.height });
        return display;
    })().finally(() => { conn._agentDisplayConnecting = null; });

    return conn._agentDisplayConnecting;
};

module.exports = { GuacDisplay, MOUSE_BUTTONS, getGuacDisplay };
