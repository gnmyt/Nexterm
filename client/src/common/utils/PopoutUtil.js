import { isTauri } from "@/common/utils/TauriUtil.js";

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexterm_popout") : null;

const POPOUT_CLOSED = "popout_closed";
const FORCE_CLOSE = "force_close";

const WINDOW_FEATURES = "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no";

export const openPopout = async (sessionId, monitor = null) => {
    if (isTauri()) {
        try {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("open_popout", { sessionId, monitor });
        } catch (e) {
            console.error("Failed to open popout window:", e);
        }
        return;
    }

    const path = monitor === null ? `/popout/${sessionId}` : `/popout/${sessionId}/${monitor}`;
    const name = monitor === null ? `nexterm_popout_${sessionId}` : `nexterm_popout_${sessionId}_m${monitor}`;
    window.open(path, name, WINDOW_FEATURES)?.focus();
};

export const notifyPopoutClosed = (sessionId, monitor = null) => {
    channel?.postMessage({ type: POPOUT_CLOSED, sessionId, monitor });
};

export const onPopoutClosed = (callback) => {
    const cleanups = [];

    if (channel) {
        const handler = ({ data }) => {
            if (data?.type === POPOUT_CLOSED && data.sessionId) callback(data.sessionId, data.monitor ?? null);
        };
        channel.addEventListener("message", handler);
        cleanups.push(() => channel.removeEventListener("message", handler));
    }

    if (isTauri()) {
        let unlisten;
        import("@tauri-apps/api/event").then(async ({ listen }) => {
            unlisten = await listen(POPOUT_CLOSED, ({ payload }) => {
                if (payload?.sessionId) callback(payload.sessionId, payload.monitor ?? null);
            });
        });
        cleanups.push(() => unlisten?.());
    }

    return () => cleanups.forEach((cleanup) => cleanup());
};

export const closeAllPopouts = async () => {
    channel?.postMessage({ type: FORCE_CLOSE });
    if (!isTauri()) return;

    try {
        const { getAllWindows } = await import("@tauri-apps/api/window");
        (await getAllWindows()).filter(w => w.label.startsWith("popout_")).forEach(w => w.close());
    } catch {}
};

export const onForceClose = (callback) => {
    if (!channel) return () => {};

    const handler = ({ data }) => data?.type === FORCE_CLOSE && callback();
    channel.addEventListener("message", handler);
    return () => channel.removeEventListener("message", handler);
};
