import { isTauri, waitForTauri } from "@/common/utils/TauriUtil.js";

export const AUTO_SCALE = "auto";

export const SCALE_STEPS = [100, 125, 150, 175, 200, 225, 250, 300];

const STORAGE_PREFIX = "nexterm.displayScale.";

let osScale = null;

const browserScale = () => (window.devicePixelRatio || 1) * 100;

const parseScaleSetting = (value) => {
    if (value === AUTO_SCALE) return AUTO_SCALE;
    return SCALE_STEPS.includes(Number(value)) ? Number(value) : null;
};

export const snapScale = (percent) => SCALE_STEPS.reduce((best, step) =>
    Math.abs(step - percent) < Math.abs(best - percent) ? step : best, SCALE_STEPS[0]);

export const getDeviceScale = () => snapScale(osScale ?? browserScale());

export const toDisplayWidth = (pixels) => pixels & ~0x3;

export const toDisplayHeight = (pixels) => pixels & ~0x1;

waitForTauri().then(async (tauri) => {
    if (!tauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    osScale = (await getCurrentWindow().scaleFactor()) * 100;
}).catch(() => {});

export const watchDeviceScale = (onChange) => {
    let stopped = false;
    let unlistenTauri = null;
    let query = null;

    const notify = () => !stopped && onChange(getDeviceScale());

    const watchBrowser = () => {
        query?.removeEventListener("change", onBrowserChange);
        query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        query.addEventListener("change", onBrowserChange);
    };

    const onBrowserChange = () => {
        watchBrowser();
        notify();
    };

    if (isTauri()) {
        import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
            const win = getCurrentWindow();
            osScale = (await win.scaleFactor()) * 100;
            notify();
            const unlisten = await win.onScaleChanged(({ payload }) => {
                osScale = payload.scaleFactor * 100;
                notify();
            });
            if (stopped) unlisten();
            else unlistenTauri = unlisten;
        }).catch(watchBrowser);
    } else {
        watchBrowser();
    }

    return () => {
        stopped = true;
        unlistenTauri?.();
        query?.removeEventListener("change", onBrowserChange);
    };
};

export const getDeviceScaleOverride = (entryId) => {
    try {
        return parseScaleSetting(localStorage.getItem(STORAGE_PREFIX + entryId));
    } catch {
        return null;
    }
};

export const setDeviceScaleOverride = (entryId, scale) => {
    try {
        if (scale === null) localStorage.removeItem(STORAGE_PREFIX + entryId);
        else localStorage.setItem(STORAGE_PREFIX + entryId, String(scale));
        return true;
    } catch {
        return false;
    }
};

export const resolveDefaultScaleSetting = (connectionDefault, accountDefault) =>
    parseScaleSetting(connectionDefault) ?? parseScaleSetting(accountDefault) ?? AUTO_SCALE;

export const resolveScaleSetting = (entryId, connectionDefault, accountDefault) =>
    getDeviceScaleOverride(entryId) ?? resolveDefaultScaleSetting(connectionDefault, accountDefault);

export const resolveScale = (setting) => setting === AUTO_SCALE ? getDeviceScale() : setting;

export const scaleToDpi = (scale) => Math.round(scale * 96 / 100);

const MIN_DISPLAY_SIZE = 200;
const MAX_DISPLAY_SIZE = 8192;

const VIEW_INSET_KEY = "nexterm.viewInset";

const getRect = (selector) => document.querySelector(selector)?.getBoundingClientRect();

const getViewInset = () => {
    try {
        const inset = JSON.parse(localStorage.getItem(VIEW_INSET_KEY));
        return { width: Number(inset?.width) || 0, height: Number(inset?.height) || 0 };
    } catch {
        return { width: 0, height: 0 };
    }
};

export const rememberViewInset = () => {
    const page = getRect(".server-page");
    const view = getRect(".view-layouter");
    if (!page || !view) return false;
    try {
        localStorage.setItem(VIEW_INSET_KEY, JSON.stringify({
            width: page.width - view.width,
            height: page.height - view.height,
        }));
        return true;
    } catch {
        return false;
    }
};

export const getExpectedDisplaySize = () => {
    let rect = getRect(".view-layouter");
    if (!rect) {
        const page = getRect(".server-page");
        const inset = getViewInset();
        rect = page && { width: page.width - inset.width, height: page.height - inset.height };
    }
    if (!rect?.width || !rect?.height) return null;

    const density = window.devicePixelRatio || 1;
    const clamp = (value) => Math.min(Math.max(Math.round(value * density), MIN_DISPLAY_SIZE), MAX_DISPLAY_SIZE);
    return { width: toDisplayWidth(clamp(rect.width)), height: toDisplayHeight(clamp(rect.height)) };
};
