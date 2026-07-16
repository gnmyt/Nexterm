import { useEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiDragVertical, mdiKeyboardOutline, mdiMonitorMultiple, mdiPlus, mdiMinus } from "@mdi/js";
import { useTranslation } from "react-i18next";
import KeyboardShortcutsMenu from "../../../components/TerminalActionsMenu/components/KeyboardShortcutsMenu";
import "./styles.sass";

const MODIFIERS = [
    { label: "Ctrl", keysym: 0xffe3 },
    { label: "Alt", keysym: 0xffe9 },
    { label: "Shift", keysym: 0xffe1 },
    { label: "Win", keysym: 0xffeb },
];

export const SessionToolbar = ({
                                   containerRef,
                                   monitorCount,
                                   activeMonitor,
                                   maxMonitors,
                                   heldModifiers,
                                   readOnly,
                                   poppedOutMonitors,
                                   allowMonitors = true,
                                   onSelectMonitor,
                                   onAddMonitor,
                                   onRemoveMonitor,
                                   onPopOutMonitor,
                                   onToggleModifier,
                                   onSendShortcut,
                                   onDraggingChange,
                               }) => {
    const { t } = useTranslation();
    const [position, setPosition] = useState(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [dragging, setDragging] = useState(false);
    const toolbarRef = useRef(null);
    const dragState = useRef(null);

    const showsMonitors = allowMonitors && maxMonitors > 1;

    const monitors = Array.from({ length: monitorCount }, (_, index) => index)
        .filter((index) => !poppedOutMonitors?.has(index));

    const canRemove = monitorCount > 1 && !poppedOutMonitors?.has(monitorCount - 1);

    const pinned = shortcutsOpen || dragging || heldModifiers.size > 0;

    useEffect(() => {
        const container = containerRef?.current;
        if (!container || typeof ResizeObserver === "undefined") return;

        const clampIntoView = () => setPosition((prev) => {
            const toolbar = toolbarRef.current;
            if (!prev || !toolbar) return prev;
            const x = Math.min(prev.x, Math.max(container.clientWidth - toolbar.offsetWidth, 0));
            const y = Math.min(prev.y, Math.max(container.clientHeight - toolbar.offsetHeight, 0));
            return x === prev.x && y === prev.y ? prev : { x, y };
        });

        const observer = new ResizeObserver(clampIntoView);
        observer.observe(container);
        return () => observer.disconnect();
    }, [containerRef]);

    const startDrag = (event) => {
        const container = containerRef?.current;
        const toolbar = toolbarRef.current;
        if (!container || !toolbar || event.button !== 0) return;

        event.preventDefault();
        const bounds = toolbar.getBoundingClientRect();
        const origin = container.getBoundingClientRect();
        dragState.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };

        onDraggingChange?.(true);
        setDragging(true);

        const onMove = (moveEvent) => {
            const x = moveEvent.clientX - origin.left - dragState.current.offsetX;
            const y = moveEvent.clientY - origin.top - dragState.current.offsetY;
            setPosition({
                x: Math.min(Math.max(x, 0), Math.max(origin.width - toolbar.offsetWidth, 0)),
                y: Math.min(Math.max(y, 0), Math.max(origin.height - toolbar.offsetHeight, 0)),
            });
        };

        const onUp = () => {
            dragState.current = null;
            onDraggingChange?.(false);
            setDragging(false);
            window.removeEventListener("mousemove", onMove, true);
            window.removeEventListener("mouseup", onUp, true);
        };

        window.addEventListener("mousemove", onMove, true);
        window.addEventListener("mouseup", onUp, true);
    };

    const act = (action) => (event) => {
        event.preventDefault();
        action();
        containerRef?.current?.focus();
    };

    const placement = position ? { left: position.x + "px", top: position.y + "px", transform: "none" } : {};

    return (
        <>
            <div ref={toolbarRef} style={placement}
                 className={`session-toolbar ${pinned ? "session-toolbar--pinned" : ""}`}>

                <div className="session-toolbar__handle" onMouseDown={startDrag} title={t("servers.toolbar.drag")}>
                    <Icon path={mdiDragVertical} size={0.8} />
                </div>

                <div className="session-toolbar__body">
                    <div className="session-toolbar__body-inner">
                        <div className="session-toolbar__divider" />

                        {MODIFIERS.map(({ label, keysym }) => (
                            <button key={keysym} type="button" aria-pressed={heldModifiers.has(keysym)}
                                    className={`session-toolbar__key ${heldModifiers.has(keysym) ? "session-toolbar__key--held" : ""}`}
                                    title={t("servers.toolbar.holdModifier", { key: label })}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={act(() => onToggleModifier(keysym))}>
                                {label}
                            </button>
                        ))}

                        <button type="button" className="session-toolbar__action" title={t("servers.toolbar.shortcuts")}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={act(() => setShortcutsOpen(true))}>
                            <Icon path={mdiKeyboardOutline} size={0.7} />
                        </button>

                        {showsMonitors && (
                            <div className="session-toolbar__group">
                                <div className="session-toolbar__divider" />
                                <Icon path={mdiMonitorMultiple} size={0.8} className="session-toolbar__icon" />

                                {monitors.map((index) => (
                                    <button key={index} type="button"
                                            className={`session-toolbar__chip ${index === activeMonitor ? "session-toolbar__chip--active" : ""}`}
                                            title={readOnly
                                                ? t("servers.monitors.select", { number: index + 1 })
                                                : t("servers.monitors.selectOrPopOut", { number: index + 1 })}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={act(() => onSelectMonitor(index))}
                                            onDoubleClick={readOnly ? undefined : act(() => onPopOutMonitor(index))}>
                                        {index + 1}
                                    </button>
                                ))}

                                {!readOnly && (
                                    <>
                                        <button type="button" className="session-toolbar__action"
                                                disabled={!canRemove}
                                                title={t("servers.monitors.remove")}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={act(onRemoveMonitor)}>
                                            <Icon path={mdiMinus} size={0.7} />
                                        </button>
                                        <button type="button" className="session-toolbar__action"
                                                disabled={monitorCount >= maxMonitors}
                                                title={t("servers.monitors.add")}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={act(onAddMonitor)}>
                                            <Icon path={mdiPlus} size={0.7} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <KeyboardShortcutsMenu visible={shortcutsOpen} onClose={() => setShortcutsOpen(false)}
                                   onSelect={onSendShortcut} />
        </>
    );
};