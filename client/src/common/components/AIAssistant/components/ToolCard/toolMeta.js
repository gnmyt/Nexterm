import {
    mdiClipboardTextOutline, mdiConsoleLine, mdiCursorDefaultClick, mdiFileDocumentOutline, mdiFileEditOutline,
    mdiFileMoveOutline, mdiFolderOutline, mdiFolderPlusOutline, mdiFormatListBulleted, mdiHelpCircleOutline,
    mdiInformationOutline, mdiKeyboardOutline, mdiLanConnect, mdiLanDisconnect, mdiLockOutline, mdiMagnify, mdiMonitor,
    mdiMonitorScreenshot, mdiMouse, mdiTextBoxOutline, mdiTrashCanOutline,
} from "@mdi/js";

const sessionArg = (a) => (a.sessionId ? a.sessionId.slice(0, 8) : "");
const pathArg = (a) => a.path || "";

const clickSummary = (a, t) => {
    const target = `${a.x}, ${a.y}${a.button && a.button !== "left" ? ` (${a.button})` : ""}`;
    return a.clicks > 1 ? t("servers.aiAssistant.toolSummary.doubleClick", { target }) : target;
};

export const FALLBACK_TOOL_META = { icon: mdiConsoleLine, summary: () => "" };

export const TOOL_META = {
    list_entries: { icon: mdiFormatListBulleted, summary: (a) => [a.search, a.protocol].filter(Boolean).join(" ") },
    get_entry: { icon: mdiInformationOutline, summary: (a) => `#${a.entryId}` },
    list_sessions: { icon: mdiFormatListBulleted, summary: () => "" },
    get_session: { icon: mdiInformationOutline, summary: sessionArg },
    get_monitoring: { icon: mdiInformationOutline, summary: (a) => (a.entryId ? `#${a.entryId}` : "") },
    open_session: { icon: mdiLanConnect, summary: (a) => `#${a.entryId}${a.type ? ` (${a.type})` : ""}` },
    close_session: { icon: mdiLanDisconnect, summary: sessionArg },
    close_all_sessions: { icon: mdiLanDisconnect, summary: () => "" },
    terminal_run: { icon: mdiConsoleLine, summary: (a) => a.command },
    terminal_send: { icon: mdiKeyboardOutline, summary: (a) => [a.text, ...(a.keys || [])].filter(Boolean).join(" ") },
    terminal_read: { icon: mdiTextBoxOutline, summary: sessionArg },
    terminal_resize: { icon: mdiMonitor, summary: (a) => `${a.cols}x${a.rows}` },
    run_command: { icon: mdiConsoleLine, summary: (a) => a.command },
    exec_command: { icon: mdiConsoleLine, summary: (a) => a.command },
    file_list: { icon: mdiFolderOutline, summary: pathArg },
    file_stat: { icon: mdiInformationOutline, summary: pathArg },
    file_read: { icon: mdiFileDocumentOutline, summary: pathArg },
    file_write: { icon: mdiFileEditOutline, summary: pathArg },
    file_edit: { icon: mdiFileEditOutline, summary: pathArg },
    file_mkdir: { icon: mdiFolderPlusOutline, summary: pathArg },
    file_delete: {
        icon: mdiTrashCanOutline,
        summary: (a, t) => (a.recursive ? t("servers.aiAssistant.toolSummary.recursive", { path: a.path }) : a.path),
    },
    file_move: { icon: mdiFileMoveOutline, summary: (a) => `${a.source} → ${a.destination}` },
    file_chmod: { icon: mdiLockOutline, summary: (a) => `${a.path} → ${a.mode}` },
    file_search_dirs: { icon: mdiMagnify, summary: (a) => a.query },
    desktop_screenshot: { icon: mdiMonitorScreenshot, summary: sessionArg },
    desktop_info: { icon: mdiInformationOutline, summary: sessionArg },
    desktop_click: { icon: mdiCursorDefaultClick, summary: clickSummary },
    desktop_mouse_move: { icon: mdiMouse, summary: (a) => `${a.x}, ${a.y}` },
    desktop_drag: { icon: mdiMouse, summary: (a) => `${a.fromX}, ${a.fromY} → ${a.toX}, ${a.toY}` },
    desktop_scroll: { icon: mdiMouse, summary: (a) => `${a.amount > 0 ? "↓" : "↑"} ${Math.abs(a.amount)}` },
    desktop_type: { icon: mdiKeyboardOutline, summary: (a) => a.text },
    desktop_key: { icon: mdiKeyboardOutline, summary: (a) => (Array.isArray(a.keys) ? a.keys.join(", ") : a.keys) },
    desktop_resize: { icon: mdiMonitor, summary: (a) => `${a.width}x${a.height}` },
    desktop_clipboard_set: { icon: mdiClipboardTextOutline, summary: (a) => a.text },
    desktop_clipboard_get: { icon: mdiClipboardTextOutline, summary: sessionArg },
    batch: { icon: mdiFormatListBulleted, summary: (a) => (a.steps || []).map((s) => s.tool).join(" → ") },
    ask_user: { icon: mdiHelpCircleOutline, summary: (a) => a.question },
};
