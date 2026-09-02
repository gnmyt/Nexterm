import { useTranslation } from "react-i18next";
import {
    mdiBroadcast,
    mdiClose,
    mdiCloseCircle,
    mdiCodeBraces,
    mdiContentDuplicate,
    mdiEye,
    mdiFullscreen,
    mdiFullscreenExit,
    mdiKeyboard,
    mdiLinkVariant,
    mdiMagnifyMinusOutline,
    mdiMagnifyPlusOutline,
    mdiMagnifyScan,
    mdiNoteEditOutline,
    mdiOpenInNew,
    mdiPencil,
    mdiShareVariant,
    mdiSleep,
    mdiViewSplitHorizontal,
    mdiViewSplitVertical,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "@/common/components/ContextMenu";
import { postRequest, deleteRequest, patchRequest } from "@/common/utils/RequestUtil";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";

export const RemoteDesktopMenuItems = ({ controls, onOpenShortcuts }) => {
    const { t } = useTranslation();

    return (
        <>
            <ContextMenuItem icon={mdiKeyboard} label={t("servers.tabs.contextMenu.sendShortcut")} onClick={onOpenShortcuts} />
            <ContextMenuItem icon={mdiMagnifyScan} label={t("servers.tabs.contextMenu.zoom", { zoom: Math.round(controls.zoom * 100) })}>
                <ContextMenuItem icon={mdiMagnifyPlusOutline} label={t("servers.toolbar.zoomIn")}
                                 disabled={controls.zoom >= controls.maxZoom} onClick={controls.zoomIn} />
                <ContextMenuItem icon={mdiMagnifyMinusOutline} label={t("servers.toolbar.zoomOut")}
                                 disabled={controls.zoom <= controls.minZoom} onClick={controls.zoomOut} />
                <ContextMenuItem icon={mdiMagnifyScan} label={t("servers.tabs.contextMenu.zoomReset")}
                                 disabled={controls.zoom <= controls.minZoom} onClick={controls.resetZoom} />
            </ContextMenuItem>
        </>
    );
};

export const SessionMenu = ({
    menu,
    session,
    controls,
    isActive,
    canSplit,
    layoutMode,
    broadcastEnabled,
    fullscreenEnabled,
    onFullscreenToggle,
    onBroadcastToggle,
    onOpenSnippets,
    onOpenShortcuts,
    onSplitSession,
    onPopOut,
    onOpenNotes,
    onDuplicate,
    onHibernate,
    onCloseSession,
}) => {
    const { t } = useTranslation();

    const server = session?.server;
    const isNotes = session?.type === "notes";
    const isJoined = !!session?.isJoined;
    const isTerminal = !isNotes && !session?.scriptId && (session?.type || server?.renderer) === "terminal";
    const canPopOut = !!session && !session.scriptId && session.type !== "sftp" && !isNotes && !isJoined;
    const canShare = canPopOut;
    const canHibernate = !isNotes && !isJoined;
    const canDuplicate = !isNotes && !isJoined;
    const canOpenNotes = !isNotes && !isJoined && !!server?.id && !session?.scriptId;
    const isSharing = !!session?.shareId;
    const showBroadcast = isTerminal && isActive && layoutMode !== "single";

    const shareLink = (shareId) => `${getBaseUrl() || window.location.origin}/share/${shareId}`;

    const handleShare = async (writable) => {
        const result = await postRequest(`connections/${session.id}/share`, { writable });
        if (result?.shareId) navigator.clipboard.writeText(shareLink(result.shareId));
    };

    const handleStopSharing = () => deleteRequest(`connections/${session.id}/share`);
    const handleCopyLink = () => navigator.clipboard.writeText(shareLink(session.shareId));
    const handlePermissionChange = (writable) => patchRequest(`connections/${session.id}/share`, { writable });

    return (
        <ContextMenu isOpen={menu.isOpen} position={menu.position} onClose={menu.close} trigger={menu.triggerRef}>
            {session && (
                <>
                    {controls && isActive && (
                        <>
                            <RemoteDesktopMenuItems controls={controls} onOpenShortcuts={onOpenShortcuts} />
                            <ContextMenuSeparator />
                        </>
                    )}
                    {isTerminal && isActive && (
                        <>
                            <ContextMenuItem icon={mdiCodeBraces} label={t("servers.terminalActions.snippets")} onClick={onOpenSnippets} />
                            {showBroadcast && (
                                <ContextMenuItem icon={mdiBroadcast} label={t("servers.terminalActions.broadcasting")}
                                                 checked={broadcastEnabled} onClick={onBroadcastToggle} />
                            )}
                            <ContextMenuSeparator />
                        </>
                    )}
                    {isActive && (
                        <ContextMenuItem icon={fullscreenEnabled ? mdiFullscreenExit : mdiFullscreen}
                                         label={fullscreenEnabled ? t("servers.terminalActions.exitFullScreen") : t("servers.terminalActions.fullScreen")}
                                         onClick={onFullscreenToggle} />
                    )}
                    {canSplit && (
                        <>
                            <ContextMenuItem icon={mdiViewSplitVertical} label={t("servers.tabs.contextMenu.splitRight")}
                                             onClick={() => onSplitSession(session.id, "right")} />
                            <ContextMenuItem icon={mdiViewSplitHorizontal} label={t("servers.tabs.contextMenu.splitDown")}
                                             onClick={() => onSplitSession(session.id, "bottom")} />
                        </>
                    )}
                    {canPopOut && (
                        <ContextMenuItem icon={mdiOpenInNew} label={t("servers.tabs.contextMenu.popOut")}
                                         onClick={() => onPopOut(session.id)} />
                    )}
                    <ContextMenuSeparator />
                    {canShare && !isSharing && (
                        <ContextMenuItem icon={mdiShareVariant} label={t("servers.tabs.contextMenu.startSharing")}>
                            <ContextMenuItem icon={mdiEye} label={t("servers.tabs.contextMenu.readOnly")} onClick={() => handleShare(false)} />
                            <ContextMenuItem icon={mdiPencil} label={t("servers.tabs.contextMenu.readWrite")} onClick={() => handleShare(true)} />
                        </ContextMenuItem>
                    )}
                    {canShare && isSharing && (
                        <>
                            <ContextMenuItem icon={mdiLinkVariant} label={t("servers.tabs.contextMenu.copyShareLink")} onClick={handleCopyLink} />
                            <ContextMenuItem icon={mdiShareVariant} label={t("servers.tabs.contextMenu.changePermissions")}>
                                <ContextMenuItem icon={mdiEye} label={t("servers.tabs.contextMenu.readOnly")}
                                                 checked={!session.shareWritable} onClick={() => handlePermissionChange(false)} />
                                <ContextMenuItem icon={mdiPencil} label={t("servers.tabs.contextMenu.readWrite")}
                                                 checked={session.shareWritable} onClick={() => handlePermissionChange(true)} />
                            </ContextMenuItem>
                            <ContextMenuItem icon={mdiCloseCircle} label={t("servers.tabs.contextMenu.stopSharing")} onClick={handleStopSharing} danger />
                        </>
                    )}
                    {canShare && <ContextMenuSeparator />}
                    {canOpenNotes && (
                        <ContextMenuItem icon={mdiNoteEditOutline} label={t("servers.tabs.contextMenu.openNotes")}
                                         onClick={() => onOpenNotes(server.id)} />
                    )}
                    {canDuplicate && (
                        <ContextMenuItem icon={mdiContentDuplicate} label={t("servers.tabs.contextMenu.duplicate")}
                                         onClick={() => onDuplicate(session.id)} />
                    )}
                    {canHibernate && (
                        <ContextMenuItem icon={mdiSleep} label={t("servers.tabs.contextMenu.hibernateSession")}
                                         onClick={() => onHibernate(session.id)} />
                    )}
                    <ContextMenuItem icon={mdiClose} label={t("servers.tabs.contextMenu.closeSession")}
                                     onClick={() => onCloseSession(session.id)} danger />
                </>
            )}
        </ContextMenu>
    );
};
