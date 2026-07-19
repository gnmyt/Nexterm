import { useEffect, useState } from "react";
import { isTauri } from "@/common/utils/TauriUtil.js";

export const useTauriWindow = () => {
    const [appWindow, setAppWindow] = useState(null);

    useEffect(() => {
        if (!isTauri()) return;
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => setAppWindow(getCurrentWindow()));
    }, []);

    return appWindow;
};
