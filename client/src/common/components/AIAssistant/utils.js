export const autoGrow = (el, maxPx = 176) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
};

export const newId = () => globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const isPlainEnter = (e) => e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

export const toggleMenuAbove = (menu, e) => {
    e.stopPropagation();
    if (menu.isOpen) return menu.close();
    const rect = e.currentTarget.getBoundingClientRect();
    menu.open(e, { x: rect.left, y: rect.top });
};

export const protocolLabel = (protocol) => {
    if (!protocol) return "";
    if (protocol.startsWith("pve-")) return "PVE";
    return protocol === "demo" ? "Demo" : protocol.toUpperCase();
};
