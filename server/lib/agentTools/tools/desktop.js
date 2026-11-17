const { z } = require("zod");
const { ToolError, sleep } = require("../context");
const { getGuacDisplay, MOUSE_BUTTONS } = require("../GuacDisplay");
const { charToKeysym, parseKeyCombo } = require("../keysyms");
const { AUDIT_ACTIONS } = require("../../../controllers/audit");

const resolveDisplay = async (ctx, sessionId) => {
    const { session, entry, protocol, kind } = await ctx.resolveSession(sessionId);
    if (kind !== "desktop") throw new ToolError(`Session ${sessionId} is not a desktop session (protocol: ${protocol})`, "wrong_session_kind");
    await ctx.waitForConnection(sessionId);
    const display = await getGuacDisplay(sessionId);
    if (!display.connected) throw new ToolError(`Remote display is not connected${display.error ? `: ${display.error}` : ""}`);
    const audit = (details) => ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_DESKTOP_INPUT, { sessionId, ...details });
    return { session, entry, display, audit };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const clampPoint = (display, x, y) => ({
    x: clamp(x, 0, Math.max(0, display.width - 1)),
    y: clamp(y, 0, Math.max(0, display.height - 1)),
});

const buttonMask = (button) => {
    const mask = MOUSE_BUTTONS[button];
    if (!mask) throw new ToolError(`Unknown mouse button: ${button}`);
    return mask;
};

const pressCombo = async (display, combo, holdMs = 40) => {
    const { modifiers, keys } = parseKeyCombo(combo);
    for (const modifier of modifiers) display.sendKey(modifier, true);
    for (const key of keys) {
        display.sendKey(key, true);
        await sleep(holdMs);
        display.sendKey(key, false);
    }
    for (const modifier of [...modifiers].reverse()) display.sendKey(modifier, false);
};

const screenshotResult = (shot, extra = {}) => ({
    content: [
        { type: "image", data: shot.buffer.toString("base64"), mimeType: shot.mimeType },
        {
            type: "text",
            text: JSON.stringify({
                displayWidth: shot.displayWidth,
                displayHeight: shot.displayHeight,
                imageWidth: shot.width,
                imageHeight: shot.height,
                scale: Number(shot.scale.toFixed(4)),
                ...(shot.hasFrame === false && { warning: "No frame has been received from the remote display yet; the image is blank. Wait and take another screenshot." }),
                note: shot.scale === 1
                    ? "Image pixels equal display pixels; use them directly as x/y for desktop_click."
                    : "The image is downscaled; divide image coordinates by 'scale' to get display coordinates for desktop_click.",
                ...extra,
            }),
        },
    ],
});

module.exports = (define, ctx) => {
    define("desktop_screenshot", {
        title: "Take a screenshot",
        description: "Captures the current screen of an RDP / VNC / Proxmox VM / remote browser session and returns it as an image together with the display size. "
            + "Call it after every interaction to see the result. Use maxWidth to reduce the image size; the returned scale maps image pixels to display pixels.",
        inputSchema: {
            sessionId: z.uuid(),
            format: z.enum(["jpeg", "png"]).optional().describe("Image format (default jpeg)."),
            quality: z.number().int().min(10).max(100).optional().describe("JPEG quality (default 80)."),
            maxWidth: z.number().int().min(160).max(3840).optional().describe("Downscale the image to at most this width."),
            waitMs: z.number().int().min(0).max(10000).optional().describe("Wait this long for the screen to settle before capturing (default 300)."),
            includeCursor: z.boolean().optional().describe("Draw the mouse pointer (default true)."),
        },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, format = "jpeg", quality = 80, maxWidth, waitMs = 300, includeCursor = true }) => {
        const { display, entry } = await resolveDisplay(ctx, sessionId);
        await display.settle(waitMs);
        const shot = await display.screenshot({ format, quality, maxWidth: maxWidth || null, includeCursor });
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_SCREENSHOT, { sessionId });
        return screenshotResult(shot, { mouse: { x: display.mouse.x, y: display.mouse.y }, remoteName: display.remoteName || undefined });
    });

    define("desktop_info", {
        title: "Get desktop session info",
        description: "Returns the display size, current mouse position and the last clipboard content received from the remote desktop.",
        inputSchema: { sessionId: z.uuid() },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId }) => {
        const { display } = await resolveDisplay(ctx, sessionId);
        return {
            width: display.width, height: display.height, mouse: display.mouse, remoteName: display.remoteName,
            clipboard: display.clipboard, cursorVisible: Boolean(display.cursor),
            stats: display.stats, connectionError: display.error || null,
        };
    });

    define("desktop_click", {
        confirm: true,
        title: "Click on the desktop",
        description: "Moves the mouse to (x, y) in display pixels and clicks. Supports left/middle/right buttons, double clicks and held modifier keys.",
        inputSchema: {
            sessionId: z.uuid(),
            x: z.number().int().min(0),
            y: z.number().int().min(0),
            button: z.enum(["left", "middle", "right"]).optional().describe("Default left."),
            clicks: z.number().int().min(1).max(3).optional().describe("1 = single click, 2 = double click (default 1)."),
            modifiers: z.array(z.string()).optional().describe("Modifier keys to hold while clicking, e.g. ['ctrl'] or ['shift']."),
            screenshot: z.boolean().optional().describe("Return a screenshot after the click (default false)."),
        },
    }, async ({ sessionId, x, y, button = "left", clicks = 1, modifiers = [], screenshot = false }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        const { x: px, y: py } = clampPoint(display, x, y);
        const mask = buttonMask(button);
        const modifierKeys = modifiers.map((m) => parseKeyCombo(m).modifiers).flat();

        for (const key of modifierKeys) display.sendKey(key, true);
        display.sendMouse(px, py, 0);
        await sleep(30);
        for (let i = 0; i < clicks; i++) {
            display.sendMouse(px, py, mask);
            await sleep(50);
            display.sendMouse(px, py, 0);
            if (i < clicks - 1) await sleep(80);
        }
        for (const key of [...modifierKeys].reverse()) display.sendKey(key, false);

        audit({ action: "click", x: px, y: py, button, clicks, modifiers });
        if (!screenshot) return { clicked: true, x: px, y: py, button, clicks };
        await display.settle(400);
        return screenshotResult(await display.screenshot({}), { clicked: { x: px, y: py, button, clicks } });
    });

    define("desktop_mouse_move", {
        title: "Move the mouse",
        description: "Moves the mouse pointer to (x, y) without clicking (hover).",
        inputSchema: { sessionId: z.uuid(), x: z.number().int().min(0), y: z.number().int().min(0) },
    }, async ({ sessionId, x, y }) => {
        const { display } = await resolveDisplay(ctx, sessionId);
        const point = clampPoint(display, x, y);
        display.sendMouse(point.x, point.y, 0);
        return point;
    });

    define("desktop_drag", {
        confirm: true,
        title: "Drag with the mouse",
        description: "Presses a mouse button at the start point, moves to the end point in steps and releases the button.",
        inputSchema: {
            sessionId: z.uuid(),
            fromX: z.number().int().min(0), fromY: z.number().int().min(0),
            toX: z.number().int().min(0), toY: z.number().int().min(0),
            button: z.enum(["left", "middle", "right"]).optional(),
            steps: z.number().int().min(1).max(100).optional().describe("Intermediate mouse moves (default 10)."),
        },
    }, async ({ sessionId, fromX, fromY, toX, toY, button = "left", steps = 10 }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        const mask = buttonMask(button);
        const from = clampPoint(display, fromX, fromY);
        const to = clampPoint(display, toX, toY);
        display.sendMouse(from.x, from.y, 0);
        await sleep(40);
        display.sendMouse(from.x, from.y, mask);
        await sleep(60);
        for (let i = 1; i <= steps; i++) {
            display.sendMouse(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, mask);
            await sleep(20);
        }
        await sleep(60);
        display.sendMouse(to.x, to.y, 0);
        audit({ action: "drag", fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, button });
        return { dragged: true };
    });

    define("desktop_scroll", {
        confirm: true,
        title: "Scroll",
        description: "Scrolls the mouse wheel at (x, y). Positive amount scrolls down, negative scrolls up.",
        inputSchema: {
            sessionId: z.uuid(),
            x: z.number().int().min(0), y: z.number().int().min(0),
            amount: z.number().int().min(-50).max(50).describe("Number of wheel notches; positive = down, negative = up."),
        },
    }, async ({ sessionId, x, y, amount }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        const point = clampPoint(display, x, y);
        const mask = amount > 0 ? MOUSE_BUTTONS.down : MOUSE_BUTTONS.up;
        display.sendMouse(point.x, point.y, 0);
        for (let i = 0; i < Math.abs(amount); i++) {
            display.sendMouse(point.x, point.y, mask);
            await sleep(15);
            display.sendMouse(point.x, point.y, 0);
            await sleep(25);
        }
        audit({ action: "scroll", x: point.x, y: point.y, amount });
        return { scrolled: amount };
    });

    define("desktop_type", {
        confirm: true,
        title: "Type text",
        description: "Types a string on the remote desktop keyboard. Newlines are sent as Enter, tabs as Tab. Click into the target field first.",
        inputSchema: {
            sessionId: z.uuid(),
            text: z.string().min(1).max(10000),
            delayMs: z.number().int().min(0).max(500).optional().describe("Delay between keystrokes (default 12)."),
            pressEnter: z.boolean().optional().describe("Press Enter after the text."),
            sensitive: z.boolean().optional().describe("Set when typing a password or secret (only the length is written to the audit log either way; this flags the entry)."),
        },
    }, async ({ sessionId, text, delayMs = 12, pressEnter = false, sensitive = false }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        for (const char of text) {
            const keysym = charToKeysym(char);
            display.sendKey(keysym, true);
            await sleep(Math.max(5, delayMs / 2));
            display.sendKey(keysym, false);
            if (delayMs) await sleep(delayMs / 2);
        }
        if (pressEnter) await pressCombo(display, "enter");
        audit({ action: "type", length: text.length, pressEnter, sensitive });
        return { typed: text.length, pressEnter };
    });

    define("desktop_key", {
        confirm: true,
        title: "Press keys",
        description: "Presses one or more key combinations, e.g. 'enter', 'ctrl+c', 'alt+F4', 'ctrl+alt+delete', 'super', 'tab', 'escape', 'F5', arrow keys ('up', 'down'), or single characters. Combinations are pressed in order.",
        inputSchema: {
            sessionId: z.uuid(),
            keys: z.union([z.string(), z.array(z.string())]).describe("A key combination or a list of combinations."),
            repeat: z.number().int().min(1).max(50).optional().describe("Repeat the whole sequence this many times."),
            delayMs: z.number().int().min(0).max(2000).optional().describe("Delay between combinations (default 60)."),
        },
    }, async ({ sessionId, keys, repeat = 1, delayMs = 60 }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        const combos = Array.isArray(keys) ? keys : [keys];
        for (let r = 0; r < repeat; r++) {
            for (const combo of combos) {
                await pressCombo(display, combo);
                if (delayMs) await sleep(delayMs);
            }
        }
        audit({ action: "keys", keys: combos, repeat });
        return { pressed: combos, repeat };
    });

    define("desktop_resize", {
        confirm: true,
        title: "Resize the remote display",
        description: "Asks the remote desktop to change its resolution (RDP display update / VNC desktop resize). Not every server supports it; check with a screenshot afterwards.",
        inputSchema: {
            sessionId: z.uuid(),
            width: z.number().int().min(640).max(3840),
            height: z.number().int().min(480).max(2160),
        },
    }, async ({ sessionId, width, height }) => {
        const { display, session } = await resolveDisplay(ctx, sessionId);
        display.sendSize(width, height);
        session.displaySize = { width, height };
        await display.settle(800, 3000);
        return { requested: { width, height }, actual: { width: display.width, height: display.height } };
    });

    define("desktop_clipboard_set", {
        confirm: true,
        title: "Set the remote clipboard",
        description: "Sends text to the clipboard of the remote desktop so it can be pasted there (for example with ctrl+v). Useful for long text instead of desktop_type.",
        inputSchema: { sessionId: z.uuid(), text: z.string().max(200000) },
    }, async ({ sessionId, text }) => {
        const { display, audit } = await resolveDisplay(ctx, sessionId);
        display.sendClipboard(text);
        audit({ action: "clipboard_set", length: text.length });
        return { sent: text.length };
    });

    define("desktop_clipboard_get", {
        title: "Read the remote clipboard",
        description: "Returns the last clipboard content the remote desktop sent (updated when something is copied on the remote side).",
        inputSchema: { sessionId: z.uuid() },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId }) => {
        const { display } = await resolveDisplay(ctx, sessionId);
        return display.clipboard || { text: null, note: "No clipboard content received yet." };
    });
};
