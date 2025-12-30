let _isTauri = null;
let _tauriPromise = null;

const checkTauri = () => typeof window !== "undefined" && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

export const waitForTauri = () => {
    if (_tauriPromise) return _tauriPromise;

    _tauriPromise = new Promise((resolve) => {
        if (checkTauri()) {
            _isTauri = true;
            document.body.classList.add("tauri-mode");
            return resolve(true);
        }

        let attempts = 0;
        const interval = setInterval(() => {
            if (checkTauri()) {
                clearInterval(interval);
                _isTauri = true;
                document.body.classList.add("tauri-mode");
                resolve(true);
            } else if (++attempts >= 20) {
                clearInterval(interval);
                _isTauri = false;
                resolve(false);
            }
        }, 25);
    });

    return _tauriPromise;
};

export const isTauri = () => _isTauri ?? checkTauri();

export const getTitleBarHeight = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--title-bar-height");
    return parseInt(value) || 0;
};

export const getActiveServerUrl = () => localStorage.getItem("nexterm_server_url");

export const setActiveServerUrl = (url) => {
    url ? localStorage.setItem("nexterm_server_url", url.replace(/\/$/, ""))
        : localStorage.removeItem("nexterm_server_url");
};

export const openExternalUrl = async (url) => {
    if (!isTauri()) {
        window.open(url, "_blank");
        return;
    }
    
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_external_url", { url });
    } catch (e) {
        console.warn("Failed to open external URL:", e);
        window.open(url, "_blank");
    }
};

waitForTauri();
