import "./styles.sass";
import Icon from "@mdi/react";
import { mdiWindowMinimize, mdiWindowMaximize, mdiWindowClose, mdiWindowRestore } from "@mdi/js";
import { useEffect, useState } from "react";
import NextermLogo from "@/common/components/NextermLogo";
import { isTauri } from "@/common/utils/TauriUtil.js";
import { useTauriWindow } from "@/common/hooks/useTauriWindow.js";

export const TitleBar = ({ title = "Nexterm Connector", hideMaximize = false, showTabs = false }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFocused, setIsFocused] = useState(true);
    const appWindow = useTauriWindow();

    useEffect(() => {
        if (!appWindow) return;

        let cancelled = false;
        const unlisteners = [];
        const track = (unlisten) => cancelled ? unlisten() : unlisteners.push(unlisten);

        const syncSize = async () => {
            const [maximized, fullscreen] = await Promise.all([appWindow.isMaximized(), appWindow.isFullscreen()]);
            if (!cancelled) {
                setIsMaximized(maximized);
                setIsFullscreen(fullscreen);
            }
        };

        (async () => {
            await syncSize();
            const focused = await appWindow.isFocused();
            if (!cancelled) setIsFocused(focused);
            track(await appWindow.onResized(syncSize));
            track(await appWindow.onFocusChanged(({ payload }) => setIsFocused(payload)));
        })();

        return () => {
            cancelled = true;
            unlisteners.forEach(unlisten => unlisten());
        };
    }, [appWindow]);

    if (!isTauri()) return null;

    const handleMinimize = () => appWindow?.minimize();
    const handleMaximize = () => {
        if (isFullscreen) return appWindow?.setFullscreen(false);
        isMaximized ? appWindow?.unmaximize() : appWindow?.maximize();
    };
    const handleClose = () => appWindow?.close();

    return (
        <>
            <div className="title-bar-reveal-zone" />
            <div className={`title-bar ${isFocused ? "" : "inactive"}${showTabs ? " with-tabs" : ""}`} data-tauri-drag-region>
                <div className="title-bar-left" data-tauri-drag-region>
                    <NextermLogo size={24} />
                    <span data-tauri-drag-region>{title}</span>
                </div>
                {showTabs && (
                    <>
                        <div className="title-bar-tabs" id="titlebar-tabs-slot" />
                        <div className="title-bar-drag-space" data-tauri-drag-region />
                    </>
                )}
                <div className="title-bar-controls">
                    <button className="title-bar-btn" onClick={handleMinimize}>
                        <Icon path={mdiWindowMinimize} size={0.8} />
                    </button>
                    {!hideMaximize && (
                        <button className="title-bar-btn" onClick={handleMaximize}>
                            <Icon path={isMaximized || isFullscreen ? mdiWindowRestore : mdiWindowMaximize} size={0.8} />
                        </button>
                    )}
                    <button className="title-bar-btn close" onClick={handleClose}>
                        <Icon path={mdiWindowClose} size={0.8} />
                    </button>
                </div>
            </div>
        </>
    );
};
