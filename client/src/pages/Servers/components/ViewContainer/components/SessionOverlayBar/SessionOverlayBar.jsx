import { useState } from "react";
import Icon from "@mdi/react";
import { mdiFullscreen, mdiFullscreenExit, mdiMenu } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { getIconPath } from "@/common/utils/iconUtils.js";
import { ContextMenu, useContextMenu } from "@/common/components/ContextMenu";
import { RemoteDesktopMenuItems } from "../SessionMenu";
import RemoteSessionStrip from "../RemoteSessionStrip";
import KeyboardShortcutsMenu from "../KeyboardShortcutsMenu";
import "./styles.sass";

export const SessionOverlayBar = ({ session, controls, fullscreenEnabled, onFullscreenToggle }) => {
    const { t } = useTranslation();
    const menu = useContextMenu();
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const pinned = menu.isOpen || shortcutsOpen || (controls?.heldModifiers.size ?? 0) > 0;

    const openMenu = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        menu.open(event, { x: bounds.left, y: bounds.bottom + 6 });
    };

    return (
        <>
            <div className="session-overlay-zone" />
            <div className={`session-overlay-bar${pinned ? " pinned" : ""}`}>
                <div className="session-overlay-bar__title">
                    <Icon path={getIconPath(session.server?.icon)} />
                    <span>{session.server?.name}</span>
                </div>
                {controls && <RemoteSessionStrip controls={controls} />}
                <div className="session-overlay-bar__actions">
                    <button type="button" className="session-overlay-bar__button"
                            title={fullscreenEnabled ? t("servers.terminalActions.exitFullScreen") : t("servers.terminalActions.fullScreen")}
                            onClick={onFullscreenToggle}>
                        <Icon path={fullscreenEnabled ? mdiFullscreenExit : mdiFullscreen} />
                    </button>
                    {controls && (
                        <button type="button" className={`session-overlay-bar__button${menu.isOpen ? " active" : ""}`}
                                title={t("servers.terminalActions.menuTitle")} onClick={openMenu}>
                            <Icon path={mdiMenu} />
                        </button>
                    )}
                </div>
            </div>
            {controls && (
                <ContextMenu isOpen={menu.isOpen} position={menu.position} onClose={menu.close} trigger={menu.triggerRef}>
                    <RemoteDesktopMenuItems controls={controls} onOpenShortcuts={() => setShortcutsOpen(true)} />
                </ContextMenu>
            )}
            <KeyboardShortcutsMenu visible={shortcutsOpen} onClose={() => setShortcutsOpen(false)}
                                   onSelect={(keys) => controls?.sendShortcut(keys)} />
        </>
    );
};
