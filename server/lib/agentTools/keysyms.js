const NAMED_KEYS = {
    enter: 0xff0d, return: 0xff0d,
    tab: 0xff09,
    backspace: 0xff08,
    escape: 0xff1b, esc: 0xff1b,
    delete: 0xffff, del: 0xffff,
    insert: 0xff63,
    home: 0xff50, end: 0xff57,
    pageup: 0xff55, page_up: 0xff55, prior: 0xff55,
    pagedown: 0xff56, page_down: 0xff56, next: 0xff56,
    left: 0xff51, up: 0xff52, right: 0xff53, down: 0xff54,
    arrowleft: 0xff51, arrowup: 0xff52, arrowright: 0xff53, arrowdown: 0xff54,
    space: 0x20,
    shift: 0xffe1, shift_l: 0xffe1, shift_r: 0xffe2,
    ctrl: 0xffe3, control: 0xffe3, control_l: 0xffe3, control_r: 0xffe4,
    alt: 0xffe9, alt_l: 0xffe9, alt_r: 0xffea, altgr: 0xfe03,
    meta: 0xffe7, super: 0xffeb, super_l: 0xffeb, super_r: 0xffec, win: 0xffeb, windows: 0xffeb, cmd: 0xffeb,
    capslock: 0xffe5, caps_lock: 0xffe5,
    numlock: 0xff7f, num_lock: 0xff7f,
    scrolllock: 0xff14,
    print: 0xff61, printscreen: 0xff61,
    pause: 0xff13,
    menu: 0xff67,
    f1: 0xffbe, f2: 0xffbf, f3: 0xffc0, f4: 0xffc1, f5: 0xffc2, f6: 0xffc3,
    f7: 0xffc4, f8: 0xffc5, f9: 0xffc6, f10: 0xffc7, f11: 0xffc8, f12: 0xffc9,
    plus: 0x2b, minus: 0x2d, comma: 0x2c, period: 0x2e, slash: 0x2f, backslash: 0x5c,
    semicolon: 0x3b, apostrophe: 0x27, quote: 0x27, grave: 0x60, backquote: 0x60,
    bracketleft: 0x5b, bracketright: 0x5d, equal: 0x3d,
};

const MODIFIERS = new Set([0xffe1, 0xffe2, 0xffe3, 0xffe4, 0xffe9, 0xffea, 0xfe03, 0xffe7, 0xffeb, 0xffec]);

const charToKeysym = (char) => {
    const codePoint = char.codePointAt(0);
    if (codePoint === 0x0a || codePoint === 0x0d) return 0xff0d;
    if (codePoint === 0x09) return 0xff09;
    if (codePoint === 0x08 || codePoint === 0x7f) return 0xff08;
    if (codePoint === 0x1b) return 0xff1b;
    if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
    if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
    return 0x01000000 | codePoint;
};

const keyNameToKeysym = (name) => {
    const raw = String(name).trim();
    if (!raw) throw new Error("Empty key name");
    const lower = raw.toLowerCase();
    if (NAMED_KEYS[lower] !== undefined) return NAMED_KEYS[lower];
    if (/^0x[0-9a-f]+$/i.test(raw)) return Number.parseInt(raw, 16);
    if ([...raw].length === 1) return charToKeysym(raw);
    throw new Error(`Unknown key: ${raw}`);
};

const parseKeyCombo = (combo) => {
    const parts = String(combo).split("+").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) throw new Error("Empty key combination");
    const keysyms = parts.map(keyNameToKeysym);
    const modifiers = keysyms.filter((k) => MODIFIERS.has(k));
    const keys = keysyms.filter((k) => !MODIFIERS.has(k));
    return { modifiers, keys };
};

module.exports = { NAMED_KEYS, MODIFIERS, charToKeysym, keyNameToKeysym, parseKeyCombo };
