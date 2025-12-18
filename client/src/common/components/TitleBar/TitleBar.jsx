import "./styles.sass";
import Icon from "@mdi/react";
import { mdiWindowMinimize, mdiWindowMaximize, mdiWindowClose, mdiWindowRestore } from "@mdi/js";
import { useEffect, useState } from "react";
import NextermLogo from "@/common/components/NextermLogo";
import { isTauri } from "@/common/utils/TauriUtil.js";

export const TitleBar = ({ title = "Nexterm Connector", hideMaximize = false }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isFocused, setIsFocused] = useState(true);
    const [appWindow, setAppWindow] = useState(null);

    useEffect(() => {
        if (!isTauri()) return;
        
        let unlistenResize, unlistenFocus, unlistenBlur;
        import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
            const win = getCurrentWindow();
            setAppWindow(win);
            setIsMaximized(await win.isMaximized());
            setIsFocused(await win.isFocused());
            unlistenResize = await win.onResized(async () => setIsMaximized(await win.isMaximized()));
            unlistenFocus = await win.onFocusChanged(({ payload: focused }) => setIsFocused(focused));
        });
        
        return () => {
            unlistenResize?.();
            unlistenFocus?.();
            unlistenBlur?.();
        };
    }, []);

    if (!isTauri()) return null;

    const handleMinimize = () => appWindow?.minimize();
    const handleMaximize = () => isMaximized ? appWindow?.unmaximize() : appWindow?.maximize();
    const handleClose = () => appWindow?.close();

    return (
        <div className={`title-bar ${isFocused ? "" : "inactive"}`} data-tauri-drag-region>
            <div className="title-bar-left" data-tauri-drag-region>
                <NextermLogo size={24} />
                <span data-tauri-drag-region>{title}</span>
            </div>
            <div className="title-bar-controls">
                <button className="title-bar-btn" onClick={handleMinimize}>
                    <Icon path={mdiWindowMinimize} size={0.8} />
                </button>
                {!hideMaximize && (
                    <button className="title-bar-btn" onClick={handleMaximize}>
                        <Icon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} size={0.8} />
                    </button>
                )}
                <button className="title-bar-btn close" onClick={handleClose}>
                    <Icon path={mdiWindowClose} size={0.8} />
                </button>
            </div>
        </div>
    );
};